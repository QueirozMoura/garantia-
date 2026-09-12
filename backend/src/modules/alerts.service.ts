import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Alerts only require the fields the client needs to render them, plus the
// purchase summary. `purchase.userId` is used solely by the database filter and
// is never selected into the response.
const alertWarrantySelect = {
  id: true,
  purchaseId: true,
  startDate: true,
  endDate: true,
  updatedAt: true,
  purchase: {
    select: {
      id: true,
      productName: true,
      brand: true,
      model: true,
      category: true,
    },
  },
} satisfies Prisma.WarrantySelect;

type AlertWarranty = Prisma.WarrantyGetPayload<{ select: typeof alertWarrantySelect }>;

export type AlertType = 'WARRANTY_EXPIRING' | 'WARRANTY_EXPIRED';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  createdAt: Date;
  warranty: {
    id: string;
    purchaseId: string;
    startDate: Date;
    endDate: Date;
  };
  purchase: AlertWarranty['purchase'];
}

// Warranty start/end dates come from a YYYY-MM-DD string parsed into UTC
// midnight. To avoid timezone drift we anchor "today" at UTC midnight of the
// current day, matching the project's date handling (dashboard.service).
const startOfTodayUtc = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const diffInDaysUtc = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

// A warranty is "expiring" when it has not ended yet and ends within this many
// days (inclusive). A warranty is "expired" when it ended strictly before today.
const EXPIRING_WINDOW_DAYS = 30;

/** "vence hoje" / "vence em N dia(s)" for a warranty that has not ended yet. */
const expiringMessage = (productName: string, daysRemaining: number) => {
  if (daysRemaining <= 0) {
    return `A garantia do produto ${productName} vence hoje.`;
  }
  if (daysRemaining === 1) {
    return `A garantia do produto ${productName} vence em 1 dia.`;
  }
  return `A garantia do produto ${productName} vence em ${daysRemaining} dias.`;
};

/** "venceu há 1 dia" / "venceu há N dias" for a warranty that already ended. */
const expiredMessage = (productName: string, daysExpired: number) => {
  if (daysExpired === 1) {
    return `A garantia do produto ${productName} venceu há 1 dia.`;
  }
  return `A garantia do produto ${productName} venceu há ${daysExpired} dias.`;
};

const buildAlert = (warranty: AlertWarranty, today: Date): Alert | null => {
  const { startDate, endDate } = warranty;

  // Future warranties (start date still in the future) never generate alerts.
  if (startDate > today) {
    return null;
  }

  const daysRemaining = diffInDaysUtc(today, endDate);

  let type: AlertType;
  let title: string;
  let message: string;

  if (endDate < today) {
    type = 'WARRANTY_EXPIRED';
    title = 'Garantia vencida';
    message = expiredMessage(warranty.purchase.productName, -daysRemaining);
  } else if (daysRemaining <= EXPIRING_WINDOW_DAYS) {
    type = 'WARRANTY_EXPIRING';
    title = 'Garantia vencendo em breve';
    message = expiringMessage(warranty.purchase.productName, daysRemaining);
  } else {
    // Active warranty with more than 30 days remaining: no alert.
    return null;
  }

  return {
    // No Alert table exists: the warranty id is reused as the alert id.
    id: warranty.id,
    type,
    title,
    message,
    // Derived alert has no persisted timestamp of its own; updatedAt is the
    // most recent change to the underlying warranty.
    createdAt: warranty.updatedAt,
    warranty: {
      id: warranty.id,
      purchaseId: warranty.purchaseId,
      startDate: warranty.startDate,
      endDate: warranty.endDate,
    },
    purchase: warranty.purchase,
  };
};

/**
 * Builds the list of alerts the authenticated user should see, derived from
 * their warranties. No persistence is involved.
 *
 * Ownership is enforced in the database query (`purchase: { userId }`), never by
 * fetching all rows and filtering in JavaScript.
 *
 * Ordering: expiring alerts first (fewest days remaining first), then expired
 * alerts (most days expired first). Ties are broken deterministically by
 * `endDate asc`.
 */
export const listAlerts = async (userId: string, now: Date = new Date()) => {
  const today = startOfTodayUtc(now);

  const warranties = await prisma.warranty.findMany({
    where: { purchase: { userId } },
    select: alertWarrantySelect,
  });

  const alerts = warranties
    .map((warranty) => buildAlert(warranty, today))
    .filter((alert): alert is Alert => alert !== null);

  const typeRank: Record<AlertType, number> = {
    WARRANTY_EXPIRING: 0,
    WARRANTY_EXPIRED: 1,
  };

  alerts.sort((a, b) => {
    const byType = typeRank[a.type] - typeRank[b.type];
    if (byType !== 0) return byType;

    // Within each group: most urgent first.
    // - Expiring: fewest days remaining first = earliest endDate first.
    // - Expired: most days elapsed first = earliest endDate first.
    // Both therefore order by endDate ascending.
    const byEndDate = a.warranty.endDate.getTime() - b.warranty.endDate.getTime();
    if (byEndDate !== 0) return byEndDate;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return alerts;
};

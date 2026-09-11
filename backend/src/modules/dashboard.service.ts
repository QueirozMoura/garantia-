import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

// Selects only the fields the dashboard needs, avoiding documents and other
// private/irrelevant data.
const expiringWarrantySelect = {
  startDate: true,
  endDate: true,
  purchase: {
    select: {
      id: true,
      productName: true,
      brand: true,
      model: true,
    },
  },
} satisfies Prisma.WarrantySelect;

const recentPurchaseSelect = {
  id: true,
  productName: true,
  brand: true,
  model: true,
  store: true,
  purchaseDate: true,
  price: true,
  category: true,
} satisfies Prisma.PurchaseSelect;

const EXPIRING_WINDOW_DAYS = 30;
const RECENT_PURCHASES_LIMIT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Purchase dates come from a YYYY-MM-DD string parsed into UTC midnight. To
// avoid timezone drift we anchor "today" at UTC midnight of the current day,
// matching the project's date handling (purchases.schemas).
const startOfTodayUtc = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const addDaysUtc = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const diffInDaysUtc = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

const serializePurchase = (
  purchase: Prisma.PurchaseGetPayload<{ select: typeof recentPurchaseSelect }>,
) => ({
  ...purchase,
  price: purchase.price.toFixed(2),
});

const serializeExpiringWarranty = (
  warranty: Prisma.WarrantyGetPayload<{ select: typeof expiringWarrantySelect }>,
  today: Date,
) => ({
  purchaseId: warranty.purchase.id,
  productName: warranty.purchase.productName,
  brand: warranty.purchase.brand,
  model: warranty.purchase.model,
  startDate: warranty.startDate,
  endDate: warranty.endDate,
  daysRemaining: diffInDaysUtc(today, warranty.endDate),
});

export const getDashboard = async (userId: string, now: Date = new Date()) => {
  const today = startOfTodayUtc(now);
  const windowEnd = addDaysUtc(today, EXPIRING_WINDOW_DAYS);

  // Independent queries run in parallel: summary counters/aggregate, the
  // warranties expiring within the next 30 days, and the most recent purchases.
  const [
    totalPurchases,
    totalWarranties,
    activeWarranties,
    spent,
    expiringWarranties,
    recentPurchases,
  ] = await Promise.all([
    prisma.purchase.count({ where: { userId } }),
    prisma.warranty.count({ where: { purchase: { userId } } }),
    prisma.warranty.count({
      where: {
        purchase: { userId },
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    prisma.purchase.aggregate({ where: { userId }, _sum: { price: true } }),
    prisma.warranty.findMany({
      where: {
        purchase: { userId },
        endDate: { gte: today, lte: windowEnd },
      },
      orderBy: { endDate: 'asc' },
      select: expiringWarrantySelect,
    }),
    prisma.purchase.findMany({
      where: { userId },
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
      take: RECENT_PURCHASES_LIMIT,
      select: recentPurchaseSelect,
    }),
  ]);

  const totalSpent = (spent._sum.price ?? new Prisma.Decimal(0)).toFixed(2);

  return {
    summary: {
      totalPurchases,
      totalWarranties,
      activeWarranties,
      totalSpent,
    },
    expiringWarranties: expiringWarranties.map((warranty) =>
      serializeExpiringWarranty(warranty, today),
    ),
    recentPurchases: recentPurchases.map(serializePurchase),
  };
};

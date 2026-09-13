import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { forbidden, notFound } from '../utils/http-error.js';
import type { AssistanceRequestInput } from './assistance.schemas.js';

// Only the purchase identification fields are exposed. Internal fields such as
// userId, price and serialNumber are never selected, so they can never leak.
const assistancePurchaseSelect = {
  id: true,
  productName: true,
  brand: true,
  model: true,
  store: true,
  purchaseDate: true,
  // userId is only needed to enforce ownership; it is stripped before returning.
  userId: true,
  warranty: {
    select: {
      id: true,
      durationMonths: true,
      startDate: true,
      endDate: true,
    },
  },
} satisfies Prisma.PurchaseSelect;

type AssistancePurchase = Prisma.PurchaseGetPayload<{ select: typeof assistancePurchaseSelect }>;

export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | 'NONE';

// Warranty dates come from a YYYY-MM-DD string parsed into UTC midnight. To
// avoid timezone drift we anchor "today" at UTC midnight, matching the project's
// date handling (dashboard.service / alerts.service).
const startOfTodayUtc = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const resolveWarrantyStatus = (
  warranty: AssistancePurchase['warranty'],
  today: Date,
): WarrantyStatus => {
  if (!warranty) return 'NONE';
  if (warranty.startDate > today) return 'UPCOMING';
  if (warranty.endDate < today) return 'EXPIRED';
  return 'ACTIVE';
};

/**
 * Prepares an assistance request for one of the authenticated user's purchases.
 *
 * Stateless: nothing is persisted and no AI is involved. It only validates the
 * request and derives the current warranty status (evaluated against UTC today).
 *
 * Ownership is enforced here (never trusted from the client): the purchase is
 * looked up by id, `userId` comes exclusively from `request.userId`, and a
 * missing purchase yields 404 while someone else's purchase yields 403. The
 * warranty is loaded through the nested relation in the same query (no N+1).
 */
export const prepareAssistance = async (
  userId: string,
  purchaseId: string,
  input: AssistanceRequestInput,
  now: Date = new Date(),
) => {
  const purchase: AssistancePurchase | null = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: assistancePurchaseSelect,
  });

  if (!purchase) {
    throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  }

  if (purchase.userId !== userId) {
    throw forbidden('You do not have access to this purchase', 'PURCHASE_ACCESS_DENIED');
  }

  const today = startOfTodayUtc(now);
  const { userId: ownerId, warranty, ...publicPurchase } = purchase;
  void ownerId;

  return {
    problem: input.problem,
    warrantyStatus: resolveWarrantyStatus(warranty, today),
    purchase: publicPurchase,
    warranty: warranty ?? null,
  };
};

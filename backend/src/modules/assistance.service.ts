import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import {
  analyzeAssistance as runAnalysis,
  generateAssistanceMessage as runMessageGeneration,
  getAIProvider,
} from '../services/ai/ai.service.js';
import type { AssistanceAnalysis, AssistanceMessage } from '../services/ai/ai.schemas.js';
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
 * Loads one purchase of the authenticated user together with its warranty in a
 * single query (nested relation, no N+1) and enforces ownership.
 *
 * Ownership is never trusted from the client: a missing purchase yields 404 and
 * someone else's purchase yields 403.
 */
const loadOwnedPurchase = async (userId: string, purchaseId: string) => {
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

  const { userId: ownerId, warranty, ...publicPurchase } = purchase;
  void ownerId;

  return { publicPurchase, warranty };
};

/**
 * Prepares an assistance request for one of the authenticated user's purchases.
 *
 * Stateless: nothing is persisted and no AI is involved. It only validates the
 * request and derives the current warranty status (evaluated against UTC today).
 */
export const prepareAssistance = async (
  userId: string,
  purchaseId: string,
  input: AssistanceRequestInput,
  now: Date = new Date(),
) => {
  const { publicPurchase, warranty } = await loadOwnedPurchase(userId, purchaseId);
  const today = startOfTodayUtc(now);

  return {
    problem: input.problem,
    warrantyStatus: resolveWarrantyStatus(warranty, today),
    purchase: publicPurchase,
    warranty: warranty ?? null,
  };
};

/**
 * Produces the initial AI triage guidance for an assistance request.
 *
 * The backend computes the warranty status and sends it to the AI as the single
 * source of truth; the model only turns it into textual guidance and never
 * recalculates it. Stateless: nothing is persisted.
 */
export const analyzeAssistanceRequest = async (
  userId: string,
  purchaseId: string,
  input: AssistanceRequestInput,
  now: Date = new Date(),
): Promise<AssistanceAnalysis> => {
  const { publicPurchase, warranty } = await loadOwnedPurchase(userId, purchaseId);
  const today = startOfTodayUtc(now);
  const warrantyStatus = resolveWarrantyStatus(warranty, today);

  return runAnalysis(getAIProvider(), {
    productName: publicPurchase.productName,
    brand: publicPurchase.brand,
    model: publicPurchase.model,
    store: publicPurchase.store,
    purchaseDate: publicPurchase.purchaseDate.toISOString().slice(0, 10),
    warrantyStatus,
    warrantyStartDate: warranty ? warranty.startDate.toISOString().slice(0, 10) : null,
    warrantyEndDate: warranty ? warranty.endDate.toISOString().slice(0, 10) : null,
    problem: input.problem,
  });
};

/**
 * Generates a ready-to-send assistance message for one of the authenticated
 * user's purchases.
 *
 * It shares the exact same context as the analysis: the backend computes the
 * warranty status (single query with the nested warranty, no N+1) and sends it
 * to the AI as the source of truth. Stateless: nothing is persisted.
 */
export const generateAssistanceMessageRequest = async (
  userId: string,
  purchaseId: string,
  input: AssistanceRequestInput,
  now: Date = new Date(),
): Promise<AssistanceMessage> => {
  const { publicPurchase, warranty } = await loadOwnedPurchase(userId, purchaseId);
  const today = startOfTodayUtc(now);
  const warrantyStatus = resolveWarrantyStatus(warranty, today);

  return runMessageGeneration(getAIProvider(), {
    productName: publicPurchase.productName,
    brand: publicPurchase.brand,
    model: publicPurchase.model,
    store: publicPurchase.store,
    purchaseDate: publicPurchase.purchaseDate.toISOString().slice(0, 10),
    warrantyStatus,
    warrantyStartDate: warranty ? warranty.startDate.toISOString().slice(0, 10) : null,
    warrantyEndDate: warranty ? warranty.endDate.toISOString().slice(0, 10) : null,
    problem: input.problem,
  });
};

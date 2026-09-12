import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { badRequest, forbidden, notFound } from '../utils/http-error.js';
import type { CreatePurchaseInput, UpdatePurchaseInput } from './purchases.schemas.js';

const purchaseSelect = {
  id: true,
  productName: true,
  brand: true,
  model: true,
  serialNumber: true,
  store: true,
  purchaseDate: true,
  price: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PurchaseSelect;

// Summary of the warranty attached to a purchase. Only the factual warranty data
// is exposed — no derived status (active/expiring/expired) is computed here.
const purchaseWarrantySelect = {
  id: true,
  durationMonths: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.WarrantySelect;

// Scope of this step: the warranty relation is embedded ONLY in the listing
// query. `GET /purchases/:id`, `POST /purchases` and `PUT /purchases/:id` keep
// using the plain `purchaseSelect` and therefore keep their previous contract.
const purchaseListSelect = {
  ...purchaseSelect,
  warranty: { select: purchaseWarrantySelect },
} satisfies Prisma.PurchaseSelect;

type PurchaseListResult = Prisma.PurchaseGetPayload<{ select: typeof purchaseListSelect }>;

type PurchaseResult = Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>;

// Shared field serialization (price formatting) for every purchase response.
const serializeBase = (purchase: PurchaseResult) => ({
  ...purchase,
  price: purchase.price.toFixed(2),
});

const serializePurchase = (purchase: PurchaseResult) => serializeBase(purchase);

// Listing-only serializer: adds the warranty summary on top of the base fields.
const serializeListedPurchase = (purchase: PurchaseListResult) => ({
  ...serializeBase(purchase),
  // The optional relation resolves to `null` when the purchase has no warranty.
  warranty: purchase.warranty ?? null,
});

// PostgreSQL SQLSTATE for a foreign key violation caused by an ON DELETE RESTRICT
// constraint. Prisma reports this as a PrismaClientUnknownRequestError (not the
// KnownRequestError P2003 path), so it is matched defensively on the message.
const RESTRICT_VIOLATION_SQLSTATE = '23001';

const isRestrictForeignKeyViolation = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientUnknownRequestError)) return false;

  return (
    error.message.includes(`code: "${RESTRICT_VIOLATION_SQLSTATE}"`) ||
    (error.message.includes(RESTRICT_VIOLATION_SQLSTATE) &&
      error.message.includes('foreign key constraint'))
  );
};

const getOwnedPurchase = async (userId: string, purchaseId: string) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      ...purchaseSelect,
      userId: true,
    },
  });

  if (!purchase) {
    throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  }

  if (purchase.userId !== userId) {
    throw forbidden('You do not have access to this purchase', 'PURCHASE_ACCESS_DENIED');
  }

  const { userId: ownerId, ...publicPurchase } = purchase;
  void ownerId;
  return publicPurchase;
};

export const createPurchase = async (userId: string, input: CreatePurchaseInput) => {
  const purchase = await prisma.purchase.create({
    data: {
      ...input,
      userId,
      price: new Prisma.Decimal(input.price.toFixed(2)),
    },
    select: purchaseSelect,
  });

  return serializePurchase(purchase);
};

/**
 * Lists every purchase owned by the authenticated user together with a summary
 * of its warranty (or `null` when there is none).
 *
 * Ownership is enforced in the database query (`where: { userId }`), never by
 * fetching all rows and filtering in JavaScript.
 *
 * The warranty is loaded through the relation in the same query, so there is no
 * per-purchase follow-up request (no N+1). Ordering is unchanged:
 * `createdAt desc` with no secondary key.
 */
export const listPurchases = async (userId: string) => {
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: purchaseListSelect,
  });

  return purchases.map(serializeListedPurchase);
};

export const getPurchase = async (userId: string, purchaseId: string) => {
  const purchase = await getOwnedPurchase(userId, purchaseId);
  return serializePurchase(purchase);
};

export const updatePurchase = async (
  userId: string,
  purchaseId: string,
  input: UpdatePurchaseInput,
) => {
  await getOwnedPurchase(userId, purchaseId);

  const data = {
    ...input,
    ...(input.price === undefined ? {} : { price: new Prisma.Decimal(input.price.toFixed(2)) }),
  };

  try {
    const purchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data,
      select: purchaseSelect,
    });

    return serializePurchase(purchase);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
    }

    throw error;
  }
};

export const deletePurchase = async (userId: string, purchaseId: string) => {
  await getOwnedPurchase(userId, purchaseId);

  try {
    await prisma.purchase.delete({ where: { id: purchaseId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw badRequest(
        'Purchase cannot be deleted while it has related data',
        'PURCHASE_HAS_DEPENDENCIES',
      );
    }

    if (isRestrictForeignKeyViolation(error)) {
      throw badRequest(
        'Purchase cannot be deleted while it has related data',
        'PURCHASE_HAS_DEPENDENCIES',
      );
    }

    throw error;
  }
};

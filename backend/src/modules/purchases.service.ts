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

const serializePurchase = (
  purchase: Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>,
) => ({
  ...purchase,
  price: purchase.price.toFixed(2),
});

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

export const listPurchases = async (userId: string) => {
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: purchaseSelect,
  });

  return purchases.map(serializePurchase);
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

    throw error;
  }
};

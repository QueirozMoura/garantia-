import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error.js';
import type { CreateWarrantyInput, UpdateWarrantyInput } from './warranties.schemas.js';

const warrantySelect = {
  id: true,
  purchaseId: true,
  durationMonths: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WarrantySelect;

type WarrantyResult = Prisma.WarrantyGetPayload<{ select: typeof warrantySelect }>;

const getOwnedPurchase = async (userId: string, purchaseId: string) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { userId: true },
  });

  if (!purchase) {
    throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  }

  if (purchase.userId !== userId) {
    throw forbidden('You do not have access to this purchase', 'PURCHASE_ACCESS_DENIED');
  }
};

const getOwnedWarranty = async (userId: string, purchaseId: string) => {
  await getOwnedPurchase(userId, purchaseId);

  const warranty = await prisma.warranty.findUnique({
    where: { purchaseId },
    select: warrantySelect,
  });

  if (!warranty) {
    throw notFound('Warranty not found', 'WARRANTY_NOT_FOUND');
  }

  return warranty;
};

export const createWarranty = async (
  userId: string,
  purchaseId: string,
  input: CreateWarrantyInput,
) => {
  await getOwnedPurchase(userId, purchaseId);

  try {
    return await prisma.warranty.create({
      data: {
        purchaseId,
        durationMonths: input.durationMonths,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      select: warrantySelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('This purchase already has a warranty', 'WARRANTY_ALREADY_EXISTS');
    }

    throw error;
  }
};

export const getWarranty = async (userId: string, purchaseId: string): Promise<WarrantyResult> =>
  getOwnedWarranty(userId, purchaseId);

export const updateWarranty = async (
  userId: string,
  purchaseId: string,
  input: UpdateWarrantyInput,
) => {
  const currentWarranty = await getOwnedWarranty(userId, purchaseId);
  const startDate = input.startDate ?? currentWarranty.startDate;
  const endDate = input.endDate ?? currentWarranty.endDate;

  if (endDate < startDate) {
    throw badRequest('End date cannot be before start date', 'INVALID_WARRANTY_DATE_RANGE');
  }

  try {
    return await prisma.warranty.update({
      where: { purchaseId },
      data: input,
      select: warrantySelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Warranty not found', 'WARRANTY_NOT_FOUND');
    }

    throw error;
  }
};

export const deleteWarranty = async (userId: string, purchaseId: string) => {
  await getOwnedWarranty(userId, purchaseId);

  try {
    await prisma.warranty.delete({ where: { purchaseId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Warranty not found', 'WARRANTY_NOT_FOUND');
    }

    throw error;
  }
};

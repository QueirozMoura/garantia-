import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { forbidden, notFound } from '../utils/http-error.js';
import type { ExtractionConfirmationInput } from './extraction-confirmation.schemas.js';

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

const warrantySelect = {
  id: true,
  purchaseId: true,
  durationMonths: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WarrantySelect;

const serializePurchase = (purchase: Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>) => ({
  ...purchase,
  price: purchase.price.toFixed(2),
});

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

export const confirmExtraction = async (
  userId: string,
  documentId: string,
  input: ExtractionConfirmationInput,
) => {
  let document;
  try {
    document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { purchase: { select: { id: true, userId: true } } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
      throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
    }
    throw error;
  }

  if (!document) throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
  if (document.purchase.userId !== userId) {
    throw forbidden('You do not have access to this document', 'DOCUMENT_ACCESS_DENIED');
  }

  const result = await prisma.$transaction(async (transaction) => {
    const purchase = await transaction.purchase.update({
      where: { id: document.purchase.id },
      data: {
        productName: input.productName,
        brand: input.brand,
        model: input.model,
        purchaseDate: input.purchaseDate,
        price: new Prisma.Decimal(input.price.toFixed(2)),
        store: input.store,
        // Persiste a categoria SOMENTE quando uma categoria válida foi enviada.
        // null/ausente => mantém a categoria atual (a coluna é NOT NULL).
        ...(input.category ? { category: input.category } : {}),
      },
      select: purchaseSelect,
    });

    let warranty = await transaction.warranty.findUnique({
      where: { purchaseId: purchase.id },
      select: warrantySelect,
    });

    if (input.warrantyMonths !== null && input.warrantyMonths !== undefined) {
      const warrantyData = {
        durationMonths: input.warrantyMonths,
        startDate: input.purchaseDate,
        endDate: addMonths(input.purchaseDate, input.warrantyMonths),
      };
      warranty = warranty
        ? await transaction.warranty.update({
            where: { purchaseId: purchase.id },
            data: warrantyData,
            select: warrantySelect,
          })
        : await transaction.warranty.create({
            data: { purchaseId: purchase.id, ...warrantyData },
            select: warrantySelect,
          });
    }

    return { purchase: serializePurchase(purchase), warranty };
  });

  return result;
};

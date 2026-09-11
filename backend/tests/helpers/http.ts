import request from 'supertest';

import { app } from '../../src/app.js';
import { createAccessToken } from '../../src/config/jwt.js';
import { testPrisma } from './db.js';

export const api = () => request(app);

// Creates a user and returns it together with a valid Bearer access token.
export const createUserWithToken = async (
  overrides: Partial<{ name: string; email: string }> = {},
) => {
  const email = overrides.email ?? `user-${crypto.randomUUID()}@example.test`;
  const user = await testPrisma.user.create({
    data: {
      name: overrides.name ?? 'Test User',
      email,
    },
  });

  return { user, token: createAccessToken(user.id) };
};

// Creates a Purchase owned by userId, with a Document attached via the required metadata.
export const createPurchaseWithDocument = async (
  userId: string,
  documentType: 'INVOICE' | 'RECEIPT' | 'WARRANTY' | 'OTHER' = 'INVOICE',
) => {
  const purchase = await testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Original Product',
      brand: 'Original Brand',
      model: 'Original Model',
      serialNumber: 'SN-0001',
      store: 'Original Store',
      purchaseDate: new Date('2024-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'electronics',
    },
  });

  const document = await testPrisma.document.create({
    data: {
      purchaseId: purchase.id,
      name: 'invoice.pdf',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: '/uploads/invoice.pdf',
      type: documentType,
    },
  });

  return { purchase, document };
};

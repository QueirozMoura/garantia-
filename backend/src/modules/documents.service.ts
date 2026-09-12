import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { badRequest, forbidden, notFound } from '../utils/http-error.js';
import type { DocumentMetadataInput } from './documents.schemas.js';

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

const documentSelect = {
  id: true,
  purchaseId: true,
  name: true,
  fileName: true,
  mimeType: true,
  size: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

type DocumentResult = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

// General listing returns the document plus the basic purchase info the client
// needs to identify the product. Only the identification fields are selected,
// so internal fields such as userId, price, serialNumber and storagePath are
// never leaked.
const listDocumentSelect = {
  ...documentSelect,
  purchase: {
    select: {
      id: true,
      productName: true,
      brand: true,
      model: true,
      store: true,
      purchaseDate: true,
    },
  },
} satisfies Prisma.DocumentSelect;

const getOwnedPurchase = async (userId: string, purchaseId: string) => {
  let purchase;

  try {
    purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { userId: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
      throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
    }
    throw error;
  }

  if (!purchase) {
    throw notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  }

  if (purchase.userId !== userId) {
    throw forbidden('You do not have access to this purchase', 'PURCHASE_ACCESS_DENIED');
  }
};

const getOwnedDocument = async (userId: string, documentId: string) => {
  let document;

  try {
    document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        ...documentSelect,
        storagePath: true,
        purchase: { select: { userId: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
      throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
    }
    throw error;
  }

  if (!document) {
    throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
  }

  if (document.purchase.userId !== userId) {
    throw forbidden('You do not have access to this document', 'DOCUMENT_ACCESS_DENIED');
  }

  return document;
};

const toPublicDocument = (document: DocumentResult) => document;

const hasValidSignature = (mimeType: string, buffer: Buffer) => {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (mimeType === 'image/png')
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return false;
};

const absoluteStoragePath = (relativePath: string) => {
  const absolutePath = path.resolve(uploadsDirectory, relativePath);
  if (!absolutePath.startsWith(`${uploadsDirectory}${path.sep}`)) {
    throw badRequest('Invalid document storage path', 'INVALID_DOCUMENT_PATH');
  }
  return absolutePath;
};

export const createDocument = async (
  userId: string,
  purchaseId: string,
  input: DocumentMetadataInput,
  file: Express.Multer.File,
) => {
  await getOwnedPurchase(userId, purchaseId);

  if (!hasValidSignature(file.mimetype, file.buffer)) {
    throw badRequest('The file content does not match its MIME type', 'INVALID_DOCUMENT_CONTENT');
  }

  await mkdir(uploadsDirectory, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase();
  const storagePath = `${randomUUID()}${extension}`;
  const absolutePath = absoluteStoragePath(storagePath);

  await writeFile(absolutePath, file.buffer, { flag: 'wx' });

  try {
    const document = await prisma.document.create({
      data: {
        purchaseId,
        name: input.name,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath,
        type: input.type,
      },
      select: documentSelect,
    });

    return toPublicDocument(document);
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
};

export const listDocuments = async (userId: string, purchaseId: string) => {
  await getOwnedPurchase(userId, purchaseId);

  return prisma.document.findMany({
    where: { purchaseId },
    orderBy: { createdAt: 'desc' },
    select: documentSelect,
  });
};

/**
 * Lists every document owned by the authenticated user, with the related
 * purchase summary attached.
 *
 * Ownership is enforced in the database query (`purchase: { userId }`), never
 * by fetching all rows and filtering in JavaScript. The most recently added
 * documents come first; ties are broken deterministically by `id asc`.
 */
export const listAllDocuments = async (userId: string) =>
  prisma.document.findMany({
    where: { purchase: { userId } },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: listDocumentSelect,
  });

export const getOwnedDocumentForAI = async (userId: string, documentId: string) => {
  const document = await getOwnedDocument(userId, documentId);
  const filePath = absoluteStoragePath(document.storagePath);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw notFound('Document file not found', 'DOCUMENT_FILE_NOT_FOUND');
  }

  return { document, buffer };
};

export const getDocumentFile = async (userId: string, documentId: string) =>
  getOwnedDocumentForAI(userId, documentId);

export const deleteDocument = async (userId: string, documentId: string) => {
  const document = await getOwnedDocument(userId, documentId);
  const filePath = absoluteStoragePath(document.storagePath);

  await unlink(filePath).catch(() => undefined);
  await prisma.document.delete({ where: { id: documentId } });
};

import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { documentMetadataSchema } from './documents.schemas.js';
import * as documentsService from './documents.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

const getPurchaseId = (request: Parameters<RequestHandler>[0]) => {
  const { purchaseId } = request.params;
  if (typeof purchaseId !== 'string' || purchaseId.length === 0) {
    throw badRequest('Purchase id is required', 'PURCHASE_ID_REQUIRED');
  }
  return purchaseId;
};

const getDocumentId = (request: Parameters<RequestHandler>[0]) => {
  const { documentId } = request.params;
  if (typeof documentId !== 'string' || documentId.length === 0) {
    throw badRequest('Document id is required', 'DOCUMENT_ID_REQUIRED');
  }
  return documentId;
};

export const create: RequestHandler = async (request, response, next) => {
  try {
    if (!request.file) {
      throw badRequest('A document file is required', 'DOCUMENT_FILE_REQUIRED');
    }

    const document = await documentsService.createDocument(
      getUserId(request),
      getPurchaseId(request),
      documentMetadataSchema.parse(request.body),
      request.file,
    );
    response.status(201).json({ document });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const documents = await documentsService.listDocuments(
      getUserId(request),
      getPurchaseId(request),
    );
    response.json({ documents });
  } catch (error) {
    next(error);
  }
};

export const listAll: RequestHandler = async (request, response, next) => {
  try {
    const documents = await documentsService.listAllDocuments(getUserId(request));
    response.json({ documents });
  } catch (error) {
    next(error);
  }
};

export const download: RequestHandler = async (request, response, next) => {
  try {
    const { document, buffer } = await documentsService.getDocumentFile(
      getUserId(request),
      getDocumentId(request),
    );
    const safeFileName = document.fileName.replace(/[\r\n"]/g, '_');
    response
      .type(document.mimeType)
      .set('Content-Disposition', `inline; filename="${safeFileName}"`);
    response.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (request, response, next) => {
  try {
    await documentsService.deleteDocument(getUserId(request), getDocumentId(request));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

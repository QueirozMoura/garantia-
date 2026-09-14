import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { extractNfeInvoice } from './nfe-import.service.js';

/**
 * Recebe o arquivo XML de NF-e (multipart/form-data, campo `file`), valida e
 * interpreta o conteúdo em memória e devolve os dados extraídos da nota.
 *
 * Nada é persistido nesta etapa: nenhuma compra, garantia ou arquivo é criado.
 */
export const importNfe: RequestHandler = (request, response, next) => {
  try {
    if (!request.file) {
      throw badRequest('An XML file is required', 'NFE_FILE_REQUIRED');
    }

    const invoice = extractNfeInvoice(request.file.buffer);

    response.status(200).json({
      message: 'XML da NF-e processado com sucesso',
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

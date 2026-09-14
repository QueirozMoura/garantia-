import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { validateNfeXml } from './nfe-import.service.js';

/**
 * Recebe o arquivo XML de NF-e (multipart/form-data, campo `file`), valida o
 * conteúdo em memória e confirma o recebimento.
 *
 * Nada é persistido nesta etapa: nenhuma compra, garantia ou arquivo é criado.
 */
export const importNfe: RequestHandler = (request, response, next) => {
  try {
    if (!request.file) {
      throw badRequest('An XML file is required', 'NFE_FILE_REQUIRED');
    }

    validateNfeXml(request.file.buffer);

    response.status(200).json({ message: 'XML da NF-e recebido e validado com sucesso' });
  } catch (error) {
    next(error);
  }
};

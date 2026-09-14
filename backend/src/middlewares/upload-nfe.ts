import multer from 'multer';
import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';

/** Limite de tamanho do XML da NF-e: 5 MB. */
export const MAX_NFE_SIZE = 5 * 1024 * 1024;

// MIME types normalmente associados a XML. Navegadores enviam `text/xml` ou
// `application/xml`; alguns clientes usam `application/octet-stream`. Não
// confiamos apenas neles: a extensão e o conteúdo também são verificados.
const allowedMimeTypes = new Set(['application/xml', 'text/xml', 'application/octet-stream']);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_NFE_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();

    if (extension !== '.xml' || !allowedMimeTypes.has(file.mimetype)) {
      callback(badRequest('Only XML files are allowed', 'INVALID_NFE_TYPE'));
      return;
    }

    callback(null, true);
  },
});

const uploadSingle = upload.single('file');

/**
 * Recebe um único arquivo XML de NF-e no campo `file`.
 *
 * Usa `memoryStorage`, então o XML nunca é gravado em disco nesta etapa. Erros
 * do multer (tamanho, campo inesperado) são traduzidos para o padrão de erro da
 * API antes de chegar ao controller.
 */
export const uploadNfe: RequestHandler = (request, response, next) => {
  uploadSingle(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(badRequest('XML file must be 5 MB or smaller', 'NFE_TOO_LARGE'));
        return;
      }

      next(badRequest('Invalid XML upload', 'INVALID_NFE_UPLOAD'));
      return;
    }

    next(error);
  });
};

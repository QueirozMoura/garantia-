import multer from 'multer';
import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();

    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(
        badRequest('Only PDF, JPG, JPEG and PNG files are allowed', 'INVALID_DOCUMENT_TYPE'),
      );
      return;
    }

    callback(null, true);
  },
});

const uploadSingle = upload.single('file');

export const uploadDocument: RequestHandler = (request, response, next) => {
  uploadSingle(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(badRequest('Document file must be 10 MB or smaller', 'DOCUMENT_TOO_LARGE'));
        return;
      }

      next(badRequest('Invalid document upload', 'INVALID_DOCUMENT_UPLOAD'));
      return;
    }

    next(error);
  });
};

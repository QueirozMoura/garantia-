import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { extractRateLimiter } from '../middlewares/rate-limit.js';
import * as documentsController from './documents.controller.js';
import * as documentsExtractController from './documents-extract.controller.js';
import * as extractionConfirmationController from './extraction-confirmation.controller.js';

const router = Router();

router.use(requireAuth);
// IA: rate limit por usuário autenticado, depois do requireAuth e antes do
// controller, para bloquear a chamada ao provider de IA.
router.post('/:documentId/extract', extractRateLimiter, documentsExtractController.extract);
router.patch('/:documentId/extraction', extractionConfirmationController.confirm);
router.get('/:documentId', documentsController.download);
router.delete('/:documentId', documentsController.remove);

export default router;

import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as documentsController from './documents.controller.js';
import * as documentsExtractController from './documents-extract.controller.js';
import * as extractionConfirmationController from './extraction-confirmation.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/:documentId/extract', documentsExtractController.extract);
router.patch('/:documentId/extraction', extractionConfirmationController.confirm);
router.get('/:documentId', documentsController.download);
router.delete('/:documentId', documentsController.remove);

export default router;

import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as documentsController from './documents.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/:documentId', documentsController.download);
router.delete('/:documentId', documentsController.remove);

export default router;

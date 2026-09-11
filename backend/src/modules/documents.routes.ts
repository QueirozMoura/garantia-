import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { uploadDocument } from '../middlewares/upload.js';
import * as documentsController from './documents.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.post('/', uploadDocument, documentsController.create);
router.get('/', documentsController.list);

export default router;

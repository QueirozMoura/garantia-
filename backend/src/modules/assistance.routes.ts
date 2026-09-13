import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as assistanceController from './assistance.controller.js';

// Nested router mounted at `/purchases/:purchaseId/assistance`, mirroring the
// warranties router (mergeParams gives access to the parent `:purchaseId`).
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.post('/', assistanceController.prepare);
router.post('/analyze', assistanceController.analyze);

export default router;

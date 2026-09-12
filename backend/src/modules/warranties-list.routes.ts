import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as warrantiesController from './warranties.controller.js';

// General warranties router, mounted at the top level (`/warranties`).
// It is intentionally separate from warranties.routes.ts, which handles the
// per-purchase routes mounted at `/purchases/:purchaseId/warranty`.
const router = Router();

router.use(requireAuth);
router.get('/', warrantiesController.list);

export default router;

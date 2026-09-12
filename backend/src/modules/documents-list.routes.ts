import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as documentsController from './documents.controller.js';

// General documents router, mounted at the top level (`/documents`).
// It is intentionally separate from documents.routes.ts, which handles the
// per-purchase routes mounted at `/purchases/:purchaseId/documents` and uses
// `mergeParams: true`. Keeping them apart avoids mergeParams/route conflicts
// and mirrors the previous warranties-list pattern.
const router = Router();

router.use(requireAuth);
router.get('/', documentsController.listAll);

export default router;

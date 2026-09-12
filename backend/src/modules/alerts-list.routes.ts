import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as alertsController from './alerts.controller.js';

// General alerts router, mounted at the top level (`/alerts`).
// Alerts are derived on the fly from the user's warranties; there is no Alert
// table. It mirrors the warranties-list pattern, kept separate from the
// per-purchase routers.
const router = Router();

router.use(requireAuth);
router.get('/', alertsController.list);

export default router;

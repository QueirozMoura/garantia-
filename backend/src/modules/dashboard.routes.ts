import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', dashboardController.get);

export default router;

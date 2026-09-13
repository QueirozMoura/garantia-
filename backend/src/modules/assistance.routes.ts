import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import {
  assistanceAnalyzeRateLimiter,
  assistanceMessageRateLimiter,
} from '../middlewares/rate-limit.js';
import * as assistanceController from './assistance.controller.js';

// Nested router mounted at `/purchases/:purchaseId/assistance`, mirroring the
// warranties router (mergeParams gives access to the parent `:purchaseId`).
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.post('/', assistanceController.prepare);
// IA: rate limit por usuário autenticado, depois do requireAuth e antes do
// controller, para bloquear a chamada ao provider de IA.
router.post('/analyze', assistanceAnalyzeRateLimiter, assistanceController.analyze);
router.post('/message', assistanceMessageRateLimiter, assistanceController.generateMessage);

export default router;

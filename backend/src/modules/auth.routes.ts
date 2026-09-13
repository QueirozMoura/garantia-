import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../middlewares/rate-limit.js';
import * as authController from './auth.controller.js';

const router = Router();

// Rate limit por IP antes do controller para frear brute force/abuso de cadastro.
// Cada rota tem seu próprio contador (instâncias separadas).
router.post('/register', registerRateLimiter, authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;

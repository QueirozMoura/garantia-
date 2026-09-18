import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../middlewares/rate-limit.js';
import * as authController from './auth.controller.js';
import * as authGoogleController from './auth-google.controller.js';

const router = Router();

// Rate limit por IP antes do controller para frear brute force/abuso de cadastro.
// Cada rota tem seu próprio contador (instâncias separadas).
router.post('/register', registerRateLimiter, authController.register);
router.post('/login', loginRateLimiter, authController.login);
// Login com Google (Etapa 1): contrato preparado, validação real na Etapa 2.
// Reutiliza o limiter de login por ser outro caminho de entrada na conta.
router.post('/google', loginRateLimiter, authGoogleController.google);
// Vínculo do Google a uma conta já autenticada. Exige Bearer token (requireAuth)
// e reutiliza o limiter de login: também consome um credential do Google.
router.post(
  '/google/link',
  loginRateLimiter,
  requireAuth,
  authGoogleController.link,
);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;

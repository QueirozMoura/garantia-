import { Router } from 'express';

import { prisma } from '../config/prisma.js';

const router = Router();

router.get('/health', async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.json({
      status: 'ok',
      service: 'garantia-api',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

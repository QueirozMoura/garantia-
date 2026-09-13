import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import assistanceRoutes from './assistance.routes.js';
import documentsRoutes from './documents.routes.js';
import warrantiesRoutes from './warranties.routes.js';
import * as purchasesController from './purchases.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/', purchasesController.create);
router.get('/', purchasesController.list);
router.get('/:id', purchasesController.getById);
router.put('/:id', purchasesController.update);
router.delete('/:id', purchasesController.remove);
router.use('/:purchaseId/warranty', warrantiesRoutes);
router.use('/:purchaseId/documents', documentsRoutes);
router.use('/:purchaseId/assistance', assistanceRoutes);

export default router;

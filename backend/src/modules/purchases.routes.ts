import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as purchasesController from './purchases.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/', purchasesController.create);
router.get('/', purchasesController.list);
router.get('/:id', purchasesController.getById);
router.put('/:id', purchasesController.update);
router.delete('/:id', purchasesController.remove);

export default router;

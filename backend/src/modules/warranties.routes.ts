import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import * as warrantiesController from './warranties.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.post('/', warrantiesController.create);
router.get('/', warrantiesController.get);
router.put('/', warrantiesController.update);
router.delete('/', warrantiesController.remove);

export default router;

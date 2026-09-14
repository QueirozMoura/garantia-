import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.js';
import { uploadNfe } from '../middlewares/upload-nfe.js';
import * as nfeImportController from './nfe-import.controller.js';

const router = Router();

// Endpoint autenticado: recebe e valida um XML de NF-e (sem persistência ainda).
router.post('/import', requireAuth, uploadNfe, nfeImportController.importNfe);

export default router;

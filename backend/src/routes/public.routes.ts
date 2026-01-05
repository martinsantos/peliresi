import { Router } from 'express';
import { verificarManifiestoPublico } from '../controllers/public.controller';

const router = Router();

// Ruta pública para verificación de manifiestos (QR)
router.get('/verify/:id', verificarManifiestoPublico);

export default router;

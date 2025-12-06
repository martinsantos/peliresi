import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { generarPDFManifiesto, generarCertificado } from '../controllers/pdf.controller';

const router = Router();

router.use(isAuthenticated);

// PDF de manifiesto - disponible para todos los roles
router.get('/manifiesto/:id', generarPDFManifiesto);

// Certificado de disposición - disponible para operadores y admin
router.get('/certificado/:id', generarCertificado);

export default router;

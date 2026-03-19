import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { generarPDFManifiesto, generarCertificado } from '../controllers/pdf.controller';

const router = Router();

router.use(isAuthenticated);

/**
 * @openapi
 * /pdf/manifiesto/{id}:
 *   get:
 *     tags: [PDF]
 *     summary: Generar PDF de manifiesto
 *     description: Genera y retorna el PDF del manifiesto con todos sus datos. Disponible para todos los roles.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del manifiesto
 *     responses:
 *       200:
 *         description: Archivo PDF del manifiesto
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       404:
 *         description: Manifiesto no encontrado
 */
// PDF de manifiesto - disponible para todos los roles
router.get('/manifiesto/:id', generarPDFManifiesto);

/**
 * @openapi
 * /pdf/certificado/{id}:
 *   get:
 *     tags: [PDF]
 *     summary: Generar certificado de disposicion final
 *     description: Genera certificado de tratamiento y disposicion final (Ley 24.051). Solo disponible para manifiestos en estado TRATADO.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del manifiesto
 *     responses:
 *       200:
 *         description: Certificado PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Manifiesto no esta en estado TRATADO
 *       404:
 *         description: Manifiesto no encontrado
 */
// Certificado de disposicion - disponible para operadores y admin
router.get('/certificado/:id', generarCertificado);

export default router;

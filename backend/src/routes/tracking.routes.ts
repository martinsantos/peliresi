import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { getActividadCentroControl } from '../controllers/tracking.controller';

const router = Router();

router.use(isAuthenticated);

/**
 * @openapi
 * /centro-control/actividad:
 *   get:
 *     tags: [Centro de Control]
 *     summary: Actividad del centro de control
 *     description: Retorna actividad por capas (generadores, transportistas, operadores, transito) con estadisticas, KPIs y datos de mapa. Polling cada 30s.
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema: { type: string, format: date }
 *         description: Fecha de inicio del rango
 *       - in: query
 *         name: fechaHasta
 *         schema: { type: string, format: date }
 *         description: Fecha de fin del rango (auto-bumped a 23:59:59.999)
 *       - in: query
 *         name: capas
 *         schema: { type: string }
 *         description: Capas a incluir separadas por coma (generadores, transportistas, operadores, transito)
 *     responses:
 *       200:
 *         description: Datos del centro de control
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 generadores: { type: array, items: { type: object } }
 *                 transportistas: { type: array, items: { type: object } }
 *                 operadores: { type: array, items: { type: object } }
 *                 enTransito:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       numero: { type: string }
 *                       trackingPoints: { type: array, items: { type: object } }
 *                 estadisticas: { type: object }
 */
// Centro de Control — actividad con capas
router.get('/actividad', getActividadCentroControl);

export default router;

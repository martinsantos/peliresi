// Analytics Routes
import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    isSuperAdmin,
    getAnalyticsSummary,
    getAnalyticsLogs,
    getUserActivity,
    getManifiestosPorMes,
    getResiduosPorTipo,
    getManifiestosPorEstado,
    getTiempoPromedioPorEtapa
} from '../controllers/analytics.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * @openapi
 * /analytics/manifiestos-por-mes:
 *   get:
 *     tags: [Analytics]
 *     summary: Manifiestos creados por mes
 *     description: Retorna conteo de manifiestos creados por mes en los ultimos 12 meses. Usa raw SQL.
 *     responses:
 *       200:
 *         description: Datos mensuales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   mes: { type: string }
 *                   cantidad: { type: integer }
 */
// Dashboard analytics (any authenticated user)
router.get('/manifiestos-por-mes', getManifiestosPorMes);

/**
 * @openapi
 * /analytics/residuos-por-tipo:
 *   get:
 *     tags: [Analytics]
 *     summary: Residuos agrupados por tipo
 *     description: Retorna cantidad de residuos agrupados por tipo usando Prisma groupBy.
 *     responses:
 *       200:
 *         description: Residuos por tipo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   tipo: { type: string }
 *                   cantidad: { type: number }
 */
router.get('/residuos-por-tipo', getResiduosPorTipo);

/**
 * @openapi
 * /analytics/manifiestos-por-estado:
 *   get:
 *     tags: [Analytics]
 *     summary: Manifiestos agrupados por estado
 *     description: Retorna conteo de manifiestos por cada estado del workflow usando Prisma groupBy.
 *     responses:
 *       200:
 *         description: Manifiestos por estado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   estado: { type: string, enum: [BORRADOR, APROBADO, EN_TRANSITO, ENTREGADO, RECIBIDO, EN_TRATAMIENTO, TRATADO, RECHAZADO, CANCELADO] }
 *                   cantidad: { type: integer }
 */
router.get('/manifiestos-por-estado', getManifiestosPorEstado);

/**
 * @openapi
 * /analytics/tiempo-promedio:
 *   get:
 *     tags: [Analytics]
 *     summary: Tiempo promedio por etapa del workflow
 *     description: Calcula el tiempo promedio (en horas) entre cada transicion de estado del workflow.
 *     responses:
 *       200:
 *         description: Tiempos promedio por etapa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   etapa: { type: string }
 *                   horasPromedio: { type: number }
 */
router.get('/tiempo-promedio', getTiempoPromedioPorEtapa);

// Superadmin-only routes
router.use(isSuperAdmin);

/**
 * @openapi
 * /analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Resumen de analytics (superadmin)
 *     description: Resumen completo de metricas de uso del sistema. Solo superadmin.
 *     responses:
 *       200:
 *         description: Resumen de analytics
 *       403:
 *         description: Solo superadmin
 */
router.get('/summary', getAnalyticsSummary);

/**
 * @openapi
 * /analytics/logs:
 *   get:
 *     tags: [Analytics]
 *     summary: Logs de analytics (superadmin)
 *     description: Logs detallados de solicitudes al API. Solo superadmin.
 *     responses:
 *       200:
 *         description: Logs de analytics
 *       403:
 *         description: Solo superadmin
 */
router.get('/logs', getAnalyticsLogs);

/**
 * @openapi
 * /analytics/user/{email}:
 *   get:
 *     tags: [Analytics]
 *     summary: Actividad de usuario (superadmin)
 *     description: Retorna actividad detallada de un usuario especifico. Solo superadmin.
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *         description: Email del usuario
 *     responses:
 *       200:
 *         description: Actividad del usuario
 *       403:
 *         description: Solo superadmin
 */
router.get('/user/:email', getUserActivity);

export default router;

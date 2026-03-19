import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    reporteManifiestosPorPeriodo,
    reporteResiduosTratados,
    reporteTransporte,
    getLogAuditoria,
    exportarCSV
} from '../controllers/reporte.controller';

const router = Router();

router.use(isAuthenticated);

/**
 * @openapi
 * /reportes/manifiestos:
 *   get:
 *     tags: [Reportes]
 *     summary: Reporte de manifiestos por periodo
 *     description: Retorna manifiestos agrupados por estado y tipo de residuo con paginacion. porTipoResiduo retorna objetos con cantidad y unidad.
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         schema: { type: string, format: date }
 *         description: Fecha de inicio del periodo (YYYY-MM-DD)
 *       - in: query
 *         name: fechaFin
 *         schema: { type: string, format: date }
 *         description: Fecha de fin del periodo (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Reporte de manifiestos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 porEstado: { type: object }
 *                 porTipoResiduo: { type: object, description: 'Cada key es un tipo, valor es { cantidad, unidad }' }
 *                 manifiestos: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 */
// Reportes disponibles para todos los roles autenticados
router.get('/manifiestos', reporteManifiestosPorPeriodo);

/**
 * @openapi
 * /reportes/tratados:
 *   get:
 *     tags: [Reportes]
 *     summary: Reporte de residuos tratados
 *     description: Retorna residuos tratados agrupados por generador y tipo con paginacion.
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fechaFin
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Reporte de tratados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 porGenerador: { type: object }
 *                 totalPorTipo: { type: object, description: 'Cada key es un tipo, valor es un numero' }
 *                 detalle: { type: array, items: { type: object } }
 *                 total: { type: integer }
 */
// Reportes de operador
router.get('/tratados', reporteResiduosTratados);

/**
 * @openapi
 * /reportes/transporte:
 *   get:
 *     tags: [Reportes]
 *     summary: Reporte de transporte
 *     description: Retorna transportistas con tasa de completitud y paginacion.
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fechaFin
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Reporte de transporte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transportistas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       razonSocial: { type: string }
 *                       tasaCompletitud: { type: number }
 *                 total: { type: integer }
 */
// Reportes de transporte
router.get('/transporte', reporteTransporte);

/**
 * @openapi
 * /reportes/auditoria:
 *   get:
 *     tags: [Reportes]
 *     summary: Log de auditoria
 *     description: Retorna log de auditorias del sistema. Solo ADMIN.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Log de auditoria
 *       403:
 *         description: Solo ADMIN
 */
// Log de auditoria (solo admin)
router.get('/auditoria', hasRole('ADMIN'), getLogAuditoria);

/**
 * @openapi
 * /reportes/exportar/{tipo}:
 *   get:
 *     tags: [Reportes]
 *     summary: Exportar datos a CSV
 *     description: Exporta datos en formato CSV. Tipos disponibles - manifiestos, generadores, transportistas, operadores. Limite 10,000 filas. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema: { type: string, enum: [manifiestos, generadores, transportistas, operadores] }
 *         description: Tipo de datos a exportar
 *     responses:
 *       200:
 *         description: Archivo CSV
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *       403:
 *         description: Solo ADMIN
 */
// Exportacion CSV (solo admin)
router.get('/exportar/:tipo', hasRole('ADMIN'), exportarCSV);

export default router;

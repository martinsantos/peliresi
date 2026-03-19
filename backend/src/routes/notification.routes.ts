import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getNotificaciones,
    marcarLeida,
    marcarTodasLeidas,
    eliminarNotificacion,
    getReglasAlerta,
    crearReglaAlerta,
    actualizarReglaAlerta,
    eliminarReglaAlerta,
    getAlertasGeneradas,
    resolverAlerta,
    detectarAnomalias,
    getAnomalias,
    resolverAnomalia,
    cargaMasivaGeneradores,
    cargaMasivaTransportistas,
    cargaMasivaOperadores,
    descargarPlantilla
} from '../controllers/notification.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas las rutas requieren autenticacion
router.use(isAuthenticated);

// ============ NOTIFICACIONES ============

/**
 * @openapi
 * /notificaciones:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Listar notificaciones
 *     description: Retorna las notificaciones del usuario autenticado.
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   titulo: { type: string }
 *                   mensaje: { type: string }
 *                   leida: { type: boolean }
 *                   createdAt: { type: string, format: date-time }
 */
router.get('/notificaciones', getNotificaciones);

/**
 * @openapi
 * /notificaciones/{id}/leida:
 *   put:
 *     tags: [Notificaciones]
 *     summary: Marcar notificacion como leida
 *     description: Marca una notificacion especifica como leida.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notificacion marcada como leida
 */
router.put('/notificaciones/:id/leida', marcarLeida);

/**
 * @openapi
 * /notificaciones/todas-leidas:
 *   put:
 *     tags: [Notificaciones]
 *     summary: Marcar todas las notificaciones como leidas
 *     description: Marca todas las notificaciones del usuario como leidas.
 *     responses:
 *       200:
 *         description: Todas las notificaciones marcadas como leidas
 */
router.put('/notificaciones/todas-leidas', marcarTodasLeidas);

/**
 * @openapi
 * /notificaciones/{id}:
 *   delete:
 *     tags: [Notificaciones]
 *     summary: Eliminar notificacion
 *     description: Elimina una notificacion del usuario.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notificacion eliminada
 */
router.delete('/notificaciones/:id', eliminarNotificacion);

// ============ REGLAS DE ALERTA (Solo Admin) ============

/**
 * @openapi
 * /alertas/reglas:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Listar reglas de alerta
 *     description: Retorna las reglas de alerta configuradas. Solo ADMIN.
 *     responses:
 *       200:
 *         description: Lista de reglas de alerta
 *       403:
 *         description: Solo ADMIN
 */
router.get('/alertas/reglas', hasRole('ADMIN'), getReglasAlerta);

/**
 * @openapi
 * /alertas/reglas:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Crear regla de alerta
 *     description: Configura una nueva regla de alerta automatica. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, tipo, condicion]
 *             properties:
 *               nombre: { type: string }
 *               tipo: { type: string }
 *               condicion: { type: object }
 *               activa: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Regla creada
 *       403:
 *         description: Solo ADMIN
 */
router.post('/alertas/reglas', hasRole('ADMIN'), crearReglaAlerta);

/**
 * @openapi
 * /alertas/reglas/{id}:
 *   put:
 *     tags: [Notificaciones]
 *     summary: Actualizar regla de alerta
 *     description: Modifica una regla de alerta existente. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               tipo: { type: string }
 *               condicion: { type: object }
 *               activa: { type: boolean }
 *     responses:
 *       200:
 *         description: Regla actualizada
 *       403:
 *         description: Solo ADMIN
 */
router.put('/alertas/reglas/:id', hasRole('ADMIN'), actualizarReglaAlerta);

/**
 * @openapi
 * /alertas/reglas/{id}:
 *   delete:
 *     tags: [Notificaciones]
 *     summary: Eliminar regla de alerta
 *     description: Elimina una regla de alerta. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Regla eliminada
 *       403:
 *         description: Solo ADMIN
 */
router.delete('/alertas/reglas/:id', hasRole('ADMIN'), eliminarReglaAlerta);

// ============ ALERTAS GENERADAS ============

/**
 * @openapi
 * /alertas:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Listar alertas generadas
 *     description: Retorna alertas generadas automaticamente por el sistema. Solo ADMIN.
 *     responses:
 *       200:
 *         description: Lista de alertas
 *       403:
 *         description: Solo ADMIN
 */
router.get('/alertas', hasRole('ADMIN'), getAlertasGeneradas);

/**
 * @openapi
 * /alertas/{id}/resolver:
 *   put:
 *     tags: [Notificaciones]
 *     summary: Resolver alerta
 *     description: Marca una alerta como resuelta. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alerta resuelta
 *       403:
 *         description: Solo ADMIN
 */
router.put('/alertas/:id/resolver', hasRole('ADMIN'), resolverAlerta);

// ============ ANOMALIAS DE TRANSPORTE ============

/**
 * @openapi
 * /anomalias/detectar/{manifiestoId}:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Detectar anomalias en transporte
 *     description: Ejecuta deteccion de anomalias para un manifiesto en transito. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: manifiestoId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Anomalias detectadas
 *       403:
 *         description: Solo ADMIN
 */
router.post('/anomalias/detectar/:manifiestoId', hasRole('ADMIN'), detectarAnomalias);

/**
 * @openapi
 * /anomalias/{manifiestoId}:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Listar anomalias de un manifiesto
 *     description: Retorna anomalias de transporte detectadas para un manifiesto.
 *     parameters:
 *       - in: path
 *         name: manifiestoId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de anomalias
 */
router.get('/anomalias/:manifiestoId', getAnomalias);

/**
 * @openapi
 * /anomalias/{id}/resolver:
 *   put:
 *     tags: [Notificaciones]
 *     summary: Resolver anomalia
 *     description: Marca una anomalia como resuelta. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Anomalia resuelta
 *       403:
 *         description: Solo ADMIN
 */
router.put('/anomalias/:id/resolver', hasRole('ADMIN'), resolverAnomalia);

// ============ CARGA MASIVA (Solo Admin) ============

/**
 * @openapi
 * /carga-masiva/generadores:
 *   post:
 *     tags: [Carga Masiva]
 *     summary: Carga masiva de generadores
 *     description: Importa generadores desde archivo CSV/Excel. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *                 description: Archivo CSV o Excel con datos de generadores
 *     responses:
 *       200:
 *         description: Resultado de la importacion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 importados: { type: integer }
 *                 errores: { type: array, items: { type: object } }
 *       403:
 *         description: Solo ADMIN
 */
router.post('/carga-masiva/generadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaGeneradores);

/**
 * @openapi
 * /carga-masiva/transportistas:
 *   post:
 *     tags: [Carga Masiva]
 *     summary: Carga masiva de transportistas
 *     description: Importa transportistas desde archivo CSV/Excel. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resultado de la importacion
 *       403:
 *         description: Solo ADMIN
 */
router.post('/carga-masiva/transportistas', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaTransportistas);

/**
 * @openapi
 * /carga-masiva/operadores:
 *   post:
 *     tags: [Carga Masiva]
 *     summary: Carga masiva de operadores
 *     description: Importa operadores desde archivo CSV/Excel. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resultado de la importacion
 *       403:
 *         description: Solo ADMIN
 */
router.post('/carga-masiva/operadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaOperadores);

/**
 * @openapi
 * /carga-masiva/plantilla/{tipo}:
 *   get:
 *     tags: [Carga Masiva]
 *     summary: Descargar plantilla CSV
 *     description: Descarga plantilla CSV para carga masiva del tipo especificado. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema: { type: string, enum: [generadores, transportistas, operadores] }
 *     responses:
 *       200:
 *         description: Archivo CSV plantilla
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *       403:
 *         description: Solo ADMIN
 */
router.get('/carga-masiva/plantilla/:tipo', hasRole('ADMIN'), descargarPlantilla);

export default router;

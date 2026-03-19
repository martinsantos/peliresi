import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    verificarManifiesto,
    getManifiestos,
    getManifiestoById,
    createManifiesto,
    updateManifiesto,
    deleteManifiesto,
    getViajeActual,
    firmarManifiesto,
    confirmarRetiro,
    actualizarUbicacion,
    confirmarEntrega,
    confirmarRecepcion,
    cerrarManifiesto,
    getDashboardStats,
    rechazarCarga,
    registrarIncidente,
    registrarTratamiento,
    registrarPesaje,
    getSyncInicial,
    getManifiestosEsperados,
    validarQR,
    revertirEstado
} from '../controllers/manifiesto.controller';

const router = Router();

/**
 * @openapi
 * /manifiestos/verificar/{numero}:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Verificacion publica de manifiesto
 *     description: Permite verificar un manifiesto por su numero sin autenticacion. Usado para verificacion via QR.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: numero
 *         required: true
 *         schema: { type: string }
 *         description: Numero del manifiesto (ej. MAN-2026-000001)
 *     responses:
 *       200:
 *         description: Datos publicos del manifiesto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 numero: { type: string }
 *                 estado: { type: string }
 *                 generador: { type: string }
 *                 transportista: { type: string }
 *                 operador: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *       404:
 *         description: Manifiesto no encontrado
 */
// Ruta PUBLICA (sin auth) — verificacion de manifiesto via QR
router.get('/verificar/:numero', verificarManifiesto);

// Todas las rutas siguientes requieren autenticacion
router.use(isAuthenticated);

/**
 * @openapi
 * /manifiestos/dashboard:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Estadisticas del dashboard
 *     description: Retorna contadores por estado, manifiestos recientes y lista de manifiestos en transito.
 *     responses:
 *       200:
 *         description: Estadisticas del dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 borradores: { type: integer }
 *                 aprobados: { type: integer }
 *                 enTransito: { type: integer }
 *                 entregados: { type: integer }
 *                 recibidos: { type: integer }
 *                 tratados: { type: integer }
 *                 total: { type: integer }
 *                 recientes:
 *                   type: array
 *                   items: { type: object }
 *                 enTransitoList:
 *                   type: array
 *                   items: { type: object }
 */
// Dashboard
router.get('/dashboard', getDashboardStats);

/**
 * @openapi
 * /manifiestos/sync-inicial:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Sincronizacion inicial para modo offline
 *     description: Descarga tablas maestras (tipos residuos, actores) para soporte offline en PWA.
 *     responses:
 *       200:
 *         description: Datos maestros para offline
 */
// ========== NUEVAS RUTAS PARA SOPORTE OFFLINE (CU-T01, CU-O03) ==========
// Sincronizacion inicial - descarga tablas maestras para offline
router.get('/sync-inicial', getSyncInicial);

/**
 * @openapi
 * /manifiestos/esperados:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Manifiestos esperados para validacion QR
 *     description: Lista de manifiestos que el operador espera recibir. Solo OPERADOR y ADMIN.
 *     responses:
 *       200:
 *         description: Lista de manifiestos esperados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   numero: { type: string }
 *                   estado: { type: string }
 *       403:
 *         description: Rol no autorizado
 */
// Lista de manifiestos esperados para validacion QR offline
router.get('/esperados', hasRole('OPERADOR', 'ADMIN'), getManifiestosEsperados);

/**
 * @openapi
 * /manifiestos/validar-qr:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Validar codigo QR de manifiesto
 *     description: Valida el contenido de un codigo QR escaneado contra los manifiestos del sistema.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrData]
 *             properties:
 *               qrData: { type: string, description: Contenido del codigo QR }
 *     responses:
 *       200:
 *         description: Resultado de la validacion
 *       400:
 *         description: QR invalido
 */
// Validar codigo QR de manifiesto
router.post('/validar-qr', validarQR);

/**
 * @openapi
 * /manifiestos:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Listar manifiestos
 *     description: Lista paginada de manifiestos. Filtrada automaticamente por rol del usuario.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Numero de pagina
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Registros por pagina
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [BORRADOR, APROBADO, EN_TRANSITO, ENTREGADO, RECIBIDO, EN_TRATAMIENTO, TRATADO, RECHAZADO, CANCELADO] }
 *         description: Filtrar por estado
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por numero de manifiesto
 *     responses:
 *       200:
 *         description: Lista de manifiestos con paginacion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { type: object }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 */
// Manifiestos CRUD
router.get('/', getManifiestos);

/**
 * @openapi
 * /manifiestos/{id}:
 *   get:
 *     tags: [Manifiestos]
 *     summary: Obtener manifiesto por ID
 *     description: Retorna el detalle completo de un manifiesto incluyendo residuos, actores y eventos.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del manifiesto
 *     responses:
 *       200:
 *         description: Detalle del manifiesto
 *       404:
 *         description: Manifiesto no encontrado
 */
router.get('/:id', getManifiestoById);

/**
 * @openapi
 * /manifiestos:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Crear nuevo manifiesto
 *     description: Crea un manifiesto en estado BORRADOR. Solo GENERADOR y ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [generadorId, transportistaId, operadorId, residuos]
 *             properties:
 *               generadorId: { type: string, description: ID del generador }
 *               transportistaId: { type: string, description: ID del transportista }
 *               operadorId: { type: string, description: ID del operador }
 *               residuos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipoResiduoId: { type: string }
 *                     cantidad: { type: number }
 *                     unidad: { type: string }
 *     responses:
 *       201:
 *         description: Manifiesto creado
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: Rol no autorizado
 */
router.post('/', hasRole('GENERADOR', 'ADMIN'), createManifiesto);

/**
 * @openapi
 * /manifiestos/{id}:
 *   put:
 *     tags: [Manifiestos]
 *     summary: Editar manifiesto
 *     description: Edita un manifiesto existente. Solo permitido en estado BORRADOR. Reemplaza residuos via transaccion.
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
 *               transportistaId: { type: string }
 *               operadorId: { type: string }
 *               residuos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipoResiduoId: { type: string }
 *                     cantidad: { type: number }
 *                     unidad: { type: string }
 *     responses:
 *       200:
 *         description: Manifiesto actualizado
 *       400:
 *         description: Solo se puede editar en estado BORRADOR
 *       404:
 *         description: Manifiesto no encontrado
 */
router.put('/:id', hasRole('GENERADOR', 'ADMIN'), updateManifiesto);

/**
 * @openapi
 * /manifiestos/{id}:
 *   delete:
 *     tags: [Manifiestos]
 *     summary: Eliminar manifiesto
 *     description: Elimina un manifiesto. Solo permitido en estados BORRADOR o CANCELADO. Cascading delete.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Manifiesto eliminado
 *       400:
 *         description: No se puede eliminar en el estado actual
 *       404:
 *         description: Manifiesto no encontrado
 */
router.delete('/:id', hasRole('GENERADOR', 'ADMIN'), deleteManifiesto);

/**
 * @openapi
 * /manifiestos/{id}/viaje-actual:
 *   get:
 *     tags: [Manifiestos]
 *     summary: GPS tracking del viaje actual
 *     description: Retorna puntos GPS del viaje de un manifiesto. Limite 500 puntos ordenados por timestamp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Puntos GPS del viaje
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   latitud: { type: number }
 *                   longitud: { type: number }
 *                   velocidad: { type: number }
 *                   direccion: { type: string }
 *                   timestamp: { type: string, format: date-time }
 */
// Tracking del viaje actual
router.get('/:id/viaje-actual', getViajeActual);

/**
 * @openapi
 * /manifiestos/{id}/firmar:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Firmar/Aprobar manifiesto
 *     description: Cambia estado de BORRADOR a APROBADO. Solo GENERADOR y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Manifiesto aprobado
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
// Flujo de manifiesto - Generador (ADMIN puede ejecutar todas las acciones)
router.post('/:id/firmar', hasRole('GENERADOR', 'ADMIN'), firmarManifiesto);

/**
 * @openapi
 * /manifiestos/{id}/confirmar-retiro:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Confirmar retiro de residuos
 *     description: Cambia estado de APROBADO a EN_TRANSITO. Inicia tracking GPS. Solo TRANSPORTISTA y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Retiro confirmado, transito iniciado
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
// Flujo de manifiesto - Transportista
router.post('/:id/confirmar-retiro', hasRole('TRANSPORTISTA', 'ADMIN'), confirmarRetiro);

/**
 * @openapi
 * /manifiestos/{id}/ubicacion:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Actualizar ubicacion GPS
 *     description: Envia posicion GPS del transportista durante el viaje. Solo para manifiestos EN_TRANSITO. Cache in-memory 30s TTL.
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
 *             required: [latitud, longitud]
 *             properties:
 *               latitud: { type: number, example: -32.8895 }
 *               longitud: { type: number, example: -68.8458 }
 *               velocidad: { type: number, example: 60.5 }
 *               direccion: { type: string, example: Norte }
 *     responses:
 *       200:
 *         description: Ubicacion registrada
 *       400:
 *         description: Manifiesto no esta EN_TRANSITO
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/ubicacion', hasRole('TRANSPORTISTA', 'ADMIN'), actualizarUbicacion);

/**
 * @openapi
 * /manifiestos/{id}/confirmar-entrega:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Confirmar entrega de residuos
 *     description: Cambia estado de EN_TRANSITO a ENTREGADO. Solo TRANSPORTISTA y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Entrega confirmada
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/confirmar-entrega', hasRole('TRANSPORTISTA', 'ADMIN'), confirmarEntrega);

/**
 * @openapi
 * /manifiestos/{id}/incidente:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Registrar incidente en transito
 *     description: Registra un incidente durante el viaje. No cambia el estado del manifiesto. Acepta campo tipo o tipoIncidente.
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
 *               tipo: { type: string, description: Tipo de incidente (AVERIA, PAUSA, REANUDACION, OTRO) }
 *               tipoIncidente: { type: string, description: Alias de tipo }
 *               descripcion: { type: string }
 *               latitud: { type: number }
 *               longitud: { type: number }
 *     responses:
 *       200:
 *         description: Incidente registrado
 *       400:
 *         description: Manifiesto no esta EN_TRANSITO
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/incidente', hasRole('TRANSPORTISTA', 'ADMIN'), registrarIncidente);

/**
 * @openapi
 * /manifiestos/{id}/confirmar-recepcion:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Confirmar recepcion en planta
 *     description: Cambia estado de ENTREGADO a RECIBIDO. Solo OPERADOR y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Recepcion confirmada
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
// Flujo de manifiesto - Operador
router.post('/:id/confirmar-recepcion', hasRole('OPERADOR', 'ADMIN'), confirmarRecepcion);

/**
 * @openapi
 * /manifiestos/{id}/pesaje:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Registrar pesaje en planta
 *     description: Actualiza los pesos de los residuos al llegar a planta. Solo OPERADOR y ADMIN.
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
 *               pesajes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     residuoId: { type: string }
 *                     pesoRecibido: { type: number }
 *     responses:
 *       200:
 *         description: Pesaje registrado
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/pesaje', hasRole('OPERADOR', 'ADMIN'), registrarPesaje);

/**
 * @openapi
 * /manifiestos/{id}/rechazar:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Rechazar carga
 *     description: Cambia estado de ENTREGADO a RECHAZADO. Solo OPERADOR y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo: { type: string, description: Motivo del rechazo }
 *     responses:
 *       200:
 *         description: Carga rechazada
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/rechazar', hasRole('OPERADOR', 'ADMIN'), rechazarCarga);

/**
 * @openapi
 * /manifiestos/{id}/tratamiento:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Registrar inicio de tratamiento
 *     description: Cambia estado de RECIBIDO a EN_TRATAMIENTO. Solo OPERADOR y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tratamiento iniciado
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/tratamiento', hasRole('OPERADOR', 'ADMIN'), registrarTratamiento);

/**
 * @openapi
 * /manifiestos/{id}/cerrar:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Cerrar manifiesto (tratamiento completado)
 *     description: Cambia estado de EN_TRATAMIENTO o RECIBIDO a TRATADO. Solo OPERADOR y ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Manifiesto cerrado/tratado
 *       400:
 *         description: Estado invalido para esta accion
 *       403:
 *         description: Rol no autorizado
 */
router.post('/:id/cerrar', hasRole('OPERADOR', 'ADMIN'), cerrarManifiesto);

/**
 * @openapi
 * /manifiestos/{id}/revertir-estado:
 *   post:
 *     tags: [Manifiestos]
 *     summary: Revertir estado del manifiesto
 *     description: Revierte el manifiesto al estado anterior. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estado revertido
 *       400:
 *         description: No se puede revertir
 *       403:
 *         description: Solo ADMIN
 */
// Reversion de estado (solo ADMIN)
router.post('/:id/revertir-estado', hasRole('ADMIN'), revertirEstado);

export default router;

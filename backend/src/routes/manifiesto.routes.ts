import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getManifiestos,
    getManifiestoById,
    createManifiesto,
    firmarManifiesto,
    confirmarRecepcion,
    cerrarManifiesto,
    getDashboardStats,
    getSyncInicial,
    getManifiestosEsperados,
    validarQR,
    rechazarCarga,
    registrarPesaje,
    registrarTratamiento,
    enviarAprobacion,
    aprobarManifiesto,
    rechazarAprobacion,
    getManifiestosPendientes
} from '../controllers/manifiesto.controller';
import {
    actualizarUbicacion,
    registrarIncidente,
    confirmarRetiro,
    confirmarEntrega
} from '../controllers/logistics.controller';
import { generarCertificado } from '../controllers/pdf.controller';
import {
    revertirEntrega,
    rechazarRecepcion,
    revertirCertificado,
    revertirEstadoAdmin,
    getHistorialReversiones
} from '../controllers/reversion.controller';

const router = Router();

router.use(isAuthenticated);

// Dashboard y Utilidades
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard', getDashboardStats);
router.get('/sync-inicial', getSyncInicial);
router.get('/esperados', hasRole('OPERADOR'), getManifiestosEsperados);
router.post('/validar-qr', validarQR);

// ============================================================
// FLUJO DE APROBACIÓN DGFA (CU-G06, CU-A04)
// Rutas específicas ANTES de /:id para evitar conflictos
// ============================================================
router.get('/pendientes/aprobacion', hasRole('ADMIN'), getManifiestosPendientes);

// CRUD de Manifiestos
router.get('/', getManifiestos);
router.get('/:id', getManifiestoById);
router.post('/', hasRole('GENERADOR'), createManifiesto);
router.post('/:id/firmar', hasRole('GENERADOR'), firmarManifiesto);
router.post('/:id/enviar-aprobacion', hasRole('GENERADOR'), enviarAprobacion);
router.post('/:id/aprobar', hasRole('ADMIN'), aprobarManifiesto);
router.post('/:id/rechazar-aprobacion', hasRole('ADMIN'), rechazarAprobacion);

// ============================================================
// TRANSPORTISTA: Retiro, Transporte y Entrega
// ============================================================
router.post('/:id/confirmar-retiro', hasRole('TRANSPORTISTA'), confirmarRetiro);
router.post('/:id/confirmar-entrega', hasRole('TRANSPORTISTA'), confirmarEntrega);
router.post('/:id/ubicacion', hasRole('TRANSPORTISTA'), actualizarUbicacion);
router.post('/:id/incidente', hasRole('TRANSPORTISTA'), registrarIncidente);

// ============================================================
// OPERADOR: Recepción, Pesaje, Tratamiento y Cierre
// ============================================================
router.post('/:id/confirmar-recepcion', hasRole('OPERADOR'), confirmarRecepcion);
router.post('/:id/pesaje', hasRole('OPERADOR'), registrarPesaje);
router.post('/:id/rechazar', hasRole('OPERADOR'), rechazarCarga);
router.post('/:id/tratamiento', hasRole('OPERADOR'), registrarTratamiento);
router.post('/:id/cerrar', hasRole('OPERADOR'), cerrarManifiesto);

// Certificado de disposición final (PDF)
router.get('/:id/certificado', generarCertificado);

// ============================================================
// REVERSIONES DE ESTADO
// ============================================================
// Revertir entrega: ENTREGADO -> EN_TRANSITO
// Permitido: TRANSPORTISTA, OPERADOR (quien rechaza), ADMIN, ADMIN_TRANSPORTISTAS, ADMIN_OPERADORES
router.post('/:id/revertir-entrega', hasRole('TRANSPORTISTA', 'OPERADOR', 'ADMIN', 'ADMIN_TRANSPORTISTAS', 'ADMIN_OPERADORES'), revertirEntrega);

// Operador: Rechazar recepción (volver a ENTREGADO)
// Permitido: OPERADOR, ADMIN, ADMIN_OPERADORES
router.post('/:id/rechazar-recepcion', hasRole('OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'), rechazarRecepcion);

// Operador: Revertir certificado/tratamiento
// Permitido: OPERADOR, ADMIN, ADMIN_OPERADORES
router.post('/:id/revertir-certificado', hasRole('OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'), revertirCertificado);

// Admin: Revertir a cualquier estado
router.post('/:id/revertir-estado', hasRole('ADMIN'), revertirEstadoAdmin);

// Historial de reversiones
router.get('/:id/reversiones', getHistorialReversiones);

export default router;

import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getManifiestos,
    getManifiestoById,
    createManifiesto,
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

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Dashboard
router.get('/dashboard', getDashboardStats);

// ========== NUEVAS RUTAS PARA SOPORTE OFFLINE (CU-T01, CU-O03) ==========
// Sincronización inicial - descarga tablas maestras para offline
router.get('/sync-inicial', getSyncInicial);
// Lista de manifiestos esperados para validación QR offline
router.get('/esperados', hasRole('OPERADOR', 'ADMIN'), getManifiestosEsperados);
// Validar código QR de manifiesto
router.post('/validar-qr', validarQR);

// Manifiestos
router.get('/', getManifiestos);
router.get('/:id', getManifiestoById);
router.post('/', hasRole('GENERADOR', 'ADMIN'), createManifiesto);

// Flujo de manifiesto - Generador (ADMIN puede ejecutar todas las acciones)
router.post('/:id/firmar', hasRole('GENERADOR', 'ADMIN'), firmarManifiesto);

// Flujo de manifiesto - Transportista
router.post('/:id/confirmar-retiro', hasRole('TRANSPORTISTA', 'ADMIN'), confirmarRetiro);
router.post('/:id/ubicacion', hasRole('TRANSPORTISTA', 'ADMIN'), actualizarUbicacion);
router.post('/:id/confirmar-entrega', hasRole('TRANSPORTISTA', 'ADMIN'), confirmarEntrega);
router.post('/:id/incidente', hasRole('TRANSPORTISTA', 'ADMIN'), registrarIncidente);

// Flujo de manifiesto - Operador
router.post('/:id/confirmar-recepcion', hasRole('OPERADOR', 'ADMIN'), confirmarRecepcion);
router.post('/:id/pesaje', hasRole('OPERADOR', 'ADMIN'), registrarPesaje);
router.post('/:id/rechazar', hasRole('OPERADOR', 'ADMIN'), rechazarCarga);
router.post('/:id/tratamiento', hasRole('OPERADOR', 'ADMIN'), registrarTratamiento);
router.post('/:id/cerrar', hasRole('OPERADOR', 'ADMIN'), cerrarManifiesto);

// Reversión de estado (solo ADMIN)
router.post('/:id/revertir-estado', hasRole('ADMIN'), revertirEstado);

export default router;

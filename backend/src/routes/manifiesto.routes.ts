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
    validarQR
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
router.get('/esperados', hasRole('OPERADOR'), getManifiestosEsperados);
// Validar código QR de manifiesto
router.post('/validar-qr', validarQR);

// Manifiestos
router.get('/', getManifiestos);
router.get('/:id', getManifiestoById);
router.post('/', hasRole('GENERADOR'), createManifiesto);

// Flujo de manifiesto - Generador
router.post('/:id/firmar', hasRole('GENERADOR'), firmarManifiesto);

// Flujo de manifiesto - Transportista
router.post('/:id/confirmar-retiro', hasRole('TRANSPORTISTA'), confirmarRetiro);
router.post('/:id/ubicacion', hasRole('TRANSPORTISTA'), actualizarUbicacion);
router.post('/:id/confirmar-entrega', hasRole('TRANSPORTISTA'), confirmarEntrega);
router.post('/:id/incidente', hasRole('TRANSPORTISTA'), registrarIncidente);

// Flujo de manifiesto - Operador
router.post('/:id/confirmar-recepcion', hasRole('OPERADOR'), confirmarRecepcion);
router.post('/:id/pesaje', hasRole('OPERADOR'), registrarPesaje);
router.post('/:id/rechazar', hasRole('OPERADOR'), rechazarCarga);
router.post('/:id/tratamiento', hasRole('OPERADOR'), registrarTratamiento);
router.post('/:id/cerrar', hasRole('OPERADOR'), cerrarManifiesto);

export default router;

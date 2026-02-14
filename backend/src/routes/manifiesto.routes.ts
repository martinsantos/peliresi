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

// Ruta PUBLICA (sin auth) — verificación de manifiesto via QR
router.get('/verificar/:numero', verificarManifiesto);

// Todas las rutas siguientes requieren autenticación
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

// Manifiestos CRUD
router.get('/', getManifiestos);
router.get('/:id', getManifiestoById);
router.post('/', hasRole('GENERADOR', 'ADMIN'), createManifiesto);
router.put('/:id', hasRole('GENERADOR', 'ADMIN'), updateManifiesto);
router.delete('/:id', hasRole('GENERADOR', 'ADMIN'), deleteManifiesto);

// Tracking del viaje actual
router.get('/:id/viaje-actual', getViajeActual);

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

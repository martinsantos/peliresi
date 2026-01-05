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
    registrarTratamiento
} from '../controllers/manifiesto.controller';
import {
    actualizarUbicacion,
    registrarIncidente,
    confirmarRetiro,
    confirmarEntrega
} from '../controllers/logistics.controller';

const router = Router();

router.use(isAuthenticated);

// Dashboard y Utilidades
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard', getDashboardStats);
router.get('/sync-inicial', getSyncInicial);
router.get('/esperados', hasRole('OPERADOR'), getManifiestosEsperados);
router.post('/validar-qr', validarQR);

// CRUD de Manifiestos
router.get('/', getManifiestos);
router.get('/:id', getManifiestoById);
router.post('/', hasRole('GENERADOR'), createManifiesto);
router.post('/:id/firmar', hasRole('GENERADOR'), firmarManifiesto);

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

export default router;

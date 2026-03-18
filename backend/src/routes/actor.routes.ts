import { Router } from 'express';
import { isAuthenticated, requireAdminOrTransportista, requireAdminOrGenerador, requireAdminOrOperador } from '../middlewares/auth.middleware';
import {
    getGeneradores, getGeneradorById, createGenerador, updateGenerador, deleteGenerador,
    getTransportistas, getTransportistaById, createTransportista, updateTransportista, deleteTransportista,
    addVehiculo, updateVehiculo, deleteVehiculo,
    addChofer, updateChofer, deleteChofer,
    getOperadores, getOperadorById, createOperador, updateOperador, deleteOperador
} from '../controllers/actor.controller';

const router = Router();
router.use(isAuthenticated);

// ===== GENERADORES =====
router.get('/generadores', getGeneradores);
router.get('/generadores/:id', getGeneradorById);
router.post('/generadores',      requireAdminOrGenerador, createGenerador);
router.put('/generadores/:id',   requireAdminOrGenerador, updateGenerador);
router.delete('/generadores/:id', requireAdminOrGenerador, deleteGenerador);

// ===== TRANSPORTISTAS =====
router.get('/transportistas', getTransportistas);
router.get('/transportistas/:id', getTransportistaById);
router.post('/transportistas',           requireAdminOrTransportista, createTransportista);
router.put('/transportistas/:id',        requireAdminOrTransportista, updateTransportista);
router.delete('/transportistas/:id',     requireAdminOrTransportista, deleteTransportista);
router.post('/transportistas/:id/vehiculos',           requireAdminOrTransportista, addVehiculo);
router.put('/transportistas/:id/vehiculos/:vehiculoId', requireAdminOrTransportista, updateVehiculo);
router.delete('/transportistas/:id/vehiculos/:vehiculoId', requireAdminOrTransportista, deleteVehiculo);
router.post('/transportistas/:id/choferes',          requireAdminOrTransportista, addChofer);
router.put('/transportistas/:id/choferes/:choferId', requireAdminOrTransportista, updateChofer);
router.delete('/transportistas/:id/choferes/:choferId', requireAdminOrTransportista, deleteChofer);

// ===== OPERADORES =====
router.get('/operadores', getOperadores);
router.get('/operadores/:id', getOperadorById);
router.post('/operadores',       requireAdminOrOperador, createOperador);
router.put('/operadores/:id',    requireAdminOrOperador, updateOperador);
router.delete('/operadores/:id', requireAdminOrOperador, deleteOperador);

export default router;

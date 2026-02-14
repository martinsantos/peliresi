import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getGeneradores,
    getGeneradorById,
    createGenerador,
    updateGenerador,
    deleteGenerador,
    getTransportistas,
    getTransportistaById,
    createTransportista,
    updateTransportista,
    deleteTransportista,
    addVehiculo,
    updateVehiculo,
    deleteVehiculo,
    addChofer,
    updateChofer,
    deleteChofer,
    getOperadores,
    getOperadorById,
    createOperador,
    updateOperador,
    deleteOperador
} from '../controllers/actor.controller';

const router = Router();

router.use(isAuthenticated);

// ===== GENERADORES =====
router.get('/generadores', getGeneradores);
router.get('/generadores/:id', getGeneradorById);
router.post('/generadores', hasRole('ADMIN'), createGenerador);
router.put('/generadores/:id', hasRole('ADMIN'), updateGenerador);
router.delete('/generadores/:id', hasRole('ADMIN'), deleteGenerador);

// ===== TRANSPORTISTAS =====
router.get('/transportistas', getTransportistas);
router.get('/transportistas/:id', getTransportistaById);
router.post('/transportistas', hasRole('ADMIN'), createTransportista);
router.put('/transportistas/:id', hasRole('ADMIN'), updateTransportista);
router.delete('/transportistas/:id', hasRole('ADMIN'), deleteTransportista);
router.post('/transportistas/:id/vehiculos', hasRole('ADMIN'), addVehiculo);
router.put('/transportistas/:id/vehiculos/:vehiculoId', hasRole('ADMIN'), updateVehiculo);
router.delete('/transportistas/:id/vehiculos/:vehiculoId', hasRole('ADMIN'), deleteVehiculo);
router.post('/transportistas/:id/choferes', hasRole('ADMIN'), addChofer);
router.put('/transportistas/:id/choferes/:choferId', hasRole('ADMIN'), updateChofer);
router.delete('/transportistas/:id/choferes/:choferId', hasRole('ADMIN'), deleteChofer);

// ===== OPERADORES =====
router.get('/operadores', getOperadores);
router.get('/operadores/:id', getOperadorById);
router.post('/operadores', hasRole('ADMIN'), createOperador);
router.put('/operadores/:id', hasRole('ADMIN'), updateOperador);
router.delete('/operadores/:id', hasRole('ADMIN'), deleteOperador);

export default router;

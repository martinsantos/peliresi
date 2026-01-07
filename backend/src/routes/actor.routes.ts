import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getGeneradores,
    createGenerador,
    updateGenerador,
    deleteGenerador,
    getTransportistas,
    createTransportista,
    updateTransportista,
    addVehiculo,
    addChofer,
    getOperadores,
    createOperador,
    updateOperador,
    deleteOperador,
    cargaMasivaGeneradores,
    cargaMasivaTransportistas,
    cargaMasivaOperadores,
    descargarPlantilla
} from '../controllers/actor.controller';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(isAuthenticated);

// ===== GENERADORES =====
router.get('/generadores', getGeneradores);
router.post('/generadores', hasRole('ADMIN'), createGenerador);
router.put('/generadores/:id', hasRole('ADMIN'), updateGenerador);
router.delete('/generadores/:id', hasRole('ADMIN'), deleteGenerador);

// ===== TRANSPORTISTAS =====
router.get('/transportistas', getTransportistas);
router.post('/transportistas', hasRole('ADMIN'), createTransportista);
router.put('/transportistas/:id', hasRole('ADMIN'), updateTransportista);
router.post('/transportistas/:id/vehiculos', hasRole('ADMIN'), addVehiculo);
router.post('/transportistas/:id/choferes', hasRole('ADMIN'), addChofer);

// ===== OPERADORES =====
router.get('/operadores', getOperadores);
router.post('/operadores', hasRole('ADMIN'), createOperador);
router.put('/operadores/:id', hasRole('ADMIN'), updateOperador);
router.delete('/operadores/:id', hasRole('ADMIN'), deleteOperador);

// ===== CARGA MASIVA (Solo Admin) =====
router.get('/carga-masiva/plantilla/:tipo', hasRole('ADMIN'), descargarPlantilla);
router.post('/carga-masiva/generadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaGeneradores);
router.post('/carga-masiva/transportistas', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaTransportistas);
router.post('/carga-masiva/operadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaOperadores);

export default router;

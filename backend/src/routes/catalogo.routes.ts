import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getTiposResiduos,
    createTipoResiduo,
    updateTipoResiduo,
    deleteTipoResiduo,
    getGeneradores,
    getTransportistas,
    getOperadores,
    getAllVehiculos,
    getAllChoferes,
    getVehiculos,
    getChoferes,
    getAllTratamientos,
    getTratamientos,
    createTratamiento,
    updateTratamiento,
    deleteTratamiento,
} from '../controllers/catalogo.controller';

const router = Router();

// Rutas públicas (para selectores en formularios)
router.get('/tipos-residuos', getTiposResiduos);

// Rutas protegidas
router.use(isAuthenticated);

router.get('/generadores', getGeneradores);
router.get('/transportistas', getTransportistas);
router.get('/operadores', getOperadores);
router.get('/vehiculos', getAllVehiculos);
router.get('/choferes', getAllChoferes);
router.get('/transportistas/:transportistaId/vehiculos', getVehiculos);
router.get('/transportistas/:transportistaId/choferes', getChoferes);
router.get('/operadores/:operadorId/tratamientos', getTratamientos);

// CRUD tipos-residuos (ADMIN only)
router.post('/tipos-residuos', hasRole('ADMIN'), createTipoResiduo);
router.put('/tipos-residuos/:id', hasRole('ADMIN'), updateTipoResiduo);
router.delete('/tipos-residuos/:id', hasRole('ADMIN'), deleteTipoResiduo);

// Tratamientos autorizados
router.get('/tratamientos', hasRole('ADMIN'), getAllTratamientos);
router.post('/tratamientos', hasRole('ADMIN'), createTratamiento);
router.put('/tratamientos/:id', hasRole('ADMIN'), updateTratamiento);
router.delete('/tratamientos/:id', hasRole('ADMIN'), deleteTratamiento);

export default router;

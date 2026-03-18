import { Router } from 'express';
import { isAuthenticated, requireAdminOrGenerador, requireAdminOrOperador } from '../middlewares/auth.middleware';
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

// CRUD tipos-residuos (ADMIN o ADMIN_GENERADOR)
router.post('/tipos-residuos', requireAdminOrGenerador, createTipoResiduo);
router.put('/tipos-residuos/:id', requireAdminOrGenerador, updateTipoResiduo);
router.delete('/tipos-residuos/:id', requireAdminOrGenerador, deleteTipoResiduo);

// Tratamientos autorizados (ADMIN o ADMIN_OPERADOR)
router.get('/tratamientos', requireAdminOrOperador, getAllTratamientos);
router.post('/tratamientos', requireAdminOrOperador, createTratamiento);
router.put('/tratamientos/:id', requireAdminOrOperador, updateTratamiento);
router.delete('/tratamientos/:id', requireAdminOrOperador, deleteTratamiento);

export default router;

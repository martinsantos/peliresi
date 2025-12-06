import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    getTiposResiduos,
    getGeneradores,
    getTransportistas,
    getOperadores,
    getVehiculos,
    getChoferes,
    getTratamientos
} from '../controllers/catalogo.controller';

const router = Router();

// Rutas públicas (para selectores en formularios)
router.get('/tipos-residuos', getTiposResiduos);

// Rutas protegidas
router.use(isAuthenticated);

router.get('/generadores', getGeneradores);
router.get('/transportistas', getTransportistas);
router.get('/operadores', getOperadores);
router.get('/transportistas/:transportistaId/vehiculos', getVehiculos);
router.get('/transportistas/:transportistaId/choferes', getChoferes);
router.get('/operadores/:operadorId/tratamientos', getTratamientos);

export default router;

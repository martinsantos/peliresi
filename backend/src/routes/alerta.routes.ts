import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getReglasAlerta,
    crearReglaAlerta,
    getAlertasGeneradas,
    resolverAlerta
} from '../controllers/alerta.controller';

const router = Router();

// Requiere autenticación y rol ADMIN
router.use(isAuthenticated);
router.use(hasRole('ADMIN'));

// ============ REGLAS DE ALERTA ============
router.get('/reglas', getReglasAlerta);
router.post('/reglas', crearReglaAlerta);

// ============ ALERTAS GENERADAS ============
router.get('/', getAlertasGeneradas);
router.put('/:id/resolver', resolverAlerta);

export default router;

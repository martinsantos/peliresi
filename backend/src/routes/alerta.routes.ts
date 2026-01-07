import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getReglasAlerta,
    crearReglaAlerta,
    actualizarReglaAlerta,
    eliminarReglaAlerta,
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
router.put('/reglas/:id', actualizarReglaAlerta);
router.delete('/reglas/:id', eliminarReglaAlerta);

// ============ ALERTAS GENERADAS ============
router.get('/', getAlertasGeneradas);
router.put('/:id/resolver', resolverAlerta);

export default router;

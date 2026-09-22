import { Router } from 'express';
import { hasRole, isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import {
    getRenovaciones,
    getRenovacionById,
    createRenovacion,
    aprobarRenovacion,
    rechazarRenovacion,
} from '../controllers/renovacion.controller';

const router = Router();
router.use(isAuthenticated);
router.use(requireFullAccess);

router.get('/', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), getRenovaciones);
router.get('/:id', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), getRenovacionById);
router.post('/', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'GENERADOR', 'OPERADOR'), createRenovacion);
router.post('/:id/aprobar', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), aprobarRenovacion);
router.post('/:id/rechazar', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), rechazarRenovacion);

export default router;

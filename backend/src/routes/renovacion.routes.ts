import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    getRenovaciones,
    getRenovacionById,
    createRenovacion,
    aprobarRenovacion,
    rechazarRenovacion,
} from '../controllers/renovacion.controller';

const router = Router();
router.use(isAuthenticated);

router.get('/', getRenovaciones);
router.get('/:id', getRenovacionById);
router.post('/', createRenovacion);
router.post('/:id/aprobar', aprobarRenovacion);
router.post('/:id/rechazar', rechazarRenovacion);

export default router;

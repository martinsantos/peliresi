import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    getNotificaciones,
    marcarLeida,
    marcarTodasLeidas,
    eliminarNotificacion
} from '../controllers/notification.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// ============ NOTIFICACIONES ============
router.get('/', getNotificaciones);
router.put('/:id/leida', marcarLeida);
router.put('/todas-leidas', marcarTodasLeidas);
router.delete('/:id', eliminarNotificacion);

export default router;

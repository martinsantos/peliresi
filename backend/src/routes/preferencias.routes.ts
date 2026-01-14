import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  getMisPreferencias,
  updateMisPreferencias,
  skipTour,
  reactivarTour
} from '../controllers/preferencias.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Obtener preferencias del usuario actual
router.get('/mis-preferencias', getMisPreferencias);

// Actualizar preferencias del usuario actual
router.put('/mis-preferencias', updateMisPreferencias);

// Desactivar el tour de bienvenida
router.post('/skip-tour', skipTour);

// Reactivar el tour de bienvenida
router.post('/reactivar-tour', reactivarTour);

export default router;

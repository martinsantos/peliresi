/**
 * Rutas para funciones de DEMO
 * Solo activas cuando isDemoEnvironment() es true
 */
import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  getDemoStatus,
  getAvailableProfiles,
  validateDemoProfile
} from '../controllers/demo.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Estado del modo demo
router.get('/status', getDemoStatus);

// Obtener perfiles disponibles para cambio
router.get('/profiles', getAvailableProfiles);

// Validar un perfil antes de usarlo
router.post('/profiles/validate', validateDemoProfile);

export default router;

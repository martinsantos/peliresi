import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  toggleActivo,
  ejecutarJobVencimientos,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(isAuthenticated);
router.use(hasRole('ADMIN'));

// ===== USUARIOS CRUD =====
router.get('/usuarios', getUsuarios);
router.get('/usuarios/:id', getUsuarioById);
router.post('/usuarios', createUsuario);
router.put('/usuarios/:id', updateUsuario);
router.delete('/usuarios/:id', deleteUsuario);
router.patch('/usuarios/:id/toggle-activo', toggleActivo);

// ===== JOBS =====
router.post('/jobs/vencimientos', ejecutarJobVencimientos);

export default router;

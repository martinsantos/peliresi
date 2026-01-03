import { Router, Request, Response, NextFunction } from 'express';
import { register, login, getProfile, logout, getUsers } from '../controllers/auth.controller';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';

const router = Router();

// Ruta de prueba
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Ruta de autenticación funcionando' });
});

// Registrar nuevo usuario
router.post('/register', register);

// Iniciar sesión
router.post('/login', login);

// Obtener perfil (protegida)
router.get('/profile', isAuthenticated, getProfile);

// Listar usuarios (solo admin) - CU-A03
router.get('/users', isAuthenticated, hasRole('ADMIN'), getUsers);

// Cerrar sesión (protegida)
router.post('/logout', isAuthenticated, logout);

export default router;

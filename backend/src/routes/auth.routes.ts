import { Router, Request, Response, NextFunction } from 'express';
import { register, login, getProfile, logout, refreshToken } from '../controllers/auth.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = Router();

// Ruta de prueba
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Ruta de autenticación funcionando' });
});

// Registrar nuevo usuario
router.post('/register', register);

// Iniciar sesión
router.post('/login', login);

// Refrescar tokens (no requiere autenticación — el access token ya expiró)
router.post('/refresh-token', refreshToken);

// Obtener perfil (protegida)
router.get('/profile', isAuthenticated, getProfile);

// Cerrar sesión (protegida)
router.post('/logout', isAuthenticated, logout);

export default router;

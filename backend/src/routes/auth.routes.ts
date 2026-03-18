import { Router, Request, Response } from 'express';
import { register, login, getProfile, logout, refreshToken, changePassword, verifyEmail, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = Router();

// Test
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Ruta de autenticación funcionando' });
});

// Públicas
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protegidas
router.get('/profile', isAuthenticated, getProfile);
router.post('/change-password', isAuthenticated, changePassword);
router.post('/logout', isAuthenticated, logout);

export default router;

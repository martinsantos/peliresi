import { Router, Request, Response } from 'express';
import { register, login, getProfile, logout, refreshToken, changePassword, verifyEmail, forgotPassword, resetPassword, claimAccount } from '../controllers/auth.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /auth/test:
 *   get:
 *     tags: [Auth]
 *     summary: Test de conectividad auth
 *     description: Endpoint de prueba para verificar que las rutas de autenticacion estan activas.
 *     security: []
 *     responses:
 *       200:
 *         description: Ruta funcionando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Ruta de autenticacion funcionando }
 */
// Test
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Ruta de autenticación funcionando' });
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     description: Crea un nuevo usuario en el sistema. Requiere email unico.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nombre, rol]
 *             properties:
 *               email: { type: string, format: email, example: nuevo@ejemplo.com }
 *               password: { type: string, minLength: 6, example: password123 }
 *               nombre: { type: string, example: Juan Perez }
 *               rol: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Datos invalidos o email duplicado
 */
// Publicas
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesion
 *     description: Autenticacion con email y password. Retorna JWT token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: juan.perez@dgfa.gob.ar }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     nombre: { type: string }
 *                     rol: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *       401:
 *         description: Credenciales invalidas
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar JWT token
 *     description: Genera un nuevo token JWT a partir del token actual valido.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: JWT token actual }
 *     responses:
 *       200:
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *       401:
 *         description: Token invalido o expirado
 */
router.post('/refresh-token', refreshToken);

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verificar email
 *     description: Verifica el email del usuario usando el token enviado por correo.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Token de verificacion de email
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 *       400:
 *         description: Token invalido o expirado
 */
router.get('/verify-email', verifyEmail);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar recuperacion de password
 *     description: Envia un email con link de recuperacion de password.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: usuario@ejemplo.com }
 *     responses:
 *       200:
 *         description: Email de recuperacion enviado (siempre retorna 200 por seguridad)
 */
router.post('/forgot-password', forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Resetear password
 *     description: Establece un nuevo password usando el token de recuperacion.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, description: Token de recuperacion }
 *               password: { type: string, minLength: 6, description: Nuevo password }
 *     responses:
 *       200:
 *         description: Password actualizado exitosamente
 *       400:
 *         description: Token invalido o expirado
 */
router.post('/reset-password', resetPassword);

/**
 * @openapi
 * /auth/claim-account:
 *   post:
 *     tags: [Auth]
 *     summary: Reclamar cuenta existente
 *     description: Permite a usuarios con email placeholder reclamar su cuenta verificando CUIT y Razon Social.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cuit, razonSocial, nuevoEmail, password]
 *             properties:
 *               cuit: { type: string, example: "30-71123596-1" }
 *               razonSocial: { type: string, example: "HUMBERTO MORILLAS S.A." }
 *               nuevoEmail: { type: string, format: email, example: "contacto@empresa.com" }
 *               password: { type: string, minLength: 8, example: "NuevaPass123" }
 *     responses:
 *       200:
 *         description: Solicitud procesada (respuesta generica por seguridad)
 *       400:
 *         description: Datos invalidos
 */
router.post('/claim-account', claimAccount);

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener perfil del usuario autenticado
 *     description: Retorna datos del usuario actual incluyendo rol y actor asociado.
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 email: { type: string }
 *                 nombre: { type: string }
 *                 rol: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *                 sector: { type: string }
 *       401:
 *         description: No autenticado
 */
// Protegidas
router.get('/profile', isAuthenticated, getProfile);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Cambiar password
 *     description: Cambia el password del usuario autenticado. Requiere password actual.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, description: Password actual }
 *               newPassword: { type: string, minLength: 6, description: Nuevo password }
 *     responses:
 *       200:
 *         description: Password cambiado exitosamente
 *       400:
 *         description: Password actual incorrecto
 *       401:
 *         description: No autenticado
 */
router.post('/change-password', isAuthenticated, changePassword);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesion
 *     description: Invalida la sesion actual del usuario.
 *     responses:
 *       200:
 *         description: Sesion cerrada exitosamente
 *       401:
 *         description: No autenticado
 */
router.post('/logout', isAuthenticated, logout);

export default router;

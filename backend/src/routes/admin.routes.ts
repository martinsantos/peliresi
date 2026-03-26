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
  updatePreferenciasNotificacion,
  impersonateUsuario,
  getEmailQueue,
} from '../controllers/admin.controller';

const router = Router();

/**
 * @openapi
 * /admin/preferencias-notificacion:
 *   put:
 *     tags: [Admin]
 *     summary: Actualizar preferencias de notificacion
 *     description: Actualiza las preferencias de notificacion por email del usuario autenticado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailManifiestoCreado: { type: boolean }
 *               emailManifiestoAprobado: { type: boolean }
 *               emailManifiestoEntregado: { type: boolean }
 *               emailAlerta: { type: boolean }
 *     responses:
 *       200:
 *         description: Preferencias actualizadas
 *       401:
 *         description: No autenticado
 */
// Preferencias propias — solo autenticacion (cualquier admin puede actualizar las suyas)
router.put('/preferencias-notificacion', isAuthenticated, updatePreferenciasNotificacion);

// All admin routes require authentication + any admin role
router.use(isAuthenticated);
router.use(hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'));

// ===== USUARIOS CRUD =====

/**
 * @openapi
 * /admin/usuarios:
 *   get:
 *     tags: [Admin]
 *     summary: Listar usuarios
 *     description: Lista usuarios con filtros por rol, estado activo y busqueda. Incluye paginacion. Solo ADMIN.
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nombre o email
 *       - in: query
 *         name: activo
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de usuarios con paginacion
 *       403:
 *         description: Solo ADMIN
 */
router.get('/usuarios', hasRole('ADMIN'), getUsuarios);

/**
 * @openapi
 * /admin/usuarios/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Obtener usuario por ID
 *     description: Retorna detalle de usuario con actor asociado. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del usuario
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/usuarios/:id', hasRole('ADMIN'), getUsuarioById);

/**
 * @openapi
 * /admin/usuarios:
 *   post:
 *     tags: [Admin]
 *     summary: Crear usuario
 *     description: Crea un nuevo usuario con validacion Zod y hash bcrypt. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nombre, rol]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               nombre: { type: string }
 *               rol: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *               sector: { type: string }
 *     responses:
 *       201:
 *         description: Usuario creado
 *       400:
 *         description: Datos invalidos o email duplicado
 */
router.post('/usuarios', hasRole('ADMIN'), createUsuario);

/**
 * @openapi
 * /admin/usuarios/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Editar usuario
 *     description: Modifica datos de un usuario existente (email, nombre, rol, etc.). Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               nombre: { type: string }
 *               rol: { type: string, enum: [ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR] }
 *               sector: { type: string }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/usuarios/:id', hasRole('ADMIN'), updateUsuario);

/**
 * @openapi
 * /admin/usuarios/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Eliminar usuario
 *     description: Elimina un usuario. Verifica que no tenga manifiestos asociados. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *       400:
 *         description: No se puede eliminar (tiene manifiestos asociados)
 */
router.delete('/usuarios/:id', hasRole('ADMIN'), deleteUsuario);

/**
 * @openapi
 * /admin/usuarios/{id}/toggle-activo:
 *   patch:
 *     tags: [Admin]
 *     summary: Activar/desactivar usuario
 *     description: Alterna el campo activo del usuario. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estado activo alternado
 *       404:
 *         description: Usuario no encontrado
 */
router.patch('/usuarios/:id/toggle-activo', hasRole('ADMIN'), toggleActivo);

// ===== IMPERSONATE =====

/**
 * @openapi
 * /admin/impersonate/{userId}:
 *   post:
 *     tags: [Admin]
 *     summary: Impersonar usuario
 *     description: Genera un token JWT para actuar como otro usuario. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Token de impersonacion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object }
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/impersonate/:userId', impersonateUsuario);

// ===== JOBS =====

/**
 * @openapi
 * /admin/jobs/vencimientos:
 *   post:
 *     tags: [Admin]
 *     summary: Ejecutar job de vencimientos
 *     description: Ejecuta manualmente el job de verificacion de vencimientos de habilitaciones. Solo ADMIN.
 *     responses:
 *       200:
 *         description: Job ejecutado exitosamente
 */
router.post('/jobs/vencimientos', ejecutarJobVencimientos);

// ===== EMAIL QUEUE =====
router.get('/email-queue', getEmailQueue);

export default router;

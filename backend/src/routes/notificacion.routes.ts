/**
 * NOTIFICACION ROUTES
 * Rutas para el sistema de notificaciones in-app
 */

import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion
} from '../controllers/notificacion.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// GET /api/notificaciones - Obtener notificaciones del usuario
router.get('/', getNotificaciones);

// GET /api/notificaciones/mis-alertas - Alias para compatibilidad con frontend
router.get('/mis-alertas', getNotificaciones);

// PUT /api/notificaciones/leer-todas - Marcar todas como leídas
router.put('/leer-todas', marcarTodasLeidas);

// PUT /api/notificaciones/:id/leer - Marcar como leída
router.put('/:id/leer', marcarLeida);

// DELETE /api/notificaciones/:id - Eliminar notificación
router.delete('/:id', eliminarNotificacion);

export default router;

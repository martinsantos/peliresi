/**
 * Admin Routes - Gestión de Usuarios y Actividad del Sistema
 *
 * Endpoints:
 * - GET  /admin/usuarios           - Listar todos los usuarios con estadísticas
 * - GET  /admin/usuarios/pendientes - Listar usuarios pendientes de aprobación
 * - GET  /admin/usuarios/:id       - Detalle de un usuario
 * - PUT  /admin/usuarios/:id       - Actualizar usuario (activar/desactivar, cambiar rol)
 * - POST /admin/usuarios/:id/aprobar - Aprobar usuario pendiente
 * - POST /admin/usuarios/:id/rechazar - Rechazar usuario pendiente
 * - GET  /admin/actividad          - Timeline de actividad global
 * - GET  /admin/estadisticas       - Estadísticas generales del sistema
 */

import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getAllUsuarios,
    getUsuariosPendientes,
    getUsuarioById,
    updateUsuario,
    aprobarUsuario,
    rechazarUsuario,
    getActividadGlobal,
    getEstadisticasAdmin,
    getEstadisticasDepartamento,
    getEstadisticasHistoricas
} from '../controllers/admin.controller';

const router = Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(isAuthenticated, hasRole('ADMIN'));

// Usuarios
router.get('/usuarios', getAllUsuarios);
router.get('/usuarios/pendientes', getUsuariosPendientes);
router.get('/usuarios/:id', getUsuarioById);
router.put('/usuarios/:id', updateUsuario);
router.post('/usuarios/:id/aprobar', aprobarUsuario);
router.post('/usuarios/:id/rechazar', rechazarUsuario);

// Actividad
router.get('/actividad', getActividadGlobal);

// Estadísticas
router.get('/estadisticas', getEstadisticasAdmin);
router.get('/estadisticas-departamento', getEstadisticasDepartamento);
router.get('/estadisticas-historicas', getEstadisticasHistoricas);

export default router;

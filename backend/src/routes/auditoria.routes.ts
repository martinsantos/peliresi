import { Router, Response, NextFunction } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import loggerService from '../services/logger.service';

const router = Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(isAuthenticated);
router.use(hasRole('ADMIN'));

/**
 * GET /api/admin/auditoria
 * Obtener logs de actividad con filtros
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { usuarioId, accion, modulo, desde, hasta, page, limit } = req.query;

    // Registrar que admin está viendo la auditoría
    await loggerService.registrar({
      usuarioId: req.user!.id,
      accion: 'VER_AUDITORIA',
      modulo: 'REPORTES',
      req,
    });

    const resultado = await loggerService.obtenerLogs({
      usuarioId: usuarioId as string,
      accion: accion as string,
      modulo: modulo as string,
      desde: desde ? new Date(desde as string) : undefined,
      hasta: hasta ? new Date(hasta as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/auditoria/estadisticas
 * Obtener estadísticas de actividad
 */
router.get('/estadisticas', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = req.query;

    const estadisticas = await loggerService.obtenerEstadisticas(
      desde ? new Date(desde as string) : undefined,
      hasta ? new Date(hasta as string) : undefined
    );

    res.json({
      success: true,
      data: estadisticas,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/auditoria/exportar
 * Exportar logs a CSV
 */
router.get('/exportar', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { usuarioId, accion, modulo, desde, hasta } = req.query;

    // Registrar exportación
    await loggerService.registrar({
      usuarioId: req.user!.id,
      accion: 'EXPORTAR_DATOS',
      modulo: 'REPORTES',
      detalles: { tipo: 'auditoria' },
      req,
    });

    const csv = await loggerService.exportarCSV({
      usuarioId: usuarioId as string,
      accion: accion as string,
      modulo: modulo as string,
      desde: desde ? new Date(desde as string) : undefined,
      hasta: hasta ? new Date(hasta as string) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=auditoria_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/auditoria/acciones
 * Listar tipos de acciones disponibles
 */
router.get('/acciones', (req: AuthRequest, res: Response) => {
  const acciones = [
    { value: 'LOGIN', label: 'Inicio de Sesión' },
    { value: 'LOGOUT', label: 'Cierre de Sesión' },
    { value: 'LOGIN_FALLIDO', label: 'Login Fallido' },
    { value: 'CREAR_MANIFIESTO', label: 'Crear Manifiesto' },
    { value: 'FIRMAR_MANIFIESTO', label: 'Firmar Manifiesto' },
    { value: 'CONFIRMAR_RETIRO', label: 'Confirmar Retiro' },
    { value: 'CONFIRMAR_ENTREGA', label: 'Confirmar Entrega' },
    { value: 'CONFIRMAR_RECEPCION', label: 'Confirmar Recepción' },
    { value: 'REGISTRAR_PESAJE', label: 'Registrar Pesaje' },
    { value: 'REGISTRAR_TRATAMIENTO', label: 'Registrar Tratamiento' },
    { value: 'CERRAR_MANIFIESTO', label: 'Cerrar Manifiesto' },
    { value: 'APROBAR_USUARIO', label: 'Aprobar Usuario' },
    { value: 'RECHAZAR_USUARIO', label: 'Rechazar Usuario' },
    { value: 'VER_AUDITORIA', label: 'Ver Auditoría' },
    { value: 'EXPORTAR_DATOS', label: 'Exportar Datos' },
  ];

  res.json({ success: true, data: { acciones } });
});

/**
 * GET /api/admin/auditoria/modulos
 * Listar módulos disponibles
 */
router.get('/modulos', (req: AuthRequest, res: Response) => {
  const modulos = [
    { value: 'AUTH', label: 'Autenticación' },
    { value: 'MANIFIESTOS', label: 'Manifiestos' },
    { value: 'USUARIOS', label: 'Usuarios' },
    { value: 'REPORTES', label: 'Reportes' },
    { value: 'SISTEMA', label: 'Sistema' },
    { value: 'PUSH', label: 'Notificaciones' },
  ];

  res.json({ success: true, data: { modulos } });
});

export default router;

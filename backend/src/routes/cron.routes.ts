/**
 * CRON Routes - CU-S10/S11: Administración de tareas programadas
 * Solo accesible para ADMIN
 */

import { Router, Response, NextFunction } from 'express';
import { isAuthenticated, hasRole, AuthRequest } from '../middlewares/auth.middleware';
import cronService from '../services/cron.service';

const router = Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(isAuthenticated, hasRole('ADMIN'));

/**
 * GET /api/cron/status
 * Obtener estado de las tareas programadas
 */
router.get('/status', (req: AuthRequest, res: Response) => {
  try {
    const status = cronService.getStatus();
    res.json({
      success: true,
      data: { tasks: status }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de tareas'
    });
  }
});

/**
 * POST /api/cron/run/:taskName
 * Ejecutar una tarea manualmente
 */
router.post('/run/:taskName', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { taskName } = req.params;
    const result = await cronService.runTask(taskName);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/cron/backup
 * Ejecutar backup manual
 */
router.post('/backup', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tipo = 'daily' } = req.body;
    await cronService.ejecutarBackup(tipo as 'daily' | 'weekly');

    res.json({
      success: true,
      message: `Backup ${tipo} ejecutado correctamente`
    });
  } catch (error) {
    next(error);
  }
});

export default router;

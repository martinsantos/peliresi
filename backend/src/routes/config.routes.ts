/**
 * Config Routes - CU-A12: Configuración del Sistema
 * Endpoints para gestionar parámetros del sistema
 */

import { Router, Response, NextFunction } from 'express';
import { isAuthenticated, hasRole, AuthRequest } from '../middlewares/auth.middleware';
import configService from '../services/config.service';

const router = Router();

/**
 * GET /api/config
 * Obtener configuración del sistema (autenticado)
 */
router.get('/', isAuthenticated, (req: AuthRequest, res: Response) => {
  try {
    const config = configService.getConfig();
    res.json({
      success: true,
      data: { config }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración'
    });
  }
});

/**
 * GET /api/config/defaults
 * Obtener valores por defecto (para referencia)
 */
router.get('/defaults', isAuthenticated, (req: AuthRequest, res: Response) => {
  try {
    const defaults = configService.getDefaults();
    res.json({
      success: true,
      data: { defaults }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener valores por defecto'
    });
  }
});

/**
 * GET /api/config/:key
 * Obtener un valor específico de configuración
 */
router.get('/:key', isAuthenticated, (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const config = configService.getConfig();

    if (!(key in config)) {
      return res.status(404).json({
        success: false,
        error: `Configuración '${key}' no encontrada`
      });
    }

    res.json({
      success: true,
      data: {
        key,
        value: config[key as keyof typeof config]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración'
    });
  }
});

/**
 * PUT /api/config
 * Actualizar configuración del sistema (solo ADMIN)
 */
router.put('/', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;

    // Validar los valores
    const validation = configService.validateConfig(updates);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Valores de configuración inválidos',
        details: validation.errors
      });
    }

    const updatedConfig = configService.updateConfig(updates);

    // Registrar en auditoría
    console.log(`[Config] Usuario ${req.user?.email} actualizó configuración:`, Object.keys(updates));

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      data: { config: updatedConfig }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/config/reset
 * Resetear configuración a valores por defecto (solo ADMIN)
 */
router.post('/reset', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const defaultConfig = configService.resetConfig();

    console.log(`[Config] Usuario ${req.user?.email} reseteó configuración a valores por defecto`);

    res.json({
      success: true,
      message: 'Configuración reseteada a valores por defecto',
      data: { config: defaultConfig }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/config/public/tolerancia-peso
 * Endpoint público para obtener tolerancia de peso (usado en pesaje)
 */
router.get('/public/tolerancia-peso', (req, res: Response) => {
  try {
    const tolerancia = configService.getValue('toleranciaPeso');
    res.json({
      success: true,
      data: { toleranciaPeso: tolerancia }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener tolerancia de peso'
    });
  }
});

export default router;

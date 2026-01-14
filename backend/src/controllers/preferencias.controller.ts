import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { preferenciasService } from '../services/preferencias.service';

/**
 * Obtener preferencias del usuario actual
 */
export const getMisPreferencias = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const preferencias = await preferenciasService.getPreferencias(req.user.id);
    res.json({ success: true, data: { preferencias } });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar preferencias del usuario actual
 */
export const updateMisPreferencias = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mostrarTourInicio, ultimaVersionTour } = req.body;
    const preferencias = await preferenciasService.updatePreferencias(req.user.id, {
      mostrarTourInicio,
      ultimaVersionTour
    });
    res.json({ success: true, data: { preferencias } });
  } catch (error) {
    next(error);
  }
};

/**
 * Desactivar el tour de bienvenida (skip)
 */
export const skipTour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { version } = req.body;
    await preferenciasService.skipTour(req.user.id, version);
    res.json({ success: true, message: 'Tour desactivado correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivar el tour de bienvenida
 */
export const reactivarTour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await preferenciasService.reactivarTour(req.user.id);
    res.json({ success: true, message: 'Tour reactivado correctamente' });
  } catch (error) {
    next(error);
  }
};

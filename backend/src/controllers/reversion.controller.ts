import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reversionService } from '../services/reversion.service';
import { AppError } from '../middlewares/errorHandler';

/**
 * Transportista: Revertir entrega (operador rechazó la carga)
 * POST /api/manifiestos/:id/revertir-entrega
 */
export const revertirEntrega = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const resultado = await reversionService.revertirEntregaTransportista(
      id,
      motivo,
      req.user.id,
      req.ip || undefined,
      req.headers['user-agent'] || undefined
    );

    res.json({
      success: true,
      message: 'Entrega revertida correctamente. El manifiesto vuelve a estado EN_TRANSITO.',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Operador: Rechazar recepción de carga
 * POST /api/manifiestos/:id/rechazar-recepcion
 */
export const rechazarRecepcion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const resultado = await reversionService.rechazarRecepcionOperador(
      id,
      motivo,
      req.user.id,
      req.ip || undefined,
      req.headers['user-agent'] || undefined
    );

    res.json({
      success: true,
      message: 'Recepción rechazada. El manifiesto vuelve a estado ENTREGADO.',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Operador: Revertir certificado/tratamiento
 * POST /api/manifiestos/:id/revertir-certificado
 */
export const revertirCertificado = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const resultado = await reversionService.revertirCertificadoOperador(
      id,
      motivo,
      req.user.id,
      req.ip || undefined,
      req.headers['user-agent'] || undefined
    );

    res.json({
      success: true,
      message: 'Certificado/tratamiento revertido correctamente.',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Revertir a cualquier estado
 * POST /api/manifiestos/:id/revertir-estado
 */
export const revertirEstadoAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { estadoNuevo, motivo } = req.body;

    if (!estadoNuevo) {
      throw new AppError('Debe especificar el estado nuevo', 400);
    }

    const resultado = await reversionService.revertirEstadoAdmin(
      id,
      estadoNuevo,
      motivo,
      req.user.id,
      req.ip || undefined,
      req.headers['user-agent'] || undefined
    );

    res.json({
      success: true,
      message: `Estado revertido a ${estadoNuevo} correctamente.`,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener historial de reversiones de un manifiesto
 * GET /api/manifiestos/:id/reversiones
 */
export const getHistorialReversiones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reversiones = await reversionService.getHistorialReversiones(id);

    res.json({
      success: true,
      data: { reversiones }
    });
  } catch (error) {
    next(error);
  }
};

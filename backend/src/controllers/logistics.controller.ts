import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logisticsService } from '../services/logistics.service';
import { notificationService } from '../services/notification.service';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export const actualizarUbicacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, velocidad, direccion } = req.body;

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto || manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('Manifiesto no encontrado o no está en tránsito', 404);
    }

    const tracking = await prisma.trackingGPS.create({
      data: { manifiestoId: id, latitud, longitud, velocidad, direccion }
    });

    res.json({ success: true, data: { tracking } });
  } catch (error) {
    next(error);
  }
};

export const registrarIncidente = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tipoIncidente, descripcion, latitud, longitud } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo transportistas o admins pueden registrar incidentes', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);

    const evento = await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'INCIDENTE',
        descripcion: `INCIDENTE: ${tipoIncidente}. ${descripcion}`,
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    await notificationService.notificarPorRol('ADMIN', {
      tipo: 'ANOMALIA_DETECTADA',
      titulo: '⚠️ Incidente Reportado',
      mensaje: `Manifiesto ${manifiesto.numero}: ${tipoIncidente}`,
      manifiestoId: id,
      prioridad: 'ALTA'
    });

    res.json({ success: true, data: { evento } });
  } catch (error) {
    next(error);
  }
};

export const detectarAnomalias = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { manifiestoId } = req.params;
    const anomalias = await logisticsService.detectarAnomalias(manifiestoId);
    res.json({ success: true, data: anomalias });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// TRANSPORTISTA: Confirmar Retiro y Entrega
// ============================================================

export const confirmarRetiro = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    // Verificar que es transportista asignado
    const manifiesto = await prisma.manifiesto.findUnique({ 
      where: { id },
      include: { transportista: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.transportista.usuarioId !== userId && req.user.rol !== 'ADMIN') {
      throw new AppError('No eres el transportista asignado', 403);
    }

    if (manifiesto.estado !== 'APROBADO') {
      throw new AppError('El manifiesto debe estar APROBADO para confirmar retiro', 400);
    }

    const resultado = await logisticsService.confirmarRetiro(id, userId, { latitud, longitud, observaciones });
    
    await notificationService.notificarCambioEstado(id, 'EN_TRANSITO', userId);

    res.json({ success: true, data: { manifiesto: resultado } });
  } catch (error) {
    next(error);
  }
};

export const confirmarEntrega = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones, firmaDigital } = req.body;
    const userId = req.user.id;

    const manifiesto = await prisma.manifiesto.findUnique({ 
      where: { id },
      include: { transportista: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.transportista.usuarioId !== userId && req.user.rol !== 'ADMIN') {
      throw new AppError('No eres el transportista asignado', 403);
    }

    if (manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('El manifiesto debe estar EN_TRANSITO para confirmar entrega', 400);
    }

    // Actualizar estado a ENTREGADO
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
      data: {
        estado: 'ENTREGADO',
        fechaEntrega: new Date()
      },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        residuos: { include: { tipoResiduo: true } }
      }
    });

    // Registrar evento de entrega
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'ENTREGA',
        descripcion: observaciones || 'Carga entregada en destino',
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    // Registrar ubicación GPS final
    if (latitud && longitud) {
      await prisma.trackingGPS.create({
        data: { manifiestoId: id, latitud, longitud }
      });
    }

    await notificationService.notificarCambioEstado(id, 'ENTREGADO', userId);

    res.json({ success: true, data: { manifiesto: manifiestoActualizado } });
  } catch (error) {
    next(error);
  }
};

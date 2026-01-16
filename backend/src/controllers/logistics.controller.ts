import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logisticsService } from '../services/logistics.service';
import { notificationService } from '../services/notification.service';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { isProduction } from '../config/config';

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

    // En producción se valida estrictamente, en development se permite para demos
    if (isProduction()) {
      if (manifiesto.transportista.usuarioId !== userId && req.user.rol !== 'ADMIN') {
        throw new AppError('No eres el transportista asignado', 403);
      }
    }

    if (manifiesto.estado !== 'APROBADO') {
      throw new AppError('El manifiesto debe estar APROBADO para confirmar retiro', 400);
    }

    // CORRECCIÓN 1: Validar que el transportista no tenga otro viaje activo
    const viajesActivos = await prisma.manifiesto.count({
      where: {
        transportistaId: manifiesto.transportistaId,
        estado: 'EN_TRANSITO',
        id: { not: id } // Excluir el actual por si acaso
      }
    });

    if (viajesActivos > 0) {
      throw new AppError('Ya tienes un viaje en tránsito. Debes finalizar el viaje actual antes de iniciar otro.', 409);
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

    // En producción se valida estrictamente, en development se permite para demos
    if (isProduction()) {
      if (manifiesto.transportista.usuarioId !== userId && req.user.rol !== 'ADMIN') {
        throw new AppError('No eres el transportista asignado', 403);
      }
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

// ============================================================
// RUTA GPS: Obtener ruta completa de un manifiesto
// ============================================================

export const getRutaManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verificar que el manifiesto existe
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        generador: { select: { razonSocial: true, domicilio: true } },
        operador: { select: { razonSocial: true, domicilio: true } }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Obtener puntos de tracking GPS ordenados por timestamp
    const tracking = await prisma.trackingGPS.findMany({
      where: { manifiestoId: id },
      orderBy: { timestamp: 'asc' },
      select: {
        latitud: true,
        longitud: true,
        velocidad: true,
        timestamp: true
      }
    });

    // También intentar obtener ruta del modelo Viaje si existe
    const viaje = await prisma.viaje.findFirst({
      where: { manifiestoId: id },
      orderBy: { inicio: 'desc' },
      select: {
        ruta: true,
        inicio: true,
        fin: true,
        duracion: true,
        distancia: true,
        estado: true
      }
    });

    // Formatear respuesta
    const ruta = tracking.map(t => ({
      lat: t.latitud,
      lng: t.longitud,
      velocidad: t.velocidad,
      timestamp: t.timestamp.toISOString()
    }));

    res.json({
      success: true,
      data: {
        manifiesto: {
          id: manifiesto.id,
          numero: manifiesto.numero,
          estado: manifiesto.estado,
          origen: manifiesto.generador,
          destino: manifiesto.operador
        },
        ruta,
        totalPuntos: ruta.length,
        viaje: viaje ? {
          inicio: viaje.inicio,
          fin: viaje.fin,
          duracion: viaje.duracion,
          distancia: viaje.distancia,
          estado: viaje.estado,
          rutaViaje: viaje.ruta
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

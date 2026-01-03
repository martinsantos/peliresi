import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

/**
 * Tipos de acciones para el log de actividad
 */
export type AccionLog = 
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FALLIDO'
  | 'CREAR_MANIFIESTO' | 'FIRMAR_MANIFIESTO' | 'CONFIRMAR_RETIRO' 
  | 'CONFIRMAR_ENTREGA' | 'CONFIRMAR_RECEPCION' | 'REGISTRAR_PESAJE'
  | 'REGISTRAR_TRATAMIENTO' | 'CERRAR_MANIFIESTO' | 'RECHAZAR_MANIFIESTO'
  | 'REGISTRAR_INCIDENTE' | 'ACTUALIZAR_GPS'
  | 'CREAR_USUARIO' | 'APROBAR_USUARIO' | 'RECHAZAR_USUARIO' | 'DESACTIVAR_USUARIO'
  | 'VER_AUDITORIA' | 'EXPORTAR_DATOS' | 'GENERAR_REPORTE'
  | 'SUSCRIBIR_PUSH' | 'DESUSCRIBIR_PUSH';

export type ModuloLog = 'AUTH' | 'MANIFIESTOS' | 'USUARIOS' | 'REPORTES' | 'SISTEMA' | 'PUSH';

interface LogEntry {
  usuarioId: string;
  accion: AccionLog;
  modulo: ModuloLog;
  entidadId?: string;
  detalles?: Record<string, any>;
  req?: Request;
}

/**
 * Servicio de Log de Actividad (Auditoría Completa)
 */
export const loggerService = {
  /**
   * Registrar una actividad en el log
   */
  async registrar({ usuarioId, accion, modulo, entidadId, detalles, req }: LogEntry): Promise<void> {
    try {
      await prisma.logActividad.create({
        data: {
          usuarioId,
          accion,
          modulo,
          entidadId,
          detalles: detalles || {},
          ip: req?.ip || req?.headers['x-forwarded-for']?.toString() || undefined,
          userAgent: req?.headers['user-agent'] || undefined,
        },
      });
    } catch (error) {
      console.error('[LoggerService] Error registrando actividad:', error);
    }
  },

  /**
   * Obtener logs con filtros y paginación
   */
  async obtenerLogs(filtros: {
    usuarioId?: string;
    accion?: string;
    modulo?: string;
    desde?: Date;
    hasta?: Date;
    page?: number;
    limit?: number;
  }) {
    const { usuarioId, accion, modulo, desde, hasta, page = 1, limit = 50 } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (usuarioId) where.usuarioId = usuarioId;
    if (accion) where.accion = accion;
    if (modulo) where.modulo = modulo;
    if (desde || hasta) {
      where.timestamp = {};
      if (desde) where.timestamp.gte = desde;
      if (hasta) where.timestamp.lte = hasta;
    }

    const [logs, total] = await Promise.all([
      prisma.logActividad.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          usuario: {
            select: { id: true, email: true, nombre: true, apellido: true, rol: true },
          },
        },
      }),
      prisma.logActividad.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Obtener estadísticas de actividad
   */
  async obtenerEstadisticas(desde?: Date, hasta?: Date) {
    const where: any = {};
    if (desde || hasta) {
      where.timestamp = {};
      if (desde) where.timestamp.gte = desde;
      if (hasta) where.timestamp.lte = hasta;
    }

    const [porAccion, porModulo, porUsuario, total] = await Promise.all([
      prisma.logActividad.groupBy({
        by: ['accion'],
        where,
        _count: true,
        orderBy: { _count: { accion: 'desc' } },
        take: 10,
      }),
      prisma.logActividad.groupBy({
        by: ['modulo'],
        where,
        _count: true,
      }),
      prisma.logActividad.groupBy({
        by: ['usuarioId'],
        where,
        _count: true,
        orderBy: { _count: { usuarioId: 'desc' } },
        take: 10,
      }),
      prisma.logActividad.count({ where }),
    ]);

    return {
      total,
      porAccion: porAccion.map(p => ({ accion: p.accion, count: p._count })),
      porModulo: porModulo.map(p => ({ modulo: p.modulo, count: p._count })),
      porUsuario: porUsuario.map(p => ({ usuarioId: p.usuarioId, count: p._count })),
    };
  },

  /**
   * Exportar logs a formato CSV
   */
  async exportarCSV(filtros: {
    usuarioId?: string;
    accion?: string;
    modulo?: string;
    desde?: Date;
    hasta?: Date;
  }): Promise<string> {
    const where: any = {};
    if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.modulo) where.modulo = filtros.modulo;
    if (filtros.desde || filtros.hasta) {
      where.timestamp = {};
      if (filtros.desde) where.timestamp.gte = filtros.desde;
      if (filtros.hasta) where.timestamp.lte = filtros.hasta;
    }

    const logs = await prisma.logActividad.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        usuario: { select: { email: true, nombre: true } },
      },
      take: 10000, // Límite máximo
    });

    // Generar CSV
    const headers = ['Fecha/Hora', 'Usuario', 'Email', 'Acción', 'Módulo', 'Entidad', 'IP', 'Detalles'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      `${log.usuario.nombre || ''} ${log.usuario.nombre || ''}`.trim(),
      log.usuario.email,
      log.accion,
      log.modulo,
      log.entidadId || '',
      log.ip || '',
      JSON.stringify(log.detalles || {}),
    ]);

    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  },
};

export default loggerService;

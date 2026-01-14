import prisma from '../lib/prisma';
import { EstadoManifiesto, TipoReversion, Rol } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { notificationService } from './notification.service';
import { loggerService } from './logger.service';

// Matriz de reversiones permitidas por rol
const REVERSIONES_PERMITIDAS: Record<string, { estadoActual: EstadoManifiesto; estadoNuevo: EstadoManifiesto; roles: Rol[] }[]> = {
  // Transportista puede revertir si el operador rechazó la entrega
  TRANSPORTISTA: [
    { estadoActual: 'ENTREGADO', estadoNuevo: 'EN_TRANSITO', roles: ['TRANSPORTISTA', 'ADMIN', 'ADMIN_TRANSPORTISTAS'] },
    { estadoActual: 'EN_TRANSITO', estadoNuevo: 'APROBADO', roles: ['TRANSPORTISTA', 'ADMIN', 'ADMIN_TRANSPORTISTAS'] }
  ],
  // Operador puede revertir recepción y certificado
  OPERADOR: [
    { estadoActual: 'RECIBIDO', estadoNuevo: 'ENTREGADO', roles: ['OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'] },
    { estadoActual: 'EN_TRATAMIENTO', estadoNuevo: 'RECIBIDO', roles: ['OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'] },
    { estadoActual: 'TRATADO', estadoNuevo: 'EN_TRATAMIENTO', roles: ['OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'] },
    { estadoActual: 'TRATADO', estadoNuevo: 'RECIBIDO', roles: ['OPERADOR', 'ADMIN', 'ADMIN_OPERADORES'] }
  ]
};

// Admin puede revertir cualquier estado (excepto CANCELADO/RECHAZADO finales)
const ESTADOS_NO_REVERSIBLES: EstadoManifiesto[] = ['CANCELADO'];

interface ReversionParams {
  manifiestoId: string;
  estadoNuevo: EstadoManifiesto;
  motivo: string;
  tipoReversion: TipoReversion;
  usuarioId: string;
  rolUsuario: Rol;
  ip?: string;
  userAgent?: string;
}

interface ReversionResult {
  manifiesto: any;
  reversion: any;
}

class ReversionService {
  /**
   * Verificar si una reversión es permitida
   */
  private verificarReversionPermitida(
    estadoActual: EstadoManifiesto,
    estadoNuevo: EstadoManifiesto,
    rolUsuario: Rol
  ): boolean {
    // Admin general puede revertir casi cualquier cosa
    if (rolUsuario === 'ADMIN') {
      return !ESTADOS_NO_REVERSIBLES.includes(estadoActual);
    }

    // Buscar en las reversiones permitidas para este rol
    for (const categoria of Object.values(REVERSIONES_PERMITIDAS)) {
      for (const reversion of categoria) {
        if (
          reversion.estadoActual === estadoActual &&
          reversion.estadoNuevo === estadoNuevo &&
          reversion.roles.includes(rolUsuario)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Obtener el tipo de reversión según los estados
   */
  private getTipoReversion(estadoActual: EstadoManifiesto, estadoNuevo: EstadoManifiesto, rolUsuario: Rol): TipoReversion {
    if (['ADMIN', 'ADMIN_TRANSPORTISTAS', 'ADMIN_OPERADORES', 'ADMIN_GENERADORES'].includes(rolUsuario)) {
      return 'CORRECCION_ADMIN';
    }

    if (estadoActual === 'ENTREGADO' && estadoNuevo === 'EN_TRANSITO') {
      return 'RECHAZO_ENTREGA';
    }

    if (estadoActual === 'EN_TRANSITO' && estadoNuevo === 'APROBADO') {
      return 'ERROR_TRANSPORTISTA';
    }

    if (['TRATADO', 'EN_TRATAMIENTO'].includes(estadoActual)) {
      return 'REVISION_CERTIFICADO';
    }

    return 'CORRECCION_ADMIN';
  }

  /**
   * Ejecutar una reversión de estado
   */
  async revertirEstado(params: ReversionParams): Promise<ReversionResult> {
    const { manifiestoId, estadoNuevo, motivo, usuarioId, rolUsuario, ip, userAgent } = params;

    // Validar motivo mínimo
    if (!motivo || motivo.trim().length < 20) {
      throw new AppError('El motivo de la reversión debe tener al menos 20 caracteres', 400);
    }

    // Obtener manifiesto actual
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: {
        generador: { select: { usuarioId: true, razonSocial: true } },
        transportista: { select: { usuarioId: true, razonSocial: true } },
        operador: { select: { usuarioId: true, razonSocial: true } }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    const estadoActual = manifiesto.estado;

    // Verificar que la reversión es permitida
    if (!this.verificarReversionPermitida(estadoActual, estadoNuevo, rolUsuario)) {
      throw new AppError(
        `No tiene permisos para revertir de ${estadoActual} a ${estadoNuevo}`,
        403
      );
    }

    // Determinar tipo de reversión
    const tipoReversion = this.getTipoReversion(estadoActual, estadoNuevo, rolUsuario);

    // Ejecutar la reversión en transacción
    const [reversionCreada, manifiestoActualizado] = await prisma.$transaction([
      // Crear registro de reversión
      prisma.reversionEstado.create({
        data: {
          manifiestoId,
          estadoAnterior: estadoActual,
          estadoNuevo,
          motivo: motivo.trim(),
          tipoReversion,
          usuarioId,
          rolUsuario,
          ip,
          userAgent
        }
      }),
      // Actualizar estado del manifiesto
      prisma.manifiesto.update({
        where: { id: manifiestoId },
        data: { estado: estadoNuevo },
        include: {
          generador: { select: { razonSocial: true, cuit: true } },
          transportista: { select: { razonSocial: true } },
          operador: { select: { razonSocial: true } },
          residuos: { include: { tipoResiduo: true } }
        }
      })
    ]);

    // Registrar evento de reversión
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId,
        tipo: 'REVERSION',
        descripcion: `Estado revertido de ${estadoActual} a ${estadoNuevo}. Motivo: ${motivo.trim()}. Realizado por: ${rolUsuario}`,
        usuarioId
      }
    });

    // Registrar en log de actividad
    await loggerService.registrar({
      usuarioId,
      accion: 'REVERSION_ESTADO',
      modulo: 'REVERSIONES',
      entidadId: manifiestoId,
      detalles: {
        estadoAnterior: estadoActual,
        estadoNuevo,
        tipoReversion,
        motivo: motivo.trim(),
        ip,
        userAgent
      }
    });

    // Notificar a todos los actores involucrados
    const usuariosNotificar = [
      manifiesto.generador.usuarioId,
      manifiesto.transportista.usuarioId,
      manifiesto.operador.usuarioId
    ].filter((id): id is string => id !== null && id !== usuarioId);

    for (const usuarioNotificarId of usuariosNotificar) {
      await notificationService.crearNotificacion({
        usuarioId: usuarioNotificarId,
        tipo: 'ALERTA_SISTEMA',
        titulo: 'Estado de Manifiesto Revertido',
        mensaje: `El manifiesto ${manifiesto.numero} fue revertido de ${estadoActual} a ${estadoNuevo}. Motivo: ${motivo.trim().substring(0, 100)}...`,
        manifiestoId,
        prioridad: 'ALTA'
      });
    }

    // Notificar también a los admins
    const admins = await prisma.usuario.findMany({
      where: {
        rol: { in: ['ADMIN', 'ADMIN_TRANSPORTISTAS', 'ADMIN_OPERADORES', 'ADMIN_GENERADORES'] },
        activo: true,
        id: { not: usuarioId }
      },
      select: { id: true }
    });

    for (const admin of admins) {
      await notificationService.crearNotificacion({
        usuarioId: admin.id,
        tipo: 'ALERTA_SISTEMA',
        titulo: 'Reversión de Estado Registrada',
        mensaje: `Manifiesto ${manifiesto.numero}: ${estadoActual} → ${estadoNuevo}. Por: ${rolUsuario}`,
        manifiestoId,
        prioridad: 'NORMAL'
      });
    }

    return {
      manifiesto: manifiestoActualizado,
      reversion: reversionCreada
    };
  }

  /**
   * Obtener historial de reversiones de un manifiesto
   */
  async getHistorialReversiones(manifiestoId: string) {
    return await prisma.reversionEstado.findMany({
      where: { manifiestoId },
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true, email: true, rol: true }
        }
      }
    });
  }

  /**
   * Obtener reversiones recientes (para detectar patrones)
   */
  async getReversionesRecientes(usuarioId: string, horas: number = 24) {
    const desde = new Date();
    desde.setHours(desde.getHours() - horas);

    return await prisma.reversionEstado.findMany({
      where: {
        usuarioId,
        createdAt: { gte: desde }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Verificar si el usuario tiene reversiones frecuentes (para alertas)
   */
  async verificarReversionesFrecuentes(usuarioId: string): Promise<boolean> {
    const reversiones = await this.getReversionesRecientes(usuarioId, 24);
    return reversiones.length >= 3; // Alerta si 3+ reversiones en 24h
  }

  // ============================================================
  // MÉTODOS ESPECÍFICOS POR TIPO DE REVERSIÓN
  // ============================================================

  /**
   * Transportista: Revertir entrega (operador rechazó)
   */
  async revertirEntregaTransportista(
    manifiestoId: string,
    motivo: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ): Promise<ReversionResult> {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: { transportista: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Verificar que el usuario es el transportista asignado
    // (o admin en modo demo)
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true }
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // En producción, descomentar:
    // if (manifiesto.transportista.usuarioId !== usuarioId && !['ADMIN', 'ADMIN_TRANSPORTISTAS'].includes(usuario.rol)) {
    //   throw new AppError('No es el transportista asignado a este manifiesto', 403);
    // }

    if (manifiesto.estado !== 'ENTREGADO') {
      throw new AppError('Solo se pueden revertir manifiestos en estado ENTREGADO', 400);
    }

    return this.revertirEstado({
      manifiestoId,
      estadoNuevo: 'EN_TRANSITO',
      motivo,
      tipoReversion: 'RECHAZO_ENTREGA',
      usuarioId,
      rolUsuario: usuario.rol,
      ip,
      userAgent
    });
  }

  /**
   * Operador: Rechazar recepción
   */
  async rechazarRecepcionOperador(
    manifiestoId: string,
    motivo: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ): Promise<ReversionResult> {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: { operador: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true }
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    if (manifiesto.estado !== 'RECIBIDO') {
      throw new AppError('Solo se pueden revertir manifiestos en estado RECIBIDO', 400);
    }

    return this.revertirEstado({
      manifiestoId,
      estadoNuevo: 'ENTREGADO',
      motivo,
      tipoReversion: 'RECHAZO_ENTREGA',
      usuarioId,
      rolUsuario: usuario.rol,
      ip,
      userAgent
    });
  }

  /**
   * Operador: Revertir certificado/tratamiento
   */
  async revertirCertificadoOperador(
    manifiestoId: string,
    motivo: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ): Promise<ReversionResult> {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: { operador: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true }
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    if (!['TRATADO', 'EN_TRATAMIENTO'].includes(manifiesto.estado)) {
      throw new AppError('Solo se pueden revertir manifiestos en estado TRATADO o EN_TRATAMIENTO', 400);
    }

    const estadoNuevo = manifiesto.estado === 'TRATADO' ? 'EN_TRATAMIENTO' : 'RECIBIDO';

    return this.revertirEstado({
      manifiestoId,
      estadoNuevo,
      motivo,
      tipoReversion: 'REVISION_CERTIFICADO',
      usuarioId,
      rolUsuario: usuario.rol,
      ip,
      userAgent
    });
  }

  /**
   * Admin: Revertir a cualquier estado
   */
  async revertirEstadoAdmin(
    manifiestoId: string,
    estadoNuevo: EstadoManifiesto,
    motivo: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ): Promise<ReversionResult> {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true }
    });

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    if (!['ADMIN', 'ADMIN_TRANSPORTISTAS', 'ADMIN_OPERADORES', 'ADMIN_GENERADORES'].includes(usuario.rol)) {
      throw new AppError('Solo administradores pueden usar esta función', 403);
    }

    return this.revertirEstado({
      manifiestoId,
      estadoNuevo,
      motivo,
      tipoReversion: 'CORRECCION_ADMIN',
      usuarioId,
      rolUsuario: usuario.rol,
      ip,
      userAgent
    });
  }
}

export const reversionService = new ReversionService();

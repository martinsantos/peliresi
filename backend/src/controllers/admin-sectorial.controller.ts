import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { loggerService } from '../services/logger.service';

// ============================================================
// DASHBOARD ADMIN TRANSPORTISTAS
// ============================================================

export const getDashboardTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalTransportistas,
      transportistasActivos,
      totalVehiculos,
      totalChoferes,
      manifestosEnTransito,
      manifestosEntregados
    ] = await Promise.all([
      prisma.transportista.count(),
      prisma.transportista.count({ where: { activo: true } }),
      prisma.vehiculo.count(),
      prisma.chofer.count(),
      prisma.manifiesto.count({ where: { estado: 'EN_TRANSITO' } }),
      prisma.manifiesto.count({ where: { estado: 'ENTREGADO' } })
    ]);

    // Log de actividad (Admin sectorial)
    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DASHBOARD_TRANSPORTISTAS',
      modulo: 'ADMIN_SECTORIAL',
      detalles: { rolUsuario: req.user.rol }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalTransportistas,
          transportistasActivos,
          totalVehiculos,
          totalChoferes,
          manifestosEnTransito,
          manifestosEntregados
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, activo, busqueda } = req.query;

    const where: any = {};
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }
    if (busqueda) {
      where.OR = [
        { razonSocial: { contains: busqueda as string, mode: 'insensitive' } },
        { cuit: { contains: busqueda as string } }
      ];
    }

    const [transportistas, total] = await Promise.all([
      prisma.transportista.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          usuario: { select: { email: true, nombre: true, apellido: true, activo: true, aprobado: true } },
          vehiculos: { select: { id: true, patente: true, activo: true } },
          choferes: { select: { id: true, nombre: true, apellido: true, activo: true } },
          _count: { select: { manifiestos: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.transportista.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        transportistas,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const aprobarTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const transportista = await prisma.transportista.findUnique({
      where: { id },
      include: { usuario: true }
    });

    if (!transportista) {
      throw new AppError('Transportista no encontrado', 404);
    }

    await prisma.usuario.update({
      where: { id: transportista.usuarioId },
      data: {
        aprobado: true,
        aprobadoPorId: req.user.id,
        fechaAprobacion: new Date()
      }
    });

    // Log de actividad
    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'APROBAR_TRANSPORTISTA',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        transportistaId: id,
        razonSocial: transportista.razonSocial
      }
    });

    res.json({
      success: true,
      message: `Transportista ${transportista.razonSocial} aprobado correctamente`
    });
  } catch (error) {
    next(error);
  }
};

export const getReportesTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = req.query;

    const whereDate: any = {};
    if (desde) whereDate.gte = new Date(desde as string);
    if (hasta) whereDate.lte = new Date(hasta as string);

    const manifestosPorTransportista = await prisma.manifiesto.groupBy({
      by: ['transportistaId'],
      _count: { id: true },
      where: whereDate.gte || whereDate.lte ? { createdAt: whereDate } : undefined
    });

    const transportistas = await prisma.transportista.findMany({
      select: { id: true, razonSocial: true }
    });

    const reporte = manifestosPorTransportista.map(m => ({
      transportista: transportistas.find(t => t.id === m.transportistaId)?.razonSocial || 'Desconocido',
      totalManifiestos: m._count.id
    }));

    res.json({
      success: true,
      data: { reporte }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DASHBOARD ADMIN OPERADORES
// ============================================================

export const getDashboardOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalOperadores,
      operadoresActivos,
      totalTratamientos,
      manifestosRecibidos,
      manifestosTratados
    ] = await Promise.all([
      prisma.operador.count(),
      prisma.operador.count({ where: { activo: true } }),
      prisma.tratamientoAutorizado.count(),
      prisma.manifiesto.count({ where: { estado: 'RECIBIDO' } }),
      prisma.manifiesto.count({ where: { estado: 'TRATADO' } })
    ]);

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DASHBOARD_OPERADORES',
      modulo: 'ADMIN_SECTORIAL',
      detalles: { rolUsuario: req.user.rol }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalOperadores,
          operadoresActivos,
          totalTratamientos,
          manifestosRecibidos,
          manifestosTratados
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, activo, busqueda } = req.query;

    const where: any = {};
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }
    if (busqueda) {
      where.OR = [
        { razonSocial: { contains: busqueda as string, mode: 'insensitive' } },
        { cuit: { contains: busqueda as string } }
      ];
    }

    const [operadores, total] = await Promise.all([
      prisma.operador.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          usuario: { select: { email: true, nombre: true, apellido: true, activo: true, aprobado: true } },
          tratamientos: { include: { tipoResiduo: { select: { codigo: true, nombre: true } } } },
          _count: { select: { manifiestos: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.operador.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        operadores,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const aprobarOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const operador = await prisma.operador.findUnique({
      where: { id },
      include: { usuario: true }
    });

    if (!operador) {
      throw new AppError('Operador no encontrado', 404);
    }

    await prisma.usuario.update({
      where: { id: operador.usuarioId },
      data: {
        aprobado: true,
        aprobadoPorId: req.user.id,
        fechaAprobacion: new Date()
      }
    });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'APROBAR_OPERADOR',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        operadorId: id,
        razonSocial: operador.razonSocial
      }
    });

    res.json({
      success: true,
      message: `Operador ${operador.razonSocial} aprobado correctamente`
    });
  } catch (error) {
    next(error);
  }
};

export const getReportesOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = req.query;

    const whereDate: any = {};
    if (desde) whereDate.gte = new Date(desde as string);
    if (hasta) whereDate.lte = new Date(hasta as string);

    const manifestosPorOperador = await prisma.manifiesto.groupBy({
      by: ['operadorId'],
      _count: { id: true },
      where: whereDate.gte || whereDate.lte ? { createdAt: whereDate } : undefined
    });

    const operadores = await prisma.operador.findMany({
      select: { id: true, razonSocial: true }
    });

    const reporte = manifestosPorOperador.map(m => ({
      operador: operadores.find(o => o.id === m.operadorId)?.razonSocial || 'Desconocido',
      totalManifiestos: m._count.id
    }));

    res.json({
      success: true,
      data: { reporte }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DASHBOARD ADMIN GENERADORES
// ============================================================

export const getDashboardGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalGeneradores,
      generadoresActivos,
      manifestosBorrador,
      manifestosPendientes,
      manifestosCompletados
    ] = await Promise.all([
      prisma.generador.count(),
      prisma.generador.count({ where: { activo: true } }),
      prisma.manifiesto.count({ where: { estado: 'BORRADOR' } }),
      prisma.manifiesto.count({ where: { estado: 'PENDIENTE_APROBACION' } }),
      prisma.manifiesto.count({ where: { estado: 'TRATADO' } })
    ]);

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DASHBOARD_GENERADORES',
      modulo: 'ADMIN_SECTORIAL',
      detalles: { rolUsuario: req.user.rol }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalGeneradores,
          generadoresActivos,
          manifestosBorrador,
          manifestosPendientes,
          manifestosCompletados
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, activo, busqueda } = req.query;

    const where: any = {};
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }
    if (busqueda) {
      where.OR = [
        { razonSocial: { contains: busqueda as string, mode: 'insensitive' } },
        { cuit: { contains: busqueda as string } }
      ];
    }

    const [generadores, total] = await Promise.all([
      prisma.generador.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          usuario: { select: { email: true, nombre: true, apellido: true, activo: true, aprobado: true } },
          _count: { select: { manifiestos: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.generador.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        generadores,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const aprobarGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const generador = await prisma.generador.findUnique({
      where: { id },
      include: { usuario: true }
    });

    if (!generador) {
      throw new AppError('Generador no encontrado', 404);
    }

    await prisma.usuario.update({
      where: { id: generador.usuarioId },
      data: {
        aprobado: true,
        aprobadoPorId: req.user.id,
        fechaAprobacion: new Date()
      }
    });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'APROBAR_GENERADOR',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        generadorId: id,
        razonSocial: generador.razonSocial
      }
    });

    res.json({
      success: true,
      message: `Generador ${generador.razonSocial} aprobado correctamente`
    });
  } catch (error) {
    next(error);
  }
};

export const getReportesGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = req.query;

    const whereDate: any = {};
    if (desde) whereDate.gte = new Date(desde as string);
    if (hasta) whereDate.lte = new Date(hasta as string);

    const manifestosPorGenerador = await prisma.manifiesto.groupBy({
      by: ['generadorId'],
      _count: { id: true },
      where: whereDate.gte || whereDate.lte ? { createdAt: whereDate } : undefined
    });

    const generadores = await prisma.generador.findMany({
      select: { id: true, razonSocial: true }
    });

    const reporte = manifestosPorGenerador.map(m => ({
      generador: generadores.find(g => g.id === m.generadorId)?.razonSocial || 'Desconocido',
      totalManifiestos: m._count.id
    }));

    res.json({
      success: true,
      data: { reporte }
    });
  } catch (error) {
    next(error);
  }
};

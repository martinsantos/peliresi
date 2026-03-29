import { Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

// Obtener todos los manifiestos
export const getManifiestos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, generadorId, transportistaId, operadorId, tipoResiduoId, search, fechaDesde, fechaHasta, page = 1, limit = 10, sortBy, sortOrder } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (estado) where.estado = estado;
    if (generadorId) where.generadorId = generadorId;
    if (transportistaId) where.transportistaId = transportistaId;
    if (operadorId) where.operadorId = operadorId;
    if (tipoResiduoId) where.residuos = { some: { tipoResiduoId: tipoResiduoId as string } };

    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) where.createdAt.gte = new Date(fechaDesde as string);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta as string);
        if (hasta.getUTCHours() === 0) hasta.setTime(hasta.getTime() + 86399999);
        where.createdAt.lte = hasta;
      }
    }

    // Text search by numero or actor razon social
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' } },
        { generador: { razonSocial: { contains: q, mode: 'insensitive' } } },
        { generador: { domicilio: { contains: q, mode: 'insensitive' } } },
        { transportista: { razonSocial: { contains: q, mode: 'insensitive' } } },
        { transportista: { localidad: { contains: q, mode: 'insensitive' } } },
        { operador: { razonSocial: { contains: q, mode: 'insensitive' } } },
        { operador: { domicilio: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Filtrar segun el rol del usuario
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      where.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      where.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      where.operadorId = req.user.operador.id;
    }

    // Ordering: explicit sortBy/sortOrder take precedence over smart state-based ordering
    const dir = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: any = sortBy === 'numero'
      ? { numero: dir }
      : sortBy === 'createdAt'
        ? { createdAt: dir }
        : sortBy === 'estado'
          ? { estado: dir }
          : sortBy === 'generador'
            ? { generador: { razonSocial: dir } }
            : sortBy === 'operador'
              ? { operador: { razonSocial: dir } }
              : estado === 'ENTREGADO' ? { fechaEntrega: 'desc' }
            : estado === 'RECIBIDO' ? { fechaRecepcion: 'desc' }
            : estado === 'TRATADO' ? { fechaCierre: 'desc' }
            : { createdAt: 'desc' };

    const [manifiestos, total] = await Promise.all([
      prisma.manifiesto.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: {
          generador: true,
          transportista: true,
          operador: true,
          residuos: {
            include: {
              tipoResiduo: true
            }
          },
          eventos: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      }),
      prisma.manifiesto.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        manifiestos,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener manifiesto por ID
export const getManifiestoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        generador: true,
        transportista: {
          include: {
            vehiculos: true,
            choferes: true
          }
        },
        operador: true,
        residuos: {
          include: {
            tipoResiduo: true
          }
        },
        eventos: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: {
              select: {
                nombre: true,
                apellido: true,
                rol: true
              }
            }
          }
        },
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    res.json({
      success: true,
      data: { manifiesto }
    });
  } catch (error) {
    next(error);
  }
};

// Dashboard estadisticas
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = {};

    // Filtrar segun rol
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      where.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      where.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      where.operadorId = req.user.operador.id;
    }

    // Contar manifiestos por estado
    const [borradores, aprobados, enTransito, entregados, recibidos, enTratamiento, tratados, rechazados, cancelados, total] = await Promise.all([
      prisma.manifiesto.count({ where: { ...where, estado: 'BORRADOR' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'APROBADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'EN_TRANSITO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'ENTREGADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'RECIBIDO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'EN_TRATAMIENTO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'TRATADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'RECHAZADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'CANCELADO' } }),
      prisma.manifiesto.count({ where })
    ]);

    // Obtener manifiestos recientes
    const recientes = await prisma.manifiesto.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        generador: true,
        transportista: true,
        operador: true
      }
    });

    // Manifiestos en transito con ultimo tracking
    const enTransitoList = await prisma.manifiesto.findMany({
      where: { ...where, estado: 'EN_TRANSITO' },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    res.json({
      success: true,
      data: {
        estadisticas: {
          borradores,
          aprobados,
          enTransito,
          entregados,
          recibidos,
          enTratamiento,
          tratados,
          rechazados,
          cancelados,
          total
        },
        recientes,
        enTransitoList
      }
    });
  } catch (error) {
    next(error);
  }
};

// Sincronizacion Inicial para Transportista (CU-T01)
// Descarga tablas maestras para operacion offline
export const getSyncInicial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verificar que sea transportista u operador
    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Endpoint disponible solo para transportistas y operadores', 403);
    }

    // Obtener catalogo de residuos activos
    const catalogoResiduos = await prisma.tipoResiduo.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        categoria: true,
        peligrosidad: true
      }
    });

    // Obtener operadores con sus datos de ubicacion
    const operadores = await prisma.operador.findMany({
      where: { activo: true },
      select: {
        id: true,
        razonSocial: true,
        cuit: true,
        domicilio: true,
        telefono: true,
        email: true,
        categoria: true
      }
    });

    // Obtener manifiestos asignados al usuario (segun rol)
    let manifiestos: any[] = [];

    if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      manifiestos = await prisma.manifiesto.findMany({
        where: {
          transportistaId: req.user.transportista.id,
          estado: { in: ['APROBADO', 'EN_TRANSITO'] }
        },
        include: {
          generador: {
            select: {
              id: true,
              razonSocial: true,
              domicilio: true,
              telefono: true
            }
          },
          operador: {
            select: {
              id: true,
              razonSocial: true,
              domicilio: true,
              telefono: true
            }
          },
          residuos: {
            include: {
              tipoResiduo: {
                select: {
                  codigo: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      manifiestos = await prisma.manifiesto.findMany({
        where: {
          operadorId: req.user.operador.id,
          estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
        },
        include: {
          generador: {
            select: {
              id: true,
              razonSocial: true
            }
          },
          transportista: {
            select: {
              id: true,
              razonSocial: true
            }
          },
          residuos: {
            include: {
              tipoResiduo: {
                select: {
                  codigo: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    }

    // Timestamp de sincronizacion
    const syncTimestamp = new Date().toISOString();

    res.json({
      success: true,
      data: {
        syncTimestamp,
        catalogoResiduos,
        operadores,
        manifiestos,
        version: '1.0.0' // Para control de version del schema offline
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lista de Manifiestos Esperados para Operador (CU-O03)
// Validacion QR offline contra lista pre-descargada
export const getManifiestosEsperados = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') || (req.user.rol === 'OPERADOR' && !req.user.operador)) {
      throw new AppError('Solo los operadores pueden acceder a esta funcion', 403);
    }

    // Build where clause - ADMIN sees all, OPERADOR sees only their own
    const whereClause: any = {
      estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
    };
    if (req.user.rol === 'OPERADOR' && req.user.operador) {
      whereClause.operadorId = req.user.operador.id;
    }

    // Obtener manifiestos que estan en camino o ya llegaron (pendientes de recepcion)
    const esperados = await prisma.manifiesto.findMany({
      where: whereClause,
      select: {
        id: true,
        numero: true,
        estado: true,
        qrCode: true,
        generador: {
          select: {
            razonSocial: true,
            cuit: true
          }
        },
        transportista: {
          select: {
            razonSocial: true,
            cuit: true
          }
        },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: {
              select: {
                codigo: true,
                nombre: true
              }
            }
          }
        },
        fechaFirma: true,
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            latitud: true,
            longitud: true,
            timestamp: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular ETA estimado para cada manifiesto en transito
    const esperadosConETA = esperados.map(m => ({
      ...m,
      etaEstimado: m.estado === 'EN_TRANSITO' && m.tracking.length > 0
        ? 'Calculando...' // En una implementacion real, usariamos API de rutas
        : m.estado === 'ENTREGADO' ? 'Ya arribo' : 'No disponible'
    }));

    res.json({
      success: true,
      data: {
        esperados: esperadosConETA,
        total: esperados.length,
        syncTimestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

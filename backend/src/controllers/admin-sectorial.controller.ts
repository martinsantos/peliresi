import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { loggerService } from '../services/logger.service';

// ============================================================
// NORMALIZACIÓN DE DEPARTAMENTOS DE MENDOZA
// ============================================================
const DEPARTAMENTO_NORMALIZATION: Record<string, string> = {
  // Capital / Mendoza (todas las variantes)
  'CAPITAL': 'CAPITAL',
  'CIUDAD': 'CAPITAL',
  'CIUDAD DE MENDOZA': 'CAPITAL',
  'MENDOZA': 'CAPITAL',
  'CAPITAL - MZA': 'CAPITAL',
  'CAPITAL-MZA': 'CAPITAL',
  'CAPITAL MZA': 'CAPITAL',
  'CAPITAL MENDOZA': 'CAPITAL',
  'MZA': 'CAPITAL',
  'MZA CAPITAL': 'CAPITAL',
  // CABA
  'CABA': 'CABA (BUENOS AIRES)',
  'CABA (BUENOS AIRES)': 'CABA (BUENOS AIRES)',
  'BUENOS AIRES': 'BUENOS AIRES',
  // Godoy Cruz
  'GODOY CRUZ': 'GODOY CRUZ',
  'GODOYCRUZ': 'GODOY CRUZ',
  'GODOY CRUZ-LUJAN DE CUYO': 'GODOY CRUZ',
  'GODOY CRUZ - LUJAN DE CUYO': 'GODOY CRUZ',
  'GODOY CRUZ/LUJAN DE CUYO': 'GODOY CRUZ',
  // Guaymallén
  'GUAYMALLEN': 'GUAYMALLÉN',
  'GUAYMLLEN': 'GUAYMALLÉN',
  'GUYMALLEN': 'GUAYMALLÉN',
  'GIUAYMALLEN': 'GUAYMALLÉN',
  'GUAYMALEN': 'GUAYMALLÉN',
  'GUAIMALLEN': 'GUAYMALLÉN',
  // Las Heras
  'LAS HERAS': 'LAS HERAS',
  'LA HERAS': 'LAS HERAS',
  'LASHERAS': 'LAS HERAS',
  // Luján de Cuyo
  'LUJAN DE CUYO': 'LUJÁN DE CUYO',
  'LUJN DE CUYO': 'LUJÁN DE CUYO',
  'LUJAN  DE CUYO': 'LUJÁN DE CUYO',
  'LUJA DE CUYO': 'LUJÁN DE CUYO',
  'LUJAN DEL CUYO': 'LUJÁN DE CUYO',
  'LUJAN': 'LUJÁN DE CUYO',
  // Maipú
  'MAIPU': 'MAIPÚ',
  'MIPU': 'MAIPÚ',
  'MAPU': 'MAIPÚ',
  // Malargüe
  'MALARGUE': 'MALARGÜE',
  'MALARGÜE': 'MALARGÜE',
  // San Martín
  'SAN MARTIN': 'SAN MARTÍN',
  'SAN MRTIN': 'SAN MARTÍN',
  'SANMARTIN': 'SAN MARTÍN',
  // San Rafael (todas las variantes con errores de tipeo)
  'SAN RAFAEL': 'SAN RAFAEL',
  'SAN RDFAEL': 'SAN RAFAEL',
  'SAN RFAEL': 'SAN RAFAEL',
  'SAN RAFEL': 'SAN RAFAEL',
  'SANRAFAEL': 'SAN RAFAEL',
  'SN RAFAEL': 'SAN RAFAEL',
  // General Alvear
  'GENERAL ALVEAR': 'GENERAL ALVEAR',
  'GRAL. ALVEAR': 'GENERAL ALVEAR',
  'GRAL.  ALVEAR': 'GENERAL ALVEAR',
  'GRAL ALVEAR': 'GENERAL ALVEAR',
  'GENERALALVEAR': 'GENERAL ALVEAR',
  // Tunuyán
  'TUNUYAN': 'TUNUYÁN',
  'TUNUYÁN': 'TUNUYÁN',
  // Tupungato
  'TUPUNGATO': 'TUPUNGATO',
  // Junín
  'JUNIN': 'JUNÍN',
  'JUNÍN': 'JUNÍN',
  // Otros departamentos de Mendoza
  'RIVADAVIA': 'RIVADAVIA',
  'SAN CARLOS': 'SAN CARLOS',
  'SANTA ROSA': 'SANTA ROSA',
  'LA PAZ': 'LA PAZ',
  'LAVALLE': 'LAVALLE',
  // Otras provincias
  'GENERAL ROCA': 'GENERAL ROCA (RÍO NEGRO)',
  'GENERAL ROCA (RÍO NEGRO)': 'GENERAL ROCA (RÍO NEGRO)',
  'CORDOBA': 'CÓRDOBA',
  'CÓRDOBA': 'CÓRDOBA'
};

// Lista oficial de departamentos de Mendoza
const DEPARTAMENTOS_MENDOZA = [
  'CAPITAL',
  'GENERAL ALVEAR',
  'GODOY CRUZ',
  'GUAYMALLÉN',
  'JUNÍN',
  'LA PAZ',
  'LAS HERAS',
  'LAVALLE',
  'LUJÁN DE CUYO',
  'MAIPÚ',
  'MALARGÜE',
  'RIVADAVIA',
  'SAN CARLOS',
  'SAN MARTÍN',
  'SAN RAFAEL',
  'SANTA ROSA',
  'TUNUYÁN',
  'TUPUNGATO'
];

/**
 * Normaliza el nombre de un departamento a su forma canónica
 */
function normalizarDepartamento(depto: string | null | undefined): string | null {
  if (!depto) return null;
  const upper = depto.trim().toUpperCase();
  return DEPARTAMENTO_NORMALIZATION[upper] || upper;
}

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

// Campos permitidos para sorting de Transportistas
const TRANSPORTISTAS_SORTABLE_FIELDS = ['razonSocial', 'cuit', 'createdAt', 'activo'];

export const getTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 15, activo, busqueda, sortBy, sortOrder, tipoResiduoId } = req.query;

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
    // Filtro por tipo de residuo - transportistas que han transportado ese tipo
    if (tipoResiduoId) {
      where.manifiestos = {
        some: {
          residuos: {
            some: { tipoResiduoId: String(tipoResiduoId) }
          }
        }
      };
    }

    // Construir orderBy dinámico
    const sortDirection: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy: Record<string, 'asc' | 'desc'> = sortBy && TRANSPORTISTAS_SORTABLE_FIELDS.includes(sortBy as string)
      ? { [sortBy as string]: sortDirection }
      : { createdAt: 'desc' };

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
        orderBy
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

// GET transportista by ID
export const getTransportistaById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const transportista = await prisma.transportista.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
            activo: true,
            aprobado: true
          }
        },
        vehiculos: {
          select: {
            id: true,
            patente: true,
            marca: true,
            modelo: true,
            anio: true,
            capacidad: true,
            activo: true
          }
        },
        choferes: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            licencia: true,
            activo: true
          }
        },
        _count: { select: { manifiestos: true } },
        manifiestos: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaCreacion: true
          }
        }
      }
    });

    if (!transportista) {
      throw new AppError('Transportista no encontrado', 404);
    }

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DETALLE_TRANSPORTISTA',
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
      data: { transportista }
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE transportista
export const updateTransportistaAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { razonSocial, domicilio, telefono, numeroHabilitacion, activo } = req.body;

    const transportista = await prisma.transportista.findUnique({ where: { id } });
    if (!transportista) {
      throw new AppError('Transportista no encontrado', 404);
    }

    const updated = await prisma.transportista.update({
      where: { id },
      data: {
        ...(razonSocial !== undefined && { razonSocial }),
        ...(domicilio !== undefined && { domicilio }),
        ...(telefono !== undefined && { telefono }),
        ...(numeroHabilitacion !== undefined && { numeroHabilitacion }),
        ...(activo !== undefined && { activo })
      }
    });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'ACTUALIZAR_TRANSPORTISTA',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        cambios: req.body,
        razonSocial: updated.razonSocial
      }
    });

    res.json({
      success: true,
      message: 'Transportista actualizado correctamente',
      data: { transportista: updated }
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

// Campos permitidos para sorting de Operadores
const OPERADORES_SORTABLE_FIELDS = ['razonSocial', 'cuit', 'createdAt', 'activo', 'categoria'];

export const getOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 15, activo, busqueda, sortBy, sortOrder, tipoResiduoId } = req.query;

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
    // Filtro por tipo de residuo - operadores autorizados a tratar ese tipo
    if (tipoResiduoId) {
      where.tratamientos = {
        some: { tipoResiduoId: String(tipoResiduoId) }
      };
    }

    // Construir orderBy dinámico
    const sortDirectionOp: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy: Record<string, 'asc' | 'desc'> = sortBy && OPERADORES_SORTABLE_FIELDS.includes(sortBy as string)
      ? { [sortBy as string]: sortDirectionOp }
      : { createdAt: 'desc' };

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
        orderBy
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

// GET operador by ID
export const getOperadorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const operador = await prisma.operador.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
            activo: true,
            aprobado: true
          }
        },
        tratamientos: {
          include: {
            tipoResiduo: {
              select: {
                id: true,
                codigo: true,
                nombre: true
              }
            }
          }
        },
        _count: { select: { manifiestos: true } },
        manifiestos: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaCreacion: true
          }
        }
      }
    });

    if (!operador) {
      throw new AppError('Operador no encontrado', 404);
    }

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DETALLE_OPERADOR',
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
      data: { operador }
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE operador
export const updateOperadorAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { razonSocial, domicilio, telefono, numeroHabilitacion, categoria, activo } = req.body;

    const operador = await prisma.operador.findUnique({ where: { id } });
    if (!operador) {
      throw new AppError('Operador no encontrado', 404);
    }

    const updated = await prisma.operador.update({
      where: { id },
      data: {
        ...(razonSocial !== undefined && { razonSocial }),
        ...(domicilio !== undefined && { domicilio }),
        ...(telefono !== undefined && { telefono }),
        ...(numeroHabilitacion !== undefined && { numeroHabilitacion }),
        ...(categoria !== undefined && { categoria }),
        ...(activo !== undefined && { activo })
      }
    });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'ACTUALIZAR_OPERADOR',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        cambios: req.body,
        razonSocial: updated.razonSocial
      }
    });

    res.json({
      success: true,
      message: 'Operador actualizado correctamente',
      data: { operador: updated }
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

// Campos permitidos para sorting (validación de seguridad)
const GENERADOR_SORTABLE_FIELDS = [
  'razonSocial', 'cuit', 'createdAt', 'numeroInscripcion',
  'domicilioLegalDepartamento', 'rubro', 'clasificacion', 'activo',
  'certificado', 'actividad'
];

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      activo,
      busqueda,
      sortBy,
      sortOrder,
      departamento,
      categoria,
      rubro,
      clasificacion,
      tipoResiduoId
    } = req.query;

    // Construir filtros usando AND para combinar condiciones
    const andConditions: any[] = [];

    // Filtro por estado activo/inactivo
    if (activo !== undefined) {
      andConditions.push({ activo: activo === 'true' });
    }

    // Filtro por búsqueda (razón social o CUIT)
    if (busqueda) {
      andConditions.push({
        OR: [
          { razonSocial: { contains: busqueda as string, mode: 'insensitive' } },
          { cuit: { contains: busqueda as string } }
        ]
      });
    }

    // Filtro por departamento (normalizado)
    if (departamento) {
      // Buscar departamentos que coincidan con el filtro normalizado
      // Necesitamos buscar todas las variantes que se normalizan al mismo departamento
      const deptoNormalizado = departamento as string;
      const variantesDepto = Object.entries(DEPARTAMENTO_NORMALIZATION)
        .filter(([_, norm]) => norm === deptoNormalizado)
        .map(([variant, _]) => variant);

      // Agregar el departamento original también
      if (!variantesDepto.includes(deptoNormalizado)) {
        variantesDepto.push(deptoNormalizado);
      }

      andConditions.push({
        OR: variantesDepto.flatMap(variant => [
          { domicilioLegalDepartamento: { equals: variant, mode: 'insensitive' } },
          { domicilioRealDepartamento: { equals: variant, mode: 'insensitive' } }
        ])
      });
    }

    // Filtro por categoría de residuos (Y-codes)
    if (categoria) {
      andConditions.push({
        categoria: { contains: categoria as string, mode: 'insensitive' }
      });
    }

    // Filtro por rubro
    if (rubro) {
      andConditions.push({
        rubro: { contains: rubro as string, mode: 'insensitive' }
      });
    }

    // Filtro por clasificación
    if (clasificacion) {
      andConditions.push({
        clasificacion: { equals: clasificacion as string, mode: 'insensitive' }
      });
    }

    // Filtro por tipo de residuo (Y-codes Basel) - busca generadores con manifiestos que contengan ese tipo
    if (tipoResiduoId) {
      andConditions.push({
        manifiestos: {
          some: {
            residuos: {
              some: { tipoResiduoId: String(tipoResiduoId) }
            }
          }
        }
      });
    }

    // Construir where final
    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    // Construir orderBy dinámico con validación de seguridad
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
    if (sortBy && GENERADOR_SORTABLE_FIELDS.includes(sortBy as string)) {
      orderBy = { [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc' };
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
        orderBy
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

// ============================================================
// FILTROS DISPONIBLES PARA GENERADORES
// ============================================================

export const getGeneradoresFiltrosDisponibles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Obtener datos únicos de la BD
    const [departamentosLegal, departamentosReal, rubros, clasificaciones, actividades, tiposResiduo] = await Promise.all([
      prisma.generador.findMany({
        where: { domicilioLegalDepartamento: { not: null } },
        select: { domicilioLegalDepartamento: true },
        distinct: ['domicilioLegalDepartamento']
      }),
      prisma.generador.findMany({
        where: { domicilioRealDepartamento: { not: null } },
        select: { domicilioRealDepartamento: true },
        distinct: ['domicilioRealDepartamento']
      }),
      prisma.generador.findMany({
        where: { rubro: { not: null } },
        select: { rubro: true },
        distinct: ['rubro']
      }),
      prisma.generador.findMany({
        where: { clasificacion: { not: null } },
        select: { clasificacion: true },
        distinct: ['clasificacion']
      }),
      prisma.generador.findMany({
        where: { actividad: { not: null } },
        select: { actividad: true },
        distinct: ['actividad']
      }),
      // Obtener tipos de residuo (Y-codes Basel)
      prisma.tipoResiduo.findMany({
        where: { activo: true },
        select: { id: true, codigo: true, nombre: true, peligrosidad: true },
        orderBy: { codigo: 'asc' }
      })
    ]);

    // Normalizar y deduplicar departamentos
    const deptosNormalizados = new Set<string>();
    departamentosLegal.forEach(d => {
      const norm = normalizarDepartamento(d.domicilioLegalDepartamento);
      if (norm) deptosNormalizados.add(norm);
    });
    departamentosReal.forEach(d => {
      const norm = normalizarDepartamento(d.domicilioRealDepartamento);
      if (norm) deptosNormalizados.add(norm);
    });

    // Ordenar departamentos: primero los de Mendoza, luego otros
    const deptosArray = Array.from(deptosNormalizados);
    const deptosMendoza = deptosArray.filter(d => DEPARTAMENTOS_MENDOZA.includes(d)).sort();
    const deptosOtros = deptosArray.filter(d => !DEPARTAMENTOS_MENDOZA.includes(d)).sort();

    res.json({
      success: true,
      data: {
        departamentos: [...deptosMendoza, ...deptosOtros],
        departamentosMendoza: DEPARTAMENTOS_MENDOZA,
        rubros: rubros.map(r => r.rubro).filter(Boolean).sort(),
        clasificaciones: clasificaciones.map(c => c.clasificacion).filter(Boolean).sort(),
        actividades: actividades.map(a => a.actividad).filter(Boolean).sort(),
        tiposResiduo: tiposResiduo,
        camposOrdenables: GENERADOR_SORTABLE_FIELDS
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FILTROS DISPONIBLES PARA TRANSPORTISTAS
// ============================================================

export const getTransportistasFiltrosDisponibles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tiposResiduo = await prisma.tipoResiduo.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true, peligrosidad: true },
      orderBy: { codigo: 'asc' }
    });

    res.json({
      success: true,
      data: {
        tiposResiduo,
        camposOrdenables: TRANSPORTISTAS_SORTABLE_FIELDS
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FILTROS DISPONIBLES PARA OPERADORES
// ============================================================

export const getOperadoresFiltrosDisponibles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tiposResiduo = await prisma.tipoResiduo.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true, peligrosidad: true },
      orderBy: { codigo: 'asc' }
    });

    res.json({
      success: true,
      data: {
        tiposResiduo,
        camposOrdenables: OPERADORES_SORTABLE_FIELDS
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GENERADOR DETALLE - GET, UPDATE, DELETE
// ============================================================

export const getGeneradorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const generador = await prisma.generador.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
            activo: true,
            aprobado: true
          }
        },
        _count: { select: { manifiestos: true } },
        manifiestos: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaCreacion: true
          }
        }
      }
    });

    if (!generador) {
      throw new AppError('Generador no encontrado', 404);
    }

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'VER_DETALLE_GENERADOR',
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
      data: { generador }
    });
  } catch (error) {
    next(error);
  }
};

export const updateGeneradorAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo } = req.body;

    const generador = await prisma.generador.findUnique({ where: { id } });
    if (!generador) {
      throw new AppError('Generador no encontrado', 404);
    }

    const updated = await prisma.generador.update({
      where: { id },
      data: {
        ...(razonSocial !== undefined && { razonSocial }),
        ...(domicilio !== undefined && { domicilio }),
        ...(telefono !== undefined && { telefono }),
        ...(email !== undefined && { email }),
        ...(numeroInscripcion !== undefined && { numeroInscripcion }),
        ...(categoria !== undefined && { categoria }),
        ...(activo !== undefined && { activo })
      }
    });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'ACTUALIZAR_GENERADOR',
      modulo: 'ADMIN_SECTORIAL',
      entidadId: id,
      detalles: {
        rolUsuario: req.user.rol,
        generadorId: id,
        cambios: req.body
      }
    });

    res.json({
      success: true,
      data: { generador: updated },
      message: 'Generador actualizado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteGeneradorAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const generador = await prisma.generador.findUnique({
      where: { id },
      include: { _count: { select: { manifiestos: true } } }
    });

    if (!generador) {
      throw new AppError('Generador no encontrado', 404);
    }

    if (generador._count.manifiestos > 0) {
      throw new AppError('No se puede eliminar un generador con manifiestos asociados', 400);
    }

    // Eliminar generador y su usuario
    await prisma.generador.delete({ where: { id } });
    await prisma.usuario.delete({ where: { id: generador.usuarioId } });

    await loggerService.registrar({
      usuarioId: req.user.id,
      accion: 'ELIMINAR_GENERADOR',
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
      message: 'Generador eliminado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

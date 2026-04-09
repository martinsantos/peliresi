import { Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { parsePagination } from '../utils/pagination';
import { applyRoleFilter, isFullAccess as checkFullAccess } from '../utils/roleFilter';
import { MANIFIESTO_LIST_INCLUDE } from '../utils/manifiestoIncludes';
import { parseDateRange } from '../utils/dateRange';

// Sanitize CSV cell to prevent CSV injection (formula injection via =, +, -, @, \t, \r)
function sanitizeCsvCell(value: any): string {
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

// Reporte de manifiestos por período (CU-A11) — with pagination + SQL aggregation
export const reporteManifiestosPorPeriodo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, estado, tipoResiduoId, page, limit } = req.query;

        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 100, maxLimit: 500 }
        );

        const where: any = {};

        // Filtros de fecha (validados)
        const dateFilter = parseDateRange(fechaInicio, fechaFin);
        if (dateFilter) where.createdAt = dateFilter;

        // Filtrar por estado
        if (estado) where.estado = estado;

        // Filtrar por tipo de residuo
        if (tipoResiduoId) {
            where.residuos = { some: { tipoResiduoId: tipoResiduoId as string } };
        }

        // Filtrar por rol (ADMIN, ADMIN_*, esInspector → sin filtro)
        applyRoleFilter(where, req.user);

        // Run paginated query + count + aggregations in parallel
        const [manifiestos, totalCount, porEstadoRaw, totalResiduosAgg] = await Promise.all([
            prisma.manifiesto.findMany({
                where,
                include: MANIFIESTO_LIST_INCLUDE,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma.manifiesto.count({ where }),
            prisma.manifiesto.groupBy({
                by: ['estado'],
                where,
                _count: true,
            }),
            prisma.manifiestoResiduo.aggregate({
                where: { manifiesto: where },
                _sum: { cantidad: true },
            }),
        ]);

        // Build porEstado from groupBy
        const porEstado: Record<string, number> = {};
        for (const row of porEstadoRaw) {
            porEstado[row.estado] = row._count;
        }

        // Agrupar por tipo de residuo (from the paginated set — lightweight)
        const porTipoResiduo: Record<string, { cantidad: number; unidad: string }> = {};
        manifiestos.forEach(m => {
            m.residuos.forEach(r => {
                const key = r.tipoResiduo.nombre;
                if (!porTipoResiduo[key]) {
                    porTipoResiduo[key] = { cantidad: 0, unidad: r.unidad };
                }
                porTipoResiduo[key].cantidad += r.cantidad;
            });
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalManifiestos: totalCount,
                    totalResiduos: totalResiduosAgg._sum.cantidad || 0,
                    periodo: {
                        desde: fechaInicio || 'Sin límite',
                        hasta: fechaFin || 'Sin límite'
                    }
                },
                porEstado,
                porTipoResiduo,
                manifiestos: manifiestos.map(m => ({
                    id: m.id,
                    numero: m.numero,
                    estado: m.estado,
                    createdAt: m.createdAt,
                    generador: m.generador.razonSocial,
                    transportista: m.transportista?.razonSocial ?? null,
                    operador: m.operador.razonSocial,
                    residuos: m.residuos.map(r => ({
                        tipo: r.tipoResiduo.nombre,
                        cantidad: r.cantidad,
                        unidad: r.unidad
                    }))
                })),
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limitNum),
                },
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reporte de residuos tratados por operador (CU-O12) — with pagination
export const reporteResiduosTratados = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, page, limit } = req.query;

        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 100, maxLimit: 500 }
        );

        const where: any = {
            estado: 'TRATADO'
        };

        // Filtros de fecha (validados)
        const dateFilter2 = parseDateRange(fechaInicio, fechaFin);
        if (dateFilter2) where.fechaCierre = dateFilter2;

        // Filtrar por rol (ADMIN, ADMIN_*, esInspector → sin filtro)
        applyRoleFilter(where, req.user);

        const [manifiestos, totalCount] = await Promise.all([
            prisma.manifiesto.findMany({
                where,
                include: {
                    generador: { select: { razonSocial: true, cuit: true } },
                    operador: { select: { razonSocial: true, cuit: true } },
                    residuos: { include: { tipoResiduo: true } },
                    eventos: {
                        where: { tipo: { in: ['TRATAMIENTO', 'CIERRE'] } },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                },
                orderBy: { fechaCierre: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma.manifiesto.count({ where }),
        ]);

        // Agrupar por generador
        const porGenerador: Record<string, number> = {};
        manifiestos.forEach(m => {
            porGenerador[m.generador.razonSocial] = (porGenerador[m.generador.razonSocial] || 0) + 1;
        });

        // Total de residuos tratados
        const totalPorTipo: Record<string, number> = {};
        manifiestos.forEach(m => {
            m.residuos.forEach(r => {
                const key = r.tipoResiduo?.codigo ?? 'DESCONOCIDO';
                totalPorTipo[key] = (totalPorTipo[key] || 0) + r.cantidad;
            });
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalManifiestosTratados: totalCount,
                    totalResiduosTratados: manifiestos.reduce((acc, m) =>
                        acc + m.residuos.reduce((sum, r) => sum + r.cantidad, 0), 0
                    ),
                    periodo: {
                        desde: fechaInicio || 'Sin límite',
                        hasta: fechaFin || 'Sin límite'
                    }
                },
                porGenerador,
                totalPorTipo,
                detalle: manifiestos.map(m => ({
                    id: m.id,
                    numero: m.numero,
                    fechaTratamiento: m.fechaCierre,
                    generador: m.generador.razonSocial,
                    metodoTratamiento: m.eventos[0]?.descripcion || 'N/A',
                    residuos: m.residuos.map(r => ({
                        codigo: r.tipoResiduo.codigo,
                        nombre: r.tipoResiduo.nombre,
                        cantidad: r.cantidad,
                        unidad: r.unidad
                    }))
                })),
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limitNum),
                },
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reporte de transporte — with pagination + _count aggregation
export const reporteTransporte = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, page, limit } = req.query;

        const { skip, take: limitNum, page: pageNum } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 50, maxLimit: 200 }
        );

        const manifiestoWhere: any = {};

        const dateFilter3 = parseDateRange(fechaInicio, fechaFin);
        if (dateFilter3) manifiestoWhere.createdAt = dateFilter3;

        // Role-based filtering (ADMIN, ADMIN_*, esInspector → sin filtro)
        const isFullAccess = checkFullAccess(req.user);
        const transportistaWhere: any = {};

        if (!isFullAccess) {
            if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
                // Only show their own company
                transportistaWhere.id = req.user.transportista.id;
            } else if (req.user.rol === 'GENERADOR' && req.user.generador) {
                // Only show transportistas involved in their manifiestos
                const involvedIds = await prisma.manifiesto.findMany({
                    where: { generadorId: req.user.generador.id },
                    select: { transportistaId: true },
                    distinct: ['transportistaId'],
                });
                transportistaWhere.id = { in: involvedIds.map(m => m.transportistaId).filter(Boolean) };
            } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
                // Only show transportistas that delivered to them
                const involvedIds = await prisma.manifiesto.findMany({
                    where: { operadorId: req.user.operador.id },
                    select: { transportistaId: true },
                    distinct: ['transportistaId'],
                });
                transportistaWhere.id = { in: involvedIds.map(m => m.transportistaId).filter(Boolean) };
            }
        }

        // Get total count + paginated transportistas with _count instead of full manifiestos
        const [totalTransportistas, transportistas] = await Promise.all([
            prisma.transportista.count({ where: transportistaWhere }),
            prisma.transportista.findMany({
                where: transportistaWhere,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    razonSocial: true,
                    cuit: true,
                    _count: {
                        select: {
                            vehiculos: true,
                            choferes: true,
                        },
                    },
                    manifiestos: {
                        where: manifiestoWhere,
                        select: {
                            estado: true,
                        },
                    },
                },
            }),
        ]);

        const reporteTransportistas = transportistas.map(t => {
            const totalViajes = t.manifiestos.length;
            const completados = t.manifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').length;
            const enTransito = t.manifiestos.filter(m => m.estado === 'EN_TRANSITO').length;
            const pendientes = t.manifiestos.filter(m => m.estado === 'APROBADO').length;

            return {
                transportistaId: t.id,
                transportista: t.razonSocial,
                cuit: t.cuit,
                totalViajes,
                completados,
                enTransito,
                pendientes,
                vehiculosRegistrados: t._count.vehiculos,
                choferesRegistrados: t._count.choferes,
                tasaCompletitud: totalViajes > 0 ? ((completados / totalViajes) * 100).toFixed(1) + '%' : '0%'
            };
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalTransportistas,
                    totalViajes: reporteTransportistas.reduce((acc, t) => acc + t.totalViajes, 0),
                    viajesActivos: reporteTransportistas.reduce((acc, t) => acc + t.enTransito, 0)
                },
                transportistas: reporteTransportistas.sort((a, b) => b.totalViajes - a.totalViajes),
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalTransportistas,
                    pages: Math.ceil(totalTransportistas / limitNum),
                },
            }
        });
    } catch (error) {
        next(error);
    }
};

// Log de Auditoría (CU-A10)
export const getLogAuditoria = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Solo admin puede ver el log completo
        if (req.user.rol !== 'ADMIN') {
            throw new AppError('Acceso no autorizado', 403);
        }

        const { fechaInicio, fechaFin, tipo, manifiestoId, usuarioId, accion, page, limit, sortBy, sortOrder } = req.query;
        const { skip, take: limitNum, page: pageNum, limit: limitVal } = parsePagination(
            { page: page as string, limit: limit as string },
            { limit: 200, maxLimit: 1000 }
        );

        const where: any = {};

        const auditDateFilter = parseDateRange(fechaInicio, fechaFin);
        if (auditDateFilter) where.createdAt = auditDateFilter;

        if (tipo) where.tipo = tipo;
        if (accion) where.tipo = accion;
        if (manifiestoId) where.manifiestoId = manifiestoId;
        if (usuarioId) where.usuarioId = usuarioId;

        // Build orderBy — supports sorting by usuario.nombre, tipo, createdAt
        const dir = (sortOrder as string) === 'asc' ? 'asc' : 'desc';
        let orderBy: any = { createdAt: dir };
        if (sortBy === 'usuario') orderBy = { usuario: { nombre: dir } };
        else if (sortBy === 'tipo' || sortBy === 'accion') orderBy = { tipo: dir };

        const [eventos, total] = await Promise.all([
            prisma.eventoManifiesto.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                include: {
                    usuario: {
                        select: { nombre: true, apellido: true, email: true, rol: true }
                    },
                    manifiesto: {
                        select: { numero: true }
                    }
                }
            }),
            prisma.eventoManifiesto.count({ where })
        ]);

        // Agrupar por tipo de evento
        const porTipo = await prisma.eventoManifiesto.groupBy({
            by: ['tipo'],
            _count: true,
            where
        });

        res.json({
            success: true,
            data: {
                eventos: eventos.map(e => ({
                    id: e.id,
                    fecha: e.createdAt,
                    tipo: e.tipo,
                    descripcion: e.descripcion,
                    manifiestoNumero: e.manifiesto.numero,
                    usuario: e.usuario ? `${e.usuario.nombre} ${e.usuario.apellido}` : 'Sistema',
                    rol: e.usuario?.rol || 'SISTEMA',
                    ubicacion: e.latitud && e.longitud ? { lat: e.latitud, lng: e.longitud } : null
                })),
                resumen: {
                    total,
                    porTipo: porTipo.reduce((acc: Record<string, number>, p) => {
                        acc[p.tipo] = p._count;
                        return acc;
                    }, {})
                },
                pagination: {
                    page: pageNum,
                    limit: limitVal,
                    total,
                    pages: Math.ceil(total / limitVal)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Exportar datos a CSV (CU-A12) — with row limit
const CSV_MAX_ROWS = 10000;

export const exportarCSV = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { tipo } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        const where: any = {};
        const csvDateFilter = parseDateRange(fechaInicio, fechaFin);
        if (csvDateFilter) where.createdAt = csvDateFilter;

        let csvContent = '';
        let filename = '';

        switch (tipo) {
            case 'manifiestos':
                const manifiestos = await prisma.manifiesto.findMany({
                    where,
                    include: {
                        generador: true,
                        transportista: true,
                        operador: true,
                        residuos: { include: { tipoResiduo: true } }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: CSV_MAX_ROWS,
                });

                csvContent = 'Numero,Estado,Generador,Transportista,Operador,FechaCreacion,FechaFirma,FechaRetiro,FechaEntrega,FechaRecepcion,FechaCierre,Residuo,Cantidad,Unidad\n';

                manifiestos.forEach(m => {
                    m.residuos.forEach(r => {
                        csvContent += `"${sanitizeCsvCell(m.numero)}","${sanitizeCsvCell(m.estado)}","${sanitizeCsvCell(m.generador.razonSocial)}","${sanitizeCsvCell(m.transportista?.razonSocial ?? 'IN SITU')}","${sanitizeCsvCell(m.operador.razonSocial)}","${m.createdAt.toISOString()}","${m.fechaFirma?.toISOString() || ''}","${m.fechaRetiro?.toISOString() || ''}","${m.fechaEntrega?.toISOString() || ''}","${m.fechaRecepcion?.toISOString() || ''}","${m.fechaCierre?.toISOString() || ''}","${sanitizeCsvCell(r.tipoResiduo.nombre)}","${r.cantidad}","${r.unidad}"\n`;
                    });
                });

                filename = `manifiestos_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'generadores':
                const generadores = await prisma.generador.findMany({
                    include: { _count: { select: { manifiestos: true } } },
                    take: CSV_MAX_ROWS,
                });

                csvContent = 'RazonSocial,CUIT,Domicilio,Telefono,Email,NumeroInscripcion,Categoria,TotalManifiestos,Activo\n';

                generadores.forEach(g => {
                    csvContent += `"${sanitizeCsvCell(g.razonSocial)}","${sanitizeCsvCell(g.cuit)}","${sanitizeCsvCell(g.domicilio)}","${sanitizeCsvCell(g.telefono)}","${sanitizeCsvCell(g.email)}","${sanitizeCsvCell(g.numeroInscripcion)}","${sanitizeCsvCell(g.categoria)}","${g._count.manifiestos}","${g.activo}"\n`;
                });

                filename = `generadores_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'transportistas':
                const transportistas = await prisma.transportista.findMany({
                    include: {
                        _count: { select: { manifiestos: true, vehiculos: true, choferes: true } }
                    },
                    take: CSV_MAX_ROWS,
                });

                csvContent = 'RazonSocial,CUIT,NumeroHabilitacion,Telefono,Email,TotalManifiestos,Vehiculos,Choferes,Activo\n';

                transportistas.forEach(t => {
                    csvContent += `"${sanitizeCsvCell(t.razonSocial)}","${sanitizeCsvCell(t.cuit)}","${sanitizeCsvCell(t.numeroHabilitacion)}","${sanitizeCsvCell(t.telefono)}","${sanitizeCsvCell(t.email)}","${t._count.manifiestos}","${t._count.vehiculos}","${t._count.choferes}","${t.activo}"\n`;
                });

                filename = `transportistas_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'operadores':
                const operadores = await prisma.operador.findMany({
                    include: { _count: { select: { manifiestos: true } } },
                    take: CSV_MAX_ROWS,
                });

                csvContent = 'RazonSocial,CUIT,NumeroHabilitacion,Domicilio,Telefono,Email,Categoria,TotalManifiestos,Activo\n';

                operadores.forEach(o => {
                    csvContent += `"${sanitizeCsvCell(o.razonSocial)}","${sanitizeCsvCell(o.cuit)}","${sanitizeCsvCell(o.numeroHabilitacion)}","${sanitizeCsvCell(o.domicilio)}","${sanitizeCsvCell(o.telefono)}","${sanitizeCsvCell(o.email)}","${sanitizeCsvCell(o.categoria)}","${o._count.manifiestos}","${o.activo}"\n`;
                });

                filename = `operadores_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            default:
                throw new AppError('Tipo de exportación no válido', 400);
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send('\ufeff' + csvContent); // BOM para Excel

    } catch (error) {
        next(error);
    }
};

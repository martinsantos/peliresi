import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { normalizeRubro, normalizarDepartamento, DEPARTAMENTOS_MENDOZA, RUBROS_CANONICOS } from '../utils/normalization';

const prisma = new PrismaClient();

// Reporte de manifiestos por período (CU-A11)
// OPTIMIZADO: Paginación + filtro de tipoResiduo en query (no en JS)
export const reporteManifiestosPorPeriodo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, estado, tipoResiduoId, page = 1, limit = 100 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};

        // Filtros de fecha
        if (fechaInicio || fechaFin) {
            where.createdAt = {};
            if (fechaInicio) where.createdAt.gte = new Date(fechaInicio as string);
            if (fechaFin) where.createdAt.lte = new Date(fechaFin as string);
        }

        // Filtrar por estado
        if (estado) where.estado = estado;

        // OPTIMIZADO: Filtrar por tipo de residuo en la query (no en JS)
        if (tipoResiduoId) {
            where.residuos = {
                some: { tipoResiduoId: String(tipoResiduoId) }
            };
        }

        // Filtrar por rol
        if (req.user.rol === 'GENERADOR' && req.user.generador) {
            where.generadorId = req.user.generador.id;
        } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
            where.transportistaId = req.user.transportista.id;
        } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
            where.operadorId = req.user.operador.id;
        }

        // OPTIMIZADO: Paginación + count en paralelo
        const [manifiestos, total] = await Promise.all([
            prisma.manifiesto.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    generador: { select: { razonSocial: true, cuit: true } },
                    transportista: { select: { razonSocial: true, cuit: true } },
                    operador: { select: { razonSocial: true, cuit: true } },
                    residuos: { include: { tipoResiduo: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.manifiesto.count({ where })
        ]);

        // Ya no necesitamos filtrar en JS
        const manifiestosFiltrados = manifiestos;

        // Calcular estadísticas
        const totalResiduos = manifiestosFiltrados.reduce((acc, m) => {
            return acc + m.residuos.reduce((sum, r) => sum + r.cantidad, 0);
        }, 0);

        // Agrupar por estado
        const porEstado = manifiestosFiltrados.reduce((acc: Record<string, number>, m) => {
            acc[m.estado] = (acc[m.estado] || 0) + 1;
            return acc;
        }, {});

        // Agrupar por tipo de residuo
        const porTipoResiduo: Record<string, { cantidad: number; unidad: string }> = {};
        manifiestosFiltrados.forEach(m => {
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
                    totalManifiestos: total, // Total real de la BD
                    totalResiduos,
                    periodo: {
                        desde: fechaInicio || 'Sin límite',
                        hasta: fechaFin || 'Sin límite'
                    }
                },
                porEstado,
                porTipoResiduo,
                manifiestos: manifiestosFiltrados.map(m => ({
                    numero: m.numero,
                    estado: m.estado,
                    fechaCreacion: m.createdAt,
                    generador: m.generador.razonSocial,
                    transportista: m.transportista.razonSocial,
                    operador: m.operador.razonSocial,
                    residuos: m.residuos.map(r => ({
                        tipo: r.tipoResiduo.nombre,
                        cantidad: r.cantidad,
                        unidad: r.unidad
                    }))
                })),
                // OPTIMIZADO: Info de paginación
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

// Reporte de residuos tratados por operador (CU-O12)
export const reporteResiduosTratados = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        const where: any = {
            estado: 'TRATADO'
        };

        // Filtros de fecha
        if (fechaInicio || fechaFin) {
            where.fechaCierre = {};
            if (fechaInicio) where.fechaCierre.gte = new Date(fechaInicio as string);
            if (fechaFin) where.fechaCierre.lte = new Date(fechaFin as string);
        }

        // Filtrar por operador si no es admin
        if (req.user.rol === 'OPERADOR' && req.user.operador) {
            where.operadorId = req.user.operador.id;
        }

        const manifiestos = await prisma.manifiesto.findMany({
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
            orderBy: { fechaCierre: 'desc' }
        });

        // Agrupar por generador
        const porGenerador: Record<string, number> = {};
        manifiestos.forEach(m => {
            porGenerador[m.generador.razonSocial] = (porGenerador[m.generador.razonSocial] || 0) + 1;
        });

        // Total de residuos tratados
        const totalPorTipo: Record<string, number> = {};
        manifiestos.forEach(m => {
            m.residuos.forEach(r => {
                totalPorTipo[r.tipoResiduo.codigo] = (totalPorTipo[r.tipoResiduo.codigo] || 0) + r.cantidad;
            });
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalManifiestosTratados: manifiestos.length,
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
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reporte de transporte (estadísticas de transportistas)
export const reporteTransporte = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin } = req.query;

        const where: any = {};

        if (fechaInicio || fechaFin) {
            where.createdAt = {};
            if (fechaInicio) where.createdAt.gte = new Date(fechaInicio as string);
            if (fechaFin) where.createdAt.lte = new Date(fechaFin as string);
        }

        // Obtener todos los transportistas con sus manifiestos
        const transportistas = await prisma.transportista.findMany({
            include: {
                manifiestos: {
                    where,
                    select: {
                        estado: true,
                        createdAt: true
                    }
                },
                vehiculos: true,
                choferes: true
            }
        });

        const reporteTransportistas = transportistas.map(t => {
            const totalViajes = t.manifiestos.length;
            const completados = t.manifiestos.filter(m => m.estado === 'TRATADO' || m.estado === 'RECIBIDO').length;
            const enTransito = t.manifiestos.filter(m => m.estado === 'EN_TRANSITO').length;
            const pendientes = t.manifiestos.filter(m => m.estado === 'APROBADO').length;

            return {
                transportista: t.razonSocial,
                cuit: t.cuit,
                totalViajes,
                completados,
                enTransito,
                pendientes,
                vehiculosRegistrados: t.vehiculos.length,
                choferesRegistrados: t.choferes.length,
                tasaCompletitud: totalViajes > 0 ? ((completados / totalViajes) * 100).toFixed(1) + '%' : '0%'
            };
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalTransportistas: transportistas.length,
                    totalViajes: reporteTransportistas.reduce((acc, t) => acc + t.totalViajes, 0),
                    viajesActivos: reporteTransportistas.reduce((acc, t) => acc + t.enTransito, 0)
                },
                transportistas: reporteTransportistas.sort((a, b) => b.totalViajes - a.totalViajes)
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

        const { fechaInicio, fechaFin, tipo, manifiestoId, page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};

        if (fechaInicio || fechaFin) {
            where.createdAt = {};
            if (fechaInicio) where.createdAt.gte = new Date(fechaInicio as string);
            if (fechaFin) where.createdAt.lte = new Date(fechaFin as string);
        }

        if (tipo) where.tipo = tipo;
        if (manifiestoId) where.manifiestoId = manifiestoId;

        const [eventos, total] = await Promise.all([
            prisma.eventoManifiesto.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
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

// Exportar datos a CSV (CU-A12)
export const exportarCSV = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { tipo } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        const where: any = {};
        if (fechaInicio || fechaFin) {
            where.createdAt = {};
            if (fechaInicio) where.createdAt.gte = new Date(fechaInicio as string);
            if (fechaFin) where.createdAt.lte = new Date(fechaFin as string);
        }

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
                    orderBy: { createdAt: 'desc' }
                });

                csvContent = 'Numero,Estado,Generador,Transportista,Operador,FechaCreacion,FechaFirma,FechaRetiro,FechaEntrega,FechaRecepcion,FechaCierre,Residuo,Cantidad,Unidad\n';

                manifiestos.forEach(m => {
                    m.residuos.forEach(r => {
                        csvContent += `"${m.numero}","${m.estado}","${m.generador.razonSocial}","${m.transportista.razonSocial}","${m.operador.razonSocial}","${m.createdAt.toISOString()}","${m.fechaFirma?.toISOString() || ''}","${m.fechaRetiro?.toISOString() || ''}","${m.fechaEntrega?.toISOString() || ''}","${m.fechaRecepcion?.toISOString() || ''}","${m.fechaCierre?.toISOString() || ''}","${r.tipoResiduo.nombre}","${r.cantidad}","${r.unidad}"\n`;
                    });
                });

                filename = `manifiestos_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'generadores':
                const generadores = await prisma.generador.findMany({
                    include: { _count: { select: { manifiestos: true } } }
                });

                csvContent = 'RazonSocial,CUIT,Domicilio,Telefono,Email,NumeroInscripcion,Categoria,TotalManifiestos,Activo\n';

                generadores.forEach(g => {
                    csvContent += `"${g.razonSocial}","${g.cuit}","${g.domicilio}","${g.telefono}","${g.email}","${g.numeroInscripcion}","${g.categoria}","${g._count.manifiestos}","${g.activo}"\n`;
                });

                filename = `generadores_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'transportistas':
                const transportistas = await prisma.transportista.findMany({
                    include: {
                        _count: { select: { manifiestos: true, vehiculos: true, choferes: true } }
                    }
                });

                csvContent = 'RazonSocial,CUIT,NumeroHabilitacion,Telefono,Email,TotalManifiestos,Vehiculos,Choferes,Activo\n';

                transportistas.forEach(t => {
                    csvContent += `"${t.razonSocial}","${t.cuit}","${t.numeroHabilitacion}","${t.telefono}","${t.email}","${t._count.manifiestos}","${t._count.vehiculos}","${t._count.choferes}","${t.activo}"\n`;
                });

                filename = `transportistas_${new Date().toISOString().split('T')[0]}.csv`;
                break;

            case 'operadores':
                const operadores = await prisma.operador.findMany({
                    include: { _count: { select: { manifiestos: true } } }
                });

                csvContent = 'RazonSocial,CUIT,NumeroHabilitacion,Domicilio,Telefono,Email,Categoria,TotalManifiestos,Activo\n';

                operadores.forEach(o => {
                    csvContent += `"${o.razonSocial}","${o.cuit}","${o.numeroHabilitacion}","${o.domicilio}","${o.telefono}","${o.email}","${o.categoria}","${o._count.manifiestos}","${o.activo}"\n`;
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

// ============================================================
// REPORTES DE GENERADORES POR DEPARTAMENTO Y VOLUMEN
// ============================================================

// Reporte de generadores agrupados por departamento
export const getReporteGeneradoresDepartamento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, departamento, rubro } = req.query;

        // Construir filtro base para generadores
        const whereGenerador: any = {
            domicilioLegalDepartamento: { not: null }
        };

        // Filtrar por departamento si se especifica
        if (departamento) {
            whereGenerador.domicilioLegalDepartamento = String(departamento);
        }

        // Filtrar por rubro si se especifica
        if (rubro) {
            whereGenerador.rubro = String(rubro);
        }

        // Agrupar generadores por departamento
        const generadoresPorDepto = await prisma.generador.groupBy({
            by: ['domicilioLegalDepartamento'],
            _count: { id: true },
            where: whereGenerador
        });

        // Enriquecer con conteo de activos/inactivos y volúmenes
        const resultado = await Promise.all(
            generadoresPorDepto.map(async (grupo) => {
                const depto = grupo.domicilioLegalDepartamento;

                const whereManifiesto: any = {
                    generador: { domicilioLegalDepartamento: depto }
                };

                // Filtrar manifiestos por rubro del generador si se especifica
                if (rubro) {
                    whereManifiesto.generador.rubro = String(rubro);
                }

                // Filtro de fechas para manifiestos
                if (fechaInicio || fechaFin) {
                    whereManifiesto.createdAt = {};
                    if (fechaInicio) whereManifiesto.createdAt.gte = new Date(fechaInicio as string);
                    if (fechaFin) whereManifiesto.createdAt.lte = new Date(fechaFin as string);
                }

                // Filtro base para conteos de este departamento
                const whereDeptoBase: any = { domicilioLegalDepartamento: depto };
                if (rubro) whereDeptoBase.rubro = String(rubro);

                const [activos, inactivos, volumen, totalManifiestos] = await Promise.all([
                    prisma.generador.count({
                        where: { ...whereDeptoBase, activo: true }
                    }),
                    prisma.generador.count({
                        where: { ...whereDeptoBase, activo: false }
                    }),
                    prisma.manifiestoResiduo.aggregate({
                        _sum: { cantidad: true },
                        where: {
                            manifiesto: whereManifiesto
                        }
                    }),
                    prisma.manifiesto.count({
                        where: whereManifiesto
                    })
                ]);

                return {
                    departamento: depto,
                    totalGeneradores: grupo._count.id,
                    activos,
                    inactivos,
                    volumenKg: volumen._sum.cantidad || 0,
                    totalManifiestos
                };
            })
        );

        // Calcular totales
        const totales = resultado.reduce(
            (acc, item) => ({
                totalGeneradores: acc.totalGeneradores + item.totalGeneradores,
                totalActivos: acc.totalActivos + item.activos,
                totalInactivos: acc.totalInactivos + item.inactivos,
                totalVolumen: acc.totalVolumen + item.volumenKg,
                totalManifiestos: acc.totalManifiestos + item.totalManifiestos
            }),
            { totalGeneradores: 0, totalActivos: 0, totalInactivos: 0, totalVolumen: 0, totalManifiestos: 0 }
        );

        res.json({
            success: true,
            data: {
                departamentos: resultado.sort((a, b) => b.totalGeneradores - a.totalGeneradores),
                totales,
                periodo: {
                    desde: fechaInicio || null,
                    hasta: fechaFin || null
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Top generadores por volumen de residuos
export const getReporteGeneradoresVolumen = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, departamento, rubro, limit = '20' } = req.query;

        const whereManifiesto: any = {
            estado: { in: ['TRATADO', 'RECIBIDO', 'ENTREGADO', 'EN_TRATAMIENTO'] }
        };

        // Filtrar por departamento del generador
        if (departamento) {
            whereManifiesto.generador = {
                ...whereManifiesto.generador,
                domicilioLegalDepartamento: String(departamento)
            };
        }

        // Filtrar por rubro del generador
        if (rubro) {
            whereManifiesto.generador = {
                ...whereManifiesto.generador,
                rubro: String(rubro)
            };
        }

        // Filtro de fechas
        if (fechaInicio || fechaFin) {
            whereManifiesto.createdAt = {};
            if (fechaInicio) whereManifiesto.createdAt.gte = new Date(fechaInicio as string);
            if (fechaFin) whereManifiesto.createdAt.lte = new Date(fechaFin as string);
        }

        // Obtener manifiestos con residuos agrupados por generador
        const manifiestos = await prisma.manifiesto.findMany({
            where: whereManifiesto,
            include: {
                generador: {
                    select: {
                        id: true,
                        razonSocial: true,
                        cuit: true,
                        domicilioLegalDepartamento: true,
                        rubro: true,
                        activo: true
                    }
                },
                residuos: {
                    select: { cantidad: true, tipoResiduoId: true }
                }
            }
        });

        // Agrupar por generador y sumar volúmenes
        const volumenesPorGenerador = new Map<string, {
            generador: any;
            volumenTotal: number;
            manifiestos: number;
            tiposResiduo: Set<string>;
        }>();

        manifiestos.forEach(m => {
            const genId = m.generadorId;
            const volumen = m.residuos.reduce((sum, r) => sum + (r.cantidad || 0), 0);
            const tiposEnManifiesto = m.residuos.map(r => r.tipoResiduoId);

            if (volumenesPorGenerador.has(genId)) {
                const existing = volumenesPorGenerador.get(genId)!;
                existing.volumenTotal += volumen;
                existing.manifiestos += 1;
                tiposEnManifiesto.forEach(t => existing.tiposResiduo.add(t));
            } else {
                volumenesPorGenerador.set(genId, {
                    generador: m.generador,
                    volumenTotal: volumen,
                    manifiestos: 1,
                    tiposResiduo: new Set(tiposEnManifiesto)
                });
            }
        });

        // Convertir a array y ordenar
        const ranking = Array.from(volumenesPorGenerador.values())
            .sort((a, b) => b.volumenTotal - a.volumenTotal)
            .slice(0, parseInt(limit as string))
            .map((item, index) => ({
                ranking: index + 1,
                id: item.generador.id,
                razonSocial: item.generador.razonSocial,
                cuit: item.generador.cuit,
                departamento: item.generador.domicilioLegalDepartamento || 'Sin datos',
                rubro: item.generador.rubro || 'Sin rubro',
                activo: item.generador.activo,
                volumenKg: item.volumenTotal,
                manifiestos: item.manifiestos,
                tiposResiduoUnicos: item.tiposResiduo.size
            }));

        // Calcular totales
        const totalVolumen = Array.from(volumenesPorGenerador.values())
            .reduce((sum, g) => sum + g.volumenTotal, 0);

        res.json({
            success: true,
            data: {
                topGeneradores: ranking,
                resumen: {
                    totalVolumen,
                    totalGeneradoresConMovimiento: volumenesPorGenerador.size,
                    promedioVolumenPorGenerador: volumenesPorGenerador.size > 0
                        ? Math.round(totalVolumen / volumenesPorGenerador.size)
                        : 0
                },
                periodo: {
                    desde: fechaInicio || null,
                    hasta: fechaFin || null
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reporte de tipos de residuos más frecuentes
export const getReporteTiposResiduos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { fechaInicio, fechaFin, limit = '15' } = req.query;

        const whereManifiesto: any = {};

        if (fechaInicio || fechaFin) {
            whereManifiesto.fechaCreacion = {};
            if (fechaInicio) whereManifiesto.fechaCreacion.gte = new Date(fechaInicio as string);
            if (fechaFin) whereManifiesto.fechaCreacion.lte = new Date(fechaFin as string);
        }

        // Agrupar residuos por tipo
        const residuosPorTipo = await prisma.manifiestoResiduo.groupBy({
            by: ['tipoResiduoId'],
            _sum: { cantidad: true },
            _count: { id: true },
            where: {
                manifiesto: whereManifiesto
            },
            orderBy: {
                _sum: { cantidad: 'desc' }
            },
            take: parseInt(limit as string)
        });

        // Obtener info de tipos de residuo
        const tiposIds = residuosPorTipo.map(r => r.tipoResiduoId);
        const tiposResiduo = await prisma.tipoResiduo.findMany({
            where: { id: { in: tiposIds } },
            select: {
                id: true,
                codigo: true,
                nombre: true,
                peligrosidad: true,
                categoria: true
            }
        });

        const tiposMap = new Map(tiposResiduo.map(t => [t.id, t]));

        const resultado = residuosPorTipo.map((r, index) => {
            const tipo = tiposMap.get(r.tipoResiduoId);
            return {
                ranking: index + 1,
                tipoResiduoId: r.tipoResiduoId,
                codigo: tipo?.codigo || 'N/A',
                nombre: tipo?.nombre || 'Desconocido',
                peligrosidad: tipo?.peligrosidad || 'N/A',
                categoria: tipo?.categoria || 'N/A',
                volumenTotal: r._sum.cantidad || 0,
                cantidadManifiestos: r._count.id
            };
        });

        res.json({
            success: true,
            data: {
                tiposResiduos: resultado,
                periodo: {
                    desde: fechaInicio || null,
                    hasta: fechaFin || null
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FILTROS DISPONIBLES PARA REPORTES
// ============================================================

// Obtener filtros disponibles para reportes de generadores
export const getReporteFiltrosDisponibles = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Obtener rubros únicos de la base de datos
        const rubrosRaw = await prisma.generador.findMany({
            select: { rubro: true },
            distinct: ['rubro'],
            where: { rubro: { not: null } }
        });

        // Normalizar rubros y eliminar duplicados
        const rubrosNormalizados = [...new Set(
            rubrosRaw
                .map(r => normalizeRubro(r.rubro))
                .filter(r => r && r !== 'SIN ESPECIFICAR')
        )].sort();

        // Obtener departamentos únicos de la base de datos
        const deptosRaw = await prisma.generador.findMany({
            select: { domicilioLegalDepartamento: true },
            distinct: ['domicilioLegalDepartamento'],
            where: { domicilioLegalDepartamento: { not: null } }
        });

        // Normalizar departamentos y eliminar duplicados
        const deptosNormalizados = [...new Set(
            deptosRaw
                .map(d => normalizarDepartamento(d.domicilioLegalDepartamento))
                .filter(Boolean)
        )].sort() as string[];

        // Separar departamentos de Mendoza de otros
        const deptosMendoza = deptosNormalizados.filter(d => DEPARTAMENTOS_MENDOZA.includes(d));
        const deptosOtros = deptosNormalizados.filter(d => !DEPARTAMENTOS_MENDOZA.includes(d));

        // Obtener categorías únicas
        const categoriasRaw = await prisma.generador.findMany({
            select: { categoria: true },
            distinct: ['categoria'],
            where: { categoria: { not: '' } }
        });

        const categorias = [...new Set(
            categoriasRaw.map(c => c.categoria).filter(Boolean)
        )].sort() as string[];

        res.json({
            success: true,
            data: {
                departamentos: {
                    mendoza: deptosMendoza,
                    otros: deptosOtros,
                    todos: [...deptosMendoza, ...deptosOtros]
                },
                rubros: rubrosNormalizados,
                rubrosCanonicos: RUBROS_CANONICOS,
                categorias,
                clasificaciones: ['MINIMA', 'INDIVIDUAL']
            }
        });
    } catch (error) {
        next(error);
    }
};

// Reporte de generadores con filtros avanzados
export const getReporteGeneradoresFiltrado = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            departamento,
            rubro,
            categoria,
            activo,
            fechaInicio,
            fechaFin,
            page = '1',
            limit = '50'
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};

        // Filtro por departamento (normalizado)
        if (departamento) {
            const deptoNorm = normalizarDepartamento(departamento as string);
            where.domicilioLegalDepartamento = deptoNorm;
        }

        // Filtro por rubro
        if (rubro) {
            where.rubro = rubro;
        }

        // Filtro por categoría
        if (categoria) {
            where.categoria = categoria;
        }

        // Filtro por estado activo/inactivo
        if (activo !== undefined && activo !== '') {
            where.activo = activo === 'true';
        }

        // NOTA: Las fechas se usan solo para calcular volumen/manifiestos en el período,
        // pero NO filtran la lista de generadores (para mostrar todos los del departamento/rubro)

        const [generadores, total] = await Promise.all([
            prisma.generador.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { razonSocial: 'asc' },
                include: {
                    _count: {
                        select: { manifiestos: true }
                    }
                }
            }),
            prisma.generador.count({ where })
        ]);

        // Construir filtro de manifiestos para el período (si hay fechas)
        const buildManifiestoWhere = (generadorId: string) => {
            const mWhere: any = { generadorId };
            if (fechaInicio || fechaFin) {
                mWhere.createdAt = {};
                if (fechaInicio) mWhere.createdAt.gte = new Date(fechaInicio as string);
                if (fechaFin) {
                    const fechaFinDate = new Date(fechaFin as string);
                    fechaFinDate.setHours(23, 59, 59, 999);
                    mWhere.createdAt.lte = fechaFinDate;
                }
            }
            return mWhere;
        };

        // Calcular volumen total por generador (en el período si hay fechas)
        const generadoresConVolumen = await Promise.all(
            generadores.map(async (gen) => {
                const manifiestoWhere = buildManifiestoWhere(gen.id);

                const [volumen, countManifiestos] = await Promise.all([
                    prisma.manifiestoResiduo.aggregate({
                        _sum: { cantidad: true },
                        where: { manifiesto: manifiestoWhere }
                    }),
                    prisma.manifiesto.count({ where: manifiestoWhere })
                ]);

                return {
                    id: gen.id,
                    razonSocial: gen.razonSocial,
                    cuit: gen.cuit,
                    departamento: gen.domicilioLegalDepartamento,
                    rubro: gen.rubro,
                    categoria: gen.categoria,
                    activo: gen.activo,
                    manifiestos: countManifiestos,
                    volumenKg: volumen._sum.cantidad || 0,
                    latitud: gen.latitud,
                    longitud: gen.longitud
                };
            })
        );

        res.json({
            success: true,
            data: {
                generadores: generadoresConVolumen,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                },
                filtrosAplicados: {
                    departamento: departamento || null,
                    rubro: rubro || null,
                    categoria: categoria || null,
                    activo: activo !== undefined ? activo === 'true' : null
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

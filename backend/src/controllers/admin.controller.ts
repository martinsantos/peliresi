/**
 * Admin Controller - Gestión de Usuarios y Actividad del Sistema
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

interface AuthRequest extends Request {
    user?: { id: string; rol: string };
}

/**
 * GET /admin/usuarios - Listar todos los usuarios con estadísticas
 */
export const getAllUsuarios = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 20, rol, activo, busqueda } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (rol && rol !== 'TODOS') where.rol = rol;
        if (activo !== undefined && activo !== '') where.activo = activo === 'true';
        if (busqueda) {
            where.OR = [
                { nombre: { contains: String(busqueda), mode: 'insensitive' } },
                { apellido: { contains: String(busqueda), mode: 'insensitive' } },
                { email: { contains: String(busqueda), mode: 'insensitive' } },
                { empresa: { contains: String(busqueda), mode: 'insensitive' } }
            ];
        }

        const [usuarios, total] = await Promise.all([
            prisma.usuario.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    rol: true,
                    nombre: true,
                    apellido: true,
                    empresa: true,
                    telefono: true,
                    activo: true,
                    createdAt: true,
                    updatedAt: true,
                    generador: { select: { id: true, razonSocial: true } },
                    transportista: { select: { id: true, razonSocial: true } },
                    operador: { select: { id: true, razonSocial: true } }
                }
            }),
            prisma.usuario.count({ where })
        ]);

        // OPTIMIZADO: Obtener estadísticas en una sola query con groupBy múltiple
        const [statsByRole, statsByActivo] = await Promise.all([
            prisma.usuario.groupBy({
                by: ['rol'],
                _count: { id: true },
                where: { activo: true }
            }),
            prisma.usuario.groupBy({
                by: ['activo'],
                _count: { id: true }
            })
        ]);

        // Calcular activos/inactivos del groupBy (evita 2 queries adicionales)
        const activosCount = statsByActivo.find(s => s.activo === true)?._count.id || 0;
        const inactivosCount = statsByActivo.find(s => s.activo === false)?._count.id || 0;

        const stats = {
            total,
            activos: activosCount,
            inactivos: inactivosCount,
            porRol: statsByRole.reduce((acc, item) => {
                acc[item.rol] = item._count.id;
                return acc;
            }, {} as Record<string, number>)
        };

        res.json({
            success: true,
            data: {
                usuarios,
                stats,
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

/**
 * GET /admin/usuarios/pendientes - Listar usuarios pendientes de aprobación
 */
export const getUsuariosPendientes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const usuarios = await prisma.usuario.findMany({
            where: { activo: false },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                rol: true,
                nombre: true,
                apellido: true,
                empresa: true,
                telefono: true,
                createdAt: true
            }
        });

        res.json({
            success: true,
            data: { usuarios, total: usuarios.length }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/usuarios/:id - Detalle de un usuario con actividad
 */
export const getUsuarioById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const usuario = await prisma.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                rol: true,
                nombre: true,
                apellido: true,
                empresa: true,
                telefono: true,
                activo: true,
                createdAt: true,
                updatedAt: true,
                generador: {
                    select: {
                        id: true,
                        razonSocial: true,
                        cuit: true,
                        numeroInscripcion: true,
                        _count: { select: { manifiestos: true } }
                    }
                },
                transportista: {
                    select: {
                        id: true,
                        razonSocial: true,
                        cuit: true,
                        numeroHabilitacion: true,
                        _count: { select: { manifiestos: true } }
                    }
                },
                operador: {
                    select: {
                        id: true,
                        razonSocial: true,
                        cuit: true,
                        numeroHabilitacion: true,
                        _count: { select: { manifiestos: true } }
                    }
                }
            }
        });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        // Obtener actividad reciente del usuario
        const actividadReciente = await prisma.auditoria.findMany({
            where: { usuarioId: id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                accion: true,
                modulo: true,
                createdAt: true
            }
        });

        res.json({
            success: true,
            data: { usuario, actividadReciente }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /admin/usuarios/:id - Actualizar usuario
 */
export const updateUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { rol, activo, nombre, apellido, empresa, telefono } = req.body;

        const usuario = await prisma.usuario.update({
            where: { id },
            data: {
                ...(rol && { rol }),
                ...(activo !== undefined && { activo }),
                ...(nombre && { nombre }),
                ...(apellido && { apellido }),
                ...(empresa && { empresa }),
                ...(telefono && { telefono })
            },
            select: {
                id: true,
                email: true,
                rol: true,
                nombre: true,
                apellido: true,
                empresa: true,
                telefono: true,
                activo: true,
                updatedAt: true
            }
        });

        // Registrar en auditoría
        await prisma.auditoria.create({
            data: {
                usuarioId: req.user!.id,
                accion: 'UPDATE_USER',
                modulo: 'ADMIN',
                ip: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                datosDespues: JSON.stringify({ usuarioModificado: id, cambios: req.body })
            }
        });

        res.json({
            success: true,
            data: { usuario }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /admin/usuarios/:id/aprobar - Aprobar usuario pendiente
 */
export const aprobarUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const usuario = await prisma.usuario.update({
            where: { id },
            data: { activo: true },
            select: {
                id: true,
                email: true,
                rol: true,
                nombre: true,
                apellido: true,
                activo: true
            }
        });

        // Registrar en auditoría
        await prisma.auditoria.create({
            data: {
                usuarioId: req.user!.id,
                accion: 'APPROVE_USER',
                modulo: 'ADMIN',
                ip: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                datosDespues: JSON.stringify({ usuarioAprobado: id, email: usuario.email })
            }
        });

        res.json({
            success: true,
            message: `Usuario ${usuario.email} aprobado correctamente`,
            data: { usuario }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /admin/usuarios/:id/rechazar - Rechazar usuario pendiente
 */
export const rechazarUsuario = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        // Obtener datos antes de eliminar
        const usuario = await prisma.usuario.findUnique({
            where: { id },
            select: { email: true, nombre: true }
        });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        // Eliminar usuario rechazado
        await prisma.usuario.delete({ where: { id } });

        // Registrar en auditoría
        await prisma.auditoria.create({
            data: {
                usuarioId: req.user!.id,
                accion: 'REJECT_USER',
                modulo: 'ADMIN',
                ip: req.ip || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
                datosDespues: JSON.stringify({ usuarioRechazado: id, email: usuario.email, motivo })
            }
        });

        res.json({
            success: true,
            message: `Usuario ${usuario.email} rechazado y eliminado`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/actividad - Timeline de actividad global del sistema
 */
export const getActividadGlobal = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 50, tipo, desde, hasta } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Filtros de fecha
        const dateFilter: any = {};
        if (desde) dateFilter.gte = new Date(String(desde));
        if (hasta) dateFilter.lte = new Date(String(hasta));

        // Obtener eventos de manifiestos
        const eventosManifiestos = await prisma.eventoManifiesto.findMany({
            where: {
                ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
                ...(tipo && tipo !== 'TODOS' && { tipo: String(tipo) })
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip,
            include: {
                manifiesto: { select: { numero: true, estado: true } },
                usuario: { select: { nombre: true, apellido: true, rol: true } }
            }
        });

        // Obtener auditoría reciente
        const auditoria = await prisma.auditoria.findMany({
            where: {
                ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                usuario: { select: { nombre: true, apellido: true, rol: true } }
            }
        });

        // Combinar y ordenar por fecha
        const actividades = [
            ...eventosManifiestos.map(e => ({
                id: e.id,
                tipo: 'MANIFIESTO',
                accion: e.tipo,
                descripcion: e.descripcion,
                fecha: e.createdAt,
                usuario: e.usuario,
                manifiesto: e.manifiesto,
                metadata: { ubicacion: e.ubicacion }
            })),
            ...auditoria.map(a => ({
                id: a.id,
                tipo: 'SISTEMA',
                accion: a.accion,
                descripcion: `${a.modulo}: ${a.accion}`,
                fecha: a.createdAt,
                usuario: a.usuario,
                manifiesto: null,
                metadata: { ip: a.ip }
            }))
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
         .slice(0, Number(limit));

        // Estadísticas de actividad
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const stats = {
            eventosHoy: await prisma.eventoManifiesto.count({
                where: { createdAt: { gte: hoy } }
            }),
            manifestosActivos: await prisma.manifiesto.count({
                where: { estado: { in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO'] } }
            }),
            usuariosActivos: await prisma.usuario.count({
                where: { activo: true }
            })
        };

        res.json({
            success: true,
            data: {
                actividades,
                stats,
                pagination: {
                    page: Number(page),
                    limit: Number(limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/estadisticas - Estadísticas generales del sistema
 */
export const getEstadisticasAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const [
            totalUsuarios,
            usuariosActivos,
            usuariosPendientes,
            totalManifiestos,
            manifestosPorEstado,
            usuariosPorRol
        ] = await Promise.all([
            prisma.usuario.count(),
            prisma.usuario.count({ where: { activo: true } }),
            prisma.usuario.count({ where: { activo: false } }),
            prisma.manifiesto.count(),
            prisma.manifiesto.groupBy({
                by: ['estado'],
                _count: { id: true }
            }),
            prisma.usuario.groupBy({
                by: ['rol'],
                _count: { id: true },
                where: { activo: true }
            })
        ]);

        res.json({
            success: true,
            data: {
                usuarios: {
                    total: totalUsuarios,
                    activos: usuariosActivos,
                    pendientes: usuariosPendientes,
                    porRol: usuariosPorRol.reduce((acc, item) => {
                        acc[item.rol] = item._count.id;
                        return acc;
                    }, {} as Record<string, number>)
                },
                manifiestos: {
                    total: totalManifiestos,
                    porEstado: manifestosPorEstado.reduce((acc, item) => {
                        acc[item.estado] = item._count.id;
                        return acc;
                    }, {} as Record<string, number>)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/estadisticas-departamento - Estadísticas por departamento de Mendoza
 * Retorna stats reales agrupadas por ubicación del generador
 */
export const getEstadisticasDepartamento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Departamentos de Mendoza con sus coordenadas aproximadas para clasificación
        const DEPARTAMENTOS = [
            { nombre: 'Capital', codigo: 'CD', latMin: -32.93, latMax: -32.87, lngMin: -68.87, lngMax: -68.80 },
            { nombre: 'Godoy Cruz', codigo: 'GC', latMin: -32.96, latMax: -32.90, lngMin: -68.90, lngMax: -68.82 },
            { nombre: 'Guaymallén', codigo: 'GY', latMin: -32.92, latMax: -32.85, lngMin: -68.83, lngMax: -68.75 },
            { nombre: 'Las Heras', codigo: 'LH', latMin: -32.88, latMax: -32.80, lngMin: -68.90, lngMax: -68.80 },
            { nombre: 'Maipú', codigo: 'MP', latMin: -33.02, latMax: -32.92, lngMin: -68.82, lngMax: -68.72 },
            { nombre: 'Luján de Cuyo', codigo: 'LJ', latMin: -33.10, latMax: -32.98, lngMin: -68.90, lngMax: -68.78 },
            { nombre: 'San Martín', codigo: 'SM', latMin: -33.15, latMax: -33.05, lngMin: -68.55, lngMax: -68.45 },
            { nombre: 'San Rafael', codigo: 'SR', latMin: -34.70, latMax: -34.55, lngMin: -68.40, lngMax: -68.25 },
            { nombre: 'Rivadavia', codigo: 'RV', latMin: -33.25, latMax: -33.15, lngMin: -68.55, lngMax: -68.45 },
            { nombre: 'Tunuyán', codigo: 'TN', latMin: -33.60, latMax: -33.50, lngMin: -69.10, lngMax: -69.00 },
            { nombre: 'Tupungato', codigo: 'TP', latMin: -33.40, latMax: -33.30, lngMin: -69.20, lngMax: -69.10 },
            { nombre: 'General Alvear', codigo: 'GA', latMin: -35.00, latMax: -34.90, lngMin: -67.75, lngMax: -67.65 },
            { nombre: 'San Carlos', codigo: 'SC', latMin: -33.80, latMax: -33.70, lngMin: -69.10, lngMax: -69.00 },
            { nombre: 'Lavalle', codigo: 'LV', latMin: -32.75, latMax: -32.65, lngMin: -68.60, lngMax: -68.50 },
            { nombre: 'Malargüe', codigo: 'MG', latMin: -35.55, latMax: -35.45, lngMin: -69.65, lngMax: -69.55 },
            { nombre: 'Santa Rosa', codigo: 'SRo', latMin: -33.30, latMax: -33.20, lngMin: -68.20, lngMax: -68.10 },
            { nombre: 'La Paz', codigo: 'LP', latMin: -33.50, latMax: -33.40, lngMin: -67.65, lngMax: -67.55 },
            { nombre: 'Junín', codigo: 'JN', latMin: -33.20, latMax: -33.10, lngMin: -68.55, lngMax: -68.45 },
        ];

        // Obtener manifiestos con info de generador
        const manifiestos = await prisma.manifiesto.findMany({
            select: {
                id: true,
                estado: true,
                createdAt: true,
                generador: {
                    select: {
                        latitud: true,
                        longitud: true,
                        domicilio: true
                    }
                },
                residuos: {
                    select: {
                        cantidad: true,
                        unidad: true
                    }
                }
            }
        });

        // Clasificar manifiestos por departamento basado en coordenadas o domicilio
        const statsPorDepartamento = DEPARTAMENTOS.map(dept => {
            const manifestosDept = manifiestos.filter(m => {
                // Primero intentar por coordenadas
                if (m.generador?.latitud && m.generador?.longitud) {
                    const lat = m.generador.latitud;
                    const lng = m.generador.longitud;
                    return lat >= dept.latMin && lat <= dept.latMax &&
                           lng >= dept.lngMin && lng <= dept.lngMax;
                }
                // Fallback: buscar nombre del departamento en domicilio
                if (m.generador?.domicilio) {
                    return m.generador.domicilio.toLowerCase().includes(dept.nombre.toLowerCase());
                }
                return false;
            });

            // Calcular estadísticas
            const total = manifestosDept.length;
            const enTransito = manifestosDept.filter(m => m.estado === 'EN_TRANSITO').length;
            const entregados = manifestosDept.filter(m => m.estado === 'ENTREGADO').length;
            const tratados = manifestosDept.filter(m => m.estado === 'TRATADO').length;

            // Calcular residuos tratados (en kg)
            const residuosTratados = manifestosDept
                .filter(m => m.estado === 'TRATADO')
                .reduce((sum, m) => {
                    return sum + m.residuos.reduce((rSum, r) => {
                        // Convertir a kg si está en otra unidad
                        let cantidad = r.cantidad || 0;
                        if (r.unidad === 'ton') cantidad *= 1000;
                        if (r.unidad === 'g') cantidad /= 1000;
                        return rSum + cantidad;
                    }, 0);
                }, 0);

            // Obtener última actividad
            const ultimaActividad = manifestosDept.length > 0
                ? new Date(Math.max(...manifestosDept.map(m => m.createdAt.getTime())))
                : null;

            return {
                nombre: dept.nombre,
                codigo: dept.codigo,
                manifiestos: { total, enTransito, entregados, tratados },
                residuosTratados: Math.round(residuosTratados * 10) / 10,
                enProceso: enTransito,
                ultimaActividad
            };
        });

        // Ordenar por residuos tratados (descendente)
        statsPorDepartamento.sort((a, b) => b.residuosTratados - a.residuosTratados);

        // Calcular totales
        const totales = statsPorDepartamento.reduce((acc, d) => ({
            manifiestos: acc.manifiestos + d.manifiestos.total,
            residuosTratados: acc.residuosTratados + d.residuosTratados,
            enProceso: acc.enProceso + d.enProceso
        }), { manifiestos: 0, residuosTratados: 0, enProceso: 0 });

        res.json({
            success: true,
            data: {
                departamentos: statsPorDepartamento,
                totales
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/estadisticas-historicas - Estadísticas históricas con filtros de tiempo
 * Query params: desde, hasta, agrupacion (dia|semana|mes)
 */
export const getEstadisticasHistoricas = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { desde, hasta, agrupacion = 'dia' } = req.query;

        // Fechas por defecto: últimos 30 días
        const fechaHasta = hasta ? new Date(hasta as string) : new Date();
        const fechaDesde = desde ? new Date(desde as string) : new Date(fechaHasta.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Obtener manifiestos en el rango de fechas
        const manifiestos = await prisma.manifiesto.findMany({
            where: {
                createdAt: {
                    gte: fechaDesde,
                    lte: fechaHasta
                }
            },
            select: {
                id: true,
                estado: true,
                createdAt: true,
                residuos: {
                    select: {
                        cantidad: true,
                        unidad: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Obtener alertas en el rango
        const alertas = await prisma.alertaGenerada.count({
            where: {
                createdAt: {
                    gte: fechaDesde,
                    lte: fechaHasta
                }
            }
        });

        // Agrupar por fecha según el tipo de agrupación
        const agruparFecha = (fecha: Date): string => {
            if (agrupacion === 'mes') {
                return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            } else if (agrupacion === 'semana') {
                // Obtener el lunes de la semana
                const d = new Date(fecha);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
                return d.toISOString().split('T')[0];
            }
            return fecha.toISOString().split('T')[0]; // día
        };

        // Agrupar datos
        const datosAgrupados: Record<string, { manifiestos: number; residuos: number; alertas: number }> = {};

        manifiestos.forEach(m => {
            const key = agruparFecha(m.createdAt);
            if (!datosAgrupados[key]) {
                datosAgrupados[key] = { manifiestos: 0, residuos: 0, alertas: 0 };
            }
            datosAgrupados[key].manifiestos++;

            // Sumar residuos
            m.residuos.forEach(r => {
                let cantidad = r.cantidad || 0;
                if (r.unidad === 'ton') cantidad *= 1000;
                if (r.unidad === 'g') cantidad /= 1000;
                datosAgrupados[key].residuos += cantidad;
            });
        });

        // Convertir a array ordenado
        const datos = Object.entries(datosAgrupados)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([fecha, stats]) => ({
                fecha,
                manifiestos: stats.manifiestos,
                residuos: Math.round(stats.residuos * 10) / 10,
                alertas: stats.alertas
            }));

        // Calcular totales
        const totalResiduos = manifiestos.reduce((sum, m) => {
            return sum + m.residuos.reduce((rSum, r) => {
                let cantidad = r.cantidad || 0;
                if (r.unidad === 'ton') cantidad *= 1000;
                if (r.unidad === 'g') cantidad /= 1000;
                return rSum + cantidad;
            }, 0);
        }, 0);

        // Calcular tendencia (comparar con período anterior)
        const diasPeriodo = Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (24 * 60 * 60 * 1000));
        const fechaAnteriorDesde = new Date(fechaDesde.getTime() - diasPeriodo * 24 * 60 * 60 * 1000);

        const manifestosAnterior = await prisma.manifiesto.count({
            where: {
                createdAt: {
                    gte: fechaAnteriorDesde,
                    lt: fechaDesde
                }
            }
        });

        const tendencia = manifestosAnterior > 0
            ? Math.round(((manifiestos.length - manifestosAnterior) / manifestosAnterior) * 100)
            : manifiestos.length > 0 ? 100 : 0;

        res.json({
            success: true,
            data: {
                periodo: {
                    desde: fechaDesde.toISOString().split('T')[0],
                    hasta: fechaHasta.toISOString().split('T')[0]
                },
                agrupacion,
                datos,
                totales: {
                    manifiestos: manifiestos.length,
                    residuos: Math.round(totalResiduos * 10) / 10,
                    alertas
                },
                tendencia: {
                    porcentaje: tendencia,
                    direccion: tendencia >= 0 ? 'up' : 'down'
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

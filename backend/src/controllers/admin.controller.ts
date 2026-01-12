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

        // Obtener estadísticas por rol
        const statsByRole = await prisma.usuario.groupBy({
            by: ['rol'],
            _count: { id: true },
            where: { activo: true }
        });

        const stats = {
            total,
            activos: await prisma.usuario.count({ where: { activo: true } }),
            inactivos: await prisma.usuario.count({ where: { activo: false } }),
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

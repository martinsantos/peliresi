/**
 * Viajes Controller
 * Maneja el registro y sincronización de viajes desde la app móvil
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Iniciar un nuevo viaje
 * POST /api/viajes
 */
export const iniciarViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId, dispositivoId, appVersion } = req.body;
        const userId = req.user.id;

        // Verificar que el manifiesto existe y está en estado correcto
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId },
            include: { transportista: true }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        if (manifiesto.estado !== 'APROBADO' && manifiesto.estado !== 'EN_TRANSITO') {
            throw new AppError(`No se puede iniciar viaje. Estado actual: ${manifiesto.estado}`, 400);
        }

        // Verificar que no hay otro viaje activo para este manifiesto
        const viajeExistente = await prisma.viaje.findFirst({
            where: {
                manifiestoId,
                estado: 'EN_CURSO'
            }
        });

        if (viajeExistente) {
            throw new AppError('Ya existe un viaje activo para este manifiesto', 400);
        }

        // Crear el viaje
        const viaje = await prisma.viaje.create({
            data: {
                manifiestoId,
                transportistaId: manifiesto.transportistaId,
                usuarioId: userId,
                inicio: new Date(),
                estado: 'EN_CURSO',
                dispositivoId,
                appVersion,
                ruta: [],
                eventos: [{
                    tipo: 'INICIO',
                    timestamp: new Date().toISOString(),
                    descripcion: 'Viaje iniciado'
                }]
            }
        });

        // Actualizar estado del manifiesto si está en APROBADO
        if (manifiesto.estado === 'APROBADO') {
            await prisma.manifiesto.update({
                where: { id: manifiestoId },
                data: {
                    estado: 'EN_TRANSITO',
                    fechaRetiro: new Date()
                }
            });
        }

        res.status(201).json({
            success: true,
            data: { viaje }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Finalizar un viaje
 * PUT /api/viajes/:id/finalizar
 */
export const finalizarViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { ruta, eventos, duracion, distancia } = req.body;
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({
            where: { id }
        });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para finalizar este viaje', 403);
        }

        if (viaje.estado !== 'EN_CURSO') {
            throw new AppError('El viaje ya fue finalizado', 400);
        }

        // Agregar evento de fin
        const eventosActualizados = Array.isArray(eventos) ? eventos : [];
        eventosActualizados.push({
            tipo: 'FIN',
            timestamp: new Date().toISOString(),
            descripcion: 'Viaje finalizado'
        });

        // Actualizar el viaje
        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: {
                fin: new Date(),
                estado: 'COMPLETADO',
                ruta: ruta || viaje.ruta,
                eventos: eventosActualizados,
                duracion: duracion || null,
                distancia: distancia || null
            }
        });

        res.json({
            success: true,
            data: { viaje: viajeActualizado }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener mis viajes (historial)
 * GET /api/viajes/mis-viajes
 */
export const getMisViajes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.id;
        const { estado, limit = 20, offset = 0 } = req.query;

        const where: any = { usuarioId: userId };
        if (estado) where.estado = estado;

        const [viajes, total] = await Promise.all([
            prisma.viaje.findMany({
                where,
                include: {
                    manifiesto: {
                        select: {
                            numero: true,
                            estado: true,
                            generador: { select: { razonSocial: true } },
                            operador: { select: { razonSocial: true } }
                        }
                    }
                },
                orderBy: { inicio: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            }),
            prisma.viaje.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                viajes,
                total,
                pagina: Math.floor(Number(offset) / Number(limit)) + 1,
                totalPaginas: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener un viaje por ID
 * GET /api/viajes/:id
 */
export const getViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const viaje = await prisma.viaje.findUnique({
            where: { id },
            include: {
                manifiesto: {
                    include: {
                        generador: { select: { razonSocial: true, domicilio: true } },
                        operador: { select: { razonSocial: true, domicilio: true } },
                        transportista: { select: { razonSocial: true } },
                        residuos: {
                            include: { tipoResiduo: true }
                        }
                    }
                }
            }
        });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        res.json({
            success: true,
            data: { viaje }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Agregar evento a un viaje
 * POST /api/viajes/:id/evento
 */
export const agregarEvento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { tipo, descripcion, lat, lng } = req.body;
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({ where: { id } });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para modificar este viaje', 403);
        }

        const eventosActuales = (viaje.eventos as any[]) || [];
        eventosActuales.push({
            tipo,
            descripcion,
            timestamp: new Date().toISOString(),
            lat,
            lng
        });

        // Si es un incidente, cambiar estado del viaje
        let nuevoEstado = viaje.estado;
        if (tipo === 'INCIDENTE') {
            nuevoEstado = 'INCIDENTE';
        }

        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: {
                eventos: eventosActuales,
                estado: nuevoEstado
            }
        });

        res.json({
            success: true,
            data: { viaje: viajeActualizado }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar ruta de un viaje (agregar puntos GPS)
 * POST /api/viajes/:id/ruta
 */
export const actualizarRuta = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { puntos } = req.body; // Array de {lat, lng, timestamp, velocidad}
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({ where: { id } });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para modificar este viaje', 403);
        }

        const rutaActual = (viaje.ruta as any[]) || [];
        const nuevaRuta = [...rutaActual, ...puntos];

        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: { ruta: nuevaRuta }
        });

        // También guardar en TrackingGPS para compatibilidad
        if (puntos && puntos.length > 0) {
            await prisma.trackingGPS.createMany({
                data: puntos.map((p: any) => ({
                    manifiestoId: viaje.manifiestoId,
                    latitud: p.lat,
                    longitud: p.lng,
                    velocidad: p.velocidad || null,
                    timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
                }))
            });
        }

        res.json({
            success: true,
            data: {
                viaje: viajeActualizado,
                puntosAgregados: puntos.length
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sincronizar viaje completo desde offline
 * POST /api/viajes/sync
 */
export const syncViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const {
            manifiestoId,
            inicio,
            fin,
            duracion,
            distancia,
            ruta,
            eventos,
            dispositivoId,
            appVersion
        } = req.body;
        const userId = req.user.id;

        // Verificar que el manifiesto existe
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        // Buscar si ya existe un viaje para este manifiesto
        const viajeExistente = await prisma.viaje.findFirst({
            where: { manifiestoId }
        });

        let viaje;

        if (viajeExistente) {
            // Actualizar viaje existente con datos offline
            viaje = await prisma.viaje.update({
                where: { id: viajeExistente.id },
                data: {
                    fin: fin ? new Date(fin) : viajeExistente.fin,
                    duracion: duracion || viajeExistente.duracion,
                    distancia: distancia || viajeExistente.distancia,
                    ruta: ruta || viajeExistente.ruta,
                    eventos: eventos || viajeExistente.eventos,
                    estado: fin ? 'COMPLETADO' : viajeExistente.estado
                }
            });
        } else {
            // Crear nuevo viaje desde datos offline
            viaje = await prisma.viaje.create({
                data: {
                    manifiestoId,
                    transportistaId: manifiesto.transportistaId,
                    usuarioId: userId,
                    inicio: inicio ? new Date(inicio) : new Date(),
                    fin: fin ? new Date(fin) : null,
                    duracion,
                    distancia,
                    ruta: ruta || [],
                    eventos: eventos || [],
                    estado: fin ? 'COMPLETADO' : 'EN_CURSO',
                    dispositivoId,
                    appVersion
                }
            });
        }

        // Sincronizar puntos GPS a TrackingGPS
        if (ruta && Array.isArray(ruta) && ruta.length > 0) {
            const puntosExistentes = await prisma.trackingGPS.count({
                where: { manifiestoId }
            });

            // Solo crear si no hay muchos puntos ya
            if (puntosExistentes < ruta.length) {
                const puntosNuevos = ruta.slice(puntosExistentes);
                if (puntosNuevos.length > 0) {
                    await prisma.trackingGPS.createMany({
                        data: puntosNuevos.map((p: any) => ({
                            manifiestoId,
                            latitud: p.lat,
                            longitud: p.lng,
                            velocidad: p.velocidad || null,
                            timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
                        })),
                        skipDuplicates: true
                    });
                }
            }
        }

        res.json({
            success: true,
            data: { viaje },
            message: viajeExistente ? 'Viaje actualizado' : 'Viaje creado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener viajes por manifiesto
 * GET /api/viajes/manifiesto/:manifiestoId
 */
export const getViajesPorManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;

        const viajes = await prisma.viaje.findMany({
            where: { manifiestoId },
            orderBy: { inicio: 'desc' }
        });

        res.json({
            success: true,
            data: { viajes }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener viaje activo del usuario actual
 * GET /api/viajes/activo
 * Retorna el viaje EN_CURSO del transportista actual, si existe
 */
export const getViajeActivo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.id;

        // Buscar viaje EN_CURSO del usuario
        const viajeActivo = await prisma.viaje.findFirst({
            where: {
                usuarioId: userId,
                estado: 'EN_CURSO'
            },
            include: {
                manifiesto: {
                    select: {
                        id: true,
                        numero: true,
                        estado: true,
                        generador: { select: { razonSocial: true, domicilio: true } },
                        operador: { select: { razonSocial: true, domicilio: true } },
                        transportista: { select: { razonSocial: true } }
                    }
                }
            }
        });

        // Si no hay viaje EN_CURSO, buscar manifiesto EN_TRANSITO asignado
        if (!viajeActivo) {
            const usuario = await prisma.usuario.findUnique({
                where: { id: userId },
                include: { transportista: true }
            });

            if (usuario?.transportista) {
                const manifiestoEnTransito = await prisma.manifiesto.findFirst({
                    where: {
                        transportistaId: usuario.transportista.id,
                        estado: 'EN_TRANSITO'
                    },
                    include: {
                        generador: { select: { razonSocial: true, domicilio: true } },
                        operador: { select: { razonSocial: true, domicilio: true } },
                        transportista: { select: { razonSocial: true } }
                    }
                });

                if (manifiestoEnTransito) {
                    // Crear viaje retroactivo para el manifiesto EN_TRANSITO
                    const viajeCreado = await prisma.viaje.create({
                        data: {
                            manifiestoId: manifiestoEnTransito.id,
                            transportistaId: manifiestoEnTransito.transportistaId,
                            usuarioId: userId,
                            inicio: manifiestoEnTransito.fechaRetiro || new Date(),
                            estado: 'EN_CURSO',
                            ruta: [],
                            eventos: [{
                                tipo: 'INICIO',
                                timestamp: (manifiestoEnTransito.fechaRetiro || new Date()).toISOString(),
                                descripcion: 'Viaje iniciado (sincronizado)'
                            }]
                        },
                        include: {
                            manifiesto: {
                                select: {
                                    id: true,
                                    numero: true,
                                    estado: true,
                                    generador: { select: { razonSocial: true, domicilio: true } },
                                    operador: { select: { razonSocial: true, domicilio: true } },
                                    transportista: { select: { razonSocial: true } }
                                }
                            }
                        }
                    });

                    return res.json({
                        success: true,
                        data: {
                            viajeActivo: viajeCreado,
                            sincronizado: true
                        }
                    });
                }
            }

            return res.json({
                success: true,
                data: { viajeActivo: null }
            });
        }

        res.json({
            success: true,
            data: { viajeActivo }
        });
    } catch (error) {
        next(error);
    }
};

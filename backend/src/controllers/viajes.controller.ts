/**
 * Viajes Controller
 * Maneja el registro y sincronización de viajes desde la app móvil
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { wsService, WS_EVENTS } from '../lib/websocket';
import { notificationService } from '../services/notification.service';

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

// ============================================================
// NUEVOS ENDPOINTS PARA SINCRONIZACIÓN APP ↔ WEB
// ============================================================

/**
 * Helper: Calcular tiempo real del viaje descontando pausas
 */
function calcularTiempoViaje(viaje: { inicio: Date; pausas: number; ultimaPausa: Date | null; estado: string }): number {
    const ahora = new Date();
    const inicio = new Date(viaje.inicio);
    let totalSegundos = Math.floor((ahora.getTime() - inicio.getTime()) / 1000);

    // Descontar pausas acumuladas
    totalSegundos -= viaje.pausas;

    // Si está pausado actualmente, descontar tiempo de pausa actual
    if (viaje.estado === 'PAUSADO' && viaje.ultimaPausa) {
        const pausaActual = Math.floor((ahora.getTime() - new Date(viaje.ultimaPausa).getTime()) / 1000);
        totalSegundos -= pausaActual;
    }

    return Math.max(0, totalSegundos);
}

/**
 * Obtener viaje en curso por manifiesto (para WEB)
 * GET /api/manifiestos/:manifiestoId/viaje-actual
 */
export const getViajeEnCurso = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;

        const viaje = await prisma.viaje.findFirst({
            where: {
                manifiestoId,
                estado: { in: ['EN_CURSO', 'PAUSADO'] }
            },
            include: {
                manifiesto: {
                    select: { numero: true, estado: true }
                }
            }
        });

        if (!viaje) {
            return res.json({ success: true, data: null });
        }

        // Calcular tiempo real del servidor
        const tiempoActual = calcularTiempoViaje(viaje);

        // Obtener última ubicación de la ruta
        const ruta = (viaje.ruta as any[]) || [];
        const ultimaUbicacion = ruta.length > 0 ? ruta[ruta.length - 1] : null;

        res.json({
            success: true,
            data: {
                id: viaje.id,
                manifiestoId: viaje.manifiestoId,
                manifiestoNumero: viaje.manifiesto.numero,
                inicio: viaje.inicio,
                estado: viaje.estado,
                isPaused: viaje.estado === 'PAUSADO',
                elapsedSeconds: tiempoActual,
                pausasTotales: viaje.pausas,
                ruta: ruta,
                eventos: viaje.eventos || [],
                ultimaUbicacion
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Pausar viaje
 * POST /api/viajes/:id/pausar
 */
export const pausarViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({ where: { id } });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        if (viaje.estado !== 'EN_CURSO') {
            throw new AppError('El viaje no está en curso', 400);
        }

        // Verificar permisos (dueño del viaje o admin)
        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para pausar este viaje', 403);
        }

        const ahora = new Date();

        // Agregar evento de pausa
        const eventosActuales = (viaje.eventos as any[]) || [];
        eventosActuales.push({
            tipo: 'PAUSA_INICIO',
            timestamp: ahora.toISOString(),
            descripcion: 'Viaje pausado'
        });

        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: {
                estado: 'PAUSADO',
                ultimaPausa: ahora,
                eventos: eventosActuales
            }
        });

        // Notificar por WebSocket
        wsService.emitToManifiesto(viaje.manifiestoId, WS_EVENTS.VIAJE_PAUSADO, {
            viajeId: id,
            manifiestoId: viaje.manifiestoId,
            timestamp: ahora.toISOString()
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
 * Reanudar viaje
 * POST /api/viajes/:id/reanudar
 */
export const reanudarViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({ where: { id } });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        if (viaje.estado !== 'PAUSADO') {
            throw new AppError('El viaje no está pausado', 400);
        }

        // Verificar permisos
        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para reanudar este viaje', 403);
        }

        const ahora = new Date();

        // Calcular segundos pausados en esta pausa
        let segundosPausados = 0;
        if (viaje.ultimaPausa) {
            segundosPausados = Math.floor((ahora.getTime() - new Date(viaje.ultimaPausa).getTime()) / 1000);
        }

        // Agregar evento de reanudación
        const eventosActuales = (viaje.eventos as any[]) || [];
        eventosActuales.push({
            tipo: 'PAUSA_FIN',
            timestamp: ahora.toISOString(),
            descripcion: 'Viaje reanudado',
            duracion: segundosPausados
        });

        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: {
                estado: 'EN_CURSO',
                pausas: viaje.pausas + segundosPausados,
                ultimaPausa: null,
                eventos: eventosActuales
            }
        });

        // Notificar por WebSocket
        wsService.emitToManifiesto(viaje.manifiestoId, WS_EVENTS.VIAJE_REANUDADO, {
            viajeId: id,
            manifiestoId: viaje.manifiestoId,
            timestamp: ahora.toISOString(),
            pausasTotales: viajeActualizado.pausas
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
 * Registrar incidente en viaje
 * POST /api/viajes/:id/incidente
 */
export const registrarIncidenteViaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { tipo, descripcion, latitud, longitud } = req.body;
        const userId = req.user.id;

        const viaje = await prisma.viaje.findUnique({
            where: { id },
            include: { manifiesto: { select: { numero: true } } }
        });

        if (!viaje) {
            throw new AppError('Viaje no encontrado', 404);
        }

        // Verificar permisos
        if (viaje.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('No tienes permiso para registrar incidentes en este viaje', 403);
        }

        const ahora = new Date();
        const evento = {
            tipo: 'INCIDENTE',
            subtipo: tipo,
            descripcion,
            latitud,
            longitud,
            timestamp: ahora.toISOString()
        };

        const eventosActuales = (viaje.eventos as any[]) || [];
        eventosActuales.push(evento);

        const viajeActualizado = await prisma.viaje.update({
            where: { id },
            data: {
                eventos: eventosActuales,
                estado: 'INCIDENTE'
            }
        });

        // Notificar a admins
        await notificationService.notificarPorRol('ADMIN', {
            tipo: 'ANOMALIA_DETECTADA',
            titulo: '⚠️ Incidente en Viaje',
            mensaje: `Manifiesto ${viaje.manifiesto.numero}: ${tipo} - ${descripcion}`,
            manifiestoId: viaje.manifiestoId,
            prioridad: 'ALTA'
        });

        // Notificar por WebSocket
        wsService.emitToManifiesto(viaje.manifiestoId, WS_EVENTS.VIAJE_INCIDENTE, {
            viajeId: id,
            manifiestoId: viaje.manifiestoId,
            ...evento
        });

        res.json({
            success: true,
            data: { viaje: viajeActualizado, evento }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Subir ubicaciones en batch (para sync offline)
 * POST /api/manifiestos/:manifiestoId/ubicacion-batch
 */
export const subirUbicacionesBatch = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const { ubicaciones } = req.body; // Array de { lat, lng, timestamp, velocidad? }

        if (!Array.isArray(ubicaciones) || ubicaciones.length === 0) {
            throw new AppError('Se requiere array de ubicaciones', 400);
        }

        // Buscar viaje activo
        const viaje = await prisma.viaje.findFirst({
            where: {
                manifiestoId,
                estado: { in: ['EN_CURSO', 'PAUSADO', 'INCIDENTE'] }
            }
        });

        if (!viaje) {
            throw new AppError('No hay viaje activo para este manifiesto', 404);
        }

        // Filtrar ubicaciones duplicadas por timestamp
        const rutaActual = (viaje.ruta as any[]) || [];
        const timestampsExistentes = new Set(rutaActual.map(p => p.timestamp));

        const nuevasUbicaciones = ubicaciones.filter(u => !timestampsExistentes.has(u.timestamp));

        if (nuevasUbicaciones.length === 0) {
            return res.json({
                success: true,
                message: 'Sin nuevas ubicaciones',
                added: 0,
                totalPuntos: rutaActual.length
            });
        }

        // Agregar al viaje ordenado por timestamp
        const rutaActualizada = [...rutaActual, ...nuevasUbicaciones]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        await prisma.viaje.update({
            where: { id: viaje.id },
            data: { ruta: rutaActualizada }
        });

        // También guardar en TrackingGPS para compatibilidad
        await prisma.trackingGPS.createMany({
            data: nuevasUbicaciones.map((p: any) => ({
                manifiestoId,
                latitud: p.lat,
                longitud: p.lng,
                velocidad: p.velocidad || null,
                timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
            })),
            skipDuplicates: true
        });

        // Emitir última ubicación por WebSocket
        const ultima = nuevasUbicaciones[nuevasUbicaciones.length - 1];
        wsService.emitToManifiesto(manifiestoId, WS_EVENTS.GPS_UPDATE, {
            manifiestoId,
            viajeId: viaje.id,
            lat: ultima.lat,
            lng: ultima.lng,
            velocidad: ultima.velocidad,
            timestamp: ultima.timestamp
        });

        res.json({
            success: true,
            added: nuevasUbicaciones.length,
            totalPuntos: rutaActualizada.length
        });
    } catch (error) {
        next(error);
    }
};

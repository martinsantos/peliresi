import { Request, Response, NextFunction } from 'express';
import { TipoNotificacion, PrioridadNotificacion, EventoAlerta, EstadoAlerta, TipoAnomalia, SeveridadAnomalia } from '@prisma/client';
import prisma from '../lib/prisma';
import { emailService } from '../services/email.service';
import { domainEvents } from '../services/domainEvent.service';

// ============ SERVICIO DE NOTIFICACIONES ============

class NotificationService {
    // Helper: get all active admin user IDs (reused across multiple event handlers)
    private async getAdminIds(): Promise<string[]> {
        const admins = await prisma.usuario.findMany({
            where: { rol: 'ADMIN', activo: true },
            select: { id: true }
        });
        return admins.map(a => a.id);
    }

    // Crear notificación para un usuario
    async crearNotificacion(data: {
        usuarioId: string;
        tipo: TipoNotificacion;
        titulo: string;
        mensaje: string;
        datos?: any;
        manifiestoId?: string;
        prioridad?: PrioridadNotificacion;
    }) {
        return prisma.notificacion.create({
            data: {
                usuarioId: data.usuarioId,
                tipo: data.tipo,
                titulo: data.titulo,
                mensaje: data.mensaje,
                datos: data.datos ? JSON.stringify(data.datos) : null,
                manifiestoId: data.manifiestoId,
                prioridad: data.prioridad || 'NORMAL'
            }
        });
    }

    // Notificar a usuarios por rol
    async notificarPorRol(rol: string, data: {
        tipo: TipoNotificacion;
        titulo: string;
        mensaje: string;
        datos?: any;
        manifiestoId?: string;
        prioridad?: PrioridadNotificacion;
    }) {
        const usuarios = await prisma.usuario.findMany({
            where: { rol: rol as any, activo: true },
            select: { id: true }
        });

        const notificaciones = usuarios.map(u => ({
            usuarioId: u.id,
            tipo: data.tipo,
            titulo: data.titulo,
            mensaje: data.mensaje,
            datos: data.datos ? JSON.stringify(data.datos) : null,
            manifiestoId: data.manifiestoId,
            prioridad: data.prioridad || 'NORMAL'
        }));

        return prisma.notificacion.createMany({ data: notificaciones });
    }

    // Notificar cambio de estado de manifiesto
    async notificarCambioEstado(manifiestoId: string, nuevoEstado: string, actorId?: string) {
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId },
            include: {
                generador: { include: { usuario: true } },
                transportista: { include: { usuario: true } },
                operador: { include: { usuario: true } }
            }
        });

        if (!manifiesto) return;

        const mensajes: Record<string, { titulo: string; mensaje: string; tipo: TipoNotificacion }> = {
            'APROBADO': {
                titulo: 'Manifiesto Firmado',
                mensaje: `El manifiesto ${manifiesto.numero} ha sido firmado y está listo para retiro`,
                tipo: 'MANIFIESTO_FIRMADO'
            },
            'EN_TRANSITO': {
                titulo: 'Transporte Iniciado',
                mensaje: `El manifiesto ${manifiesto.numero} está en camino`,
                tipo: 'MANIFIESTO_EN_TRANSITO'
            },
            'ENTREGADO': {
                titulo: 'Entrega Confirmada',
                mensaje: `El manifiesto ${manifiesto.numero} ha sido entregado en destino`,
                tipo: 'MANIFIESTO_ENTREGADO'
            },
            'RECIBIDO': {
                titulo: 'Recepción Confirmada',
                mensaje: `El operador ha confirmado la recepción del manifiesto ${manifiesto.numero}`,
                tipo: 'MANIFIESTO_RECIBIDO'
            },
            'TRATADO': {
                titulo: 'Tratamiento Completado',
                mensaje: `El manifiesto ${manifiesto.numero} ha sido tratado y cerrado`,
                tipo: 'MANIFIESTO_TRATADO'
            },
            'RECHAZADO': {
                titulo: '⚠️ Carga Rechazada',
                mensaje: `La carga del manifiesto ${manifiesto.numero} ha sido rechazada`,
                tipo: 'MANIFIESTO_RECHAZADO'
            },
            'EN_TRATAMIENTO': {
                titulo: 'Tratamiento Iniciado',
                mensaje: `El manifiesto ${manifiesto.numero} ha iniciado el proceso de tratamiento`,
                tipo: 'INFO_GENERAL'
            }
        };

        const info = mensajes[nuevoEstado];
        if (!info) return;

        // Notificar a todos los involucrados excepto al que hizo la acción
        const destinatarios = [
            manifiesto.generador.usuario.id,
            manifiesto.transportista.usuario.id,
            manifiesto.operador.usuario.id
        ].filter(id => id !== actorId);

        // También notificar a admins
        const adminIds = await this.getAdminIds();
        adminIds.forEach(id => {
            if (!destinatarios.includes(id)) destinatarios.push(id);
        });

        await Promise.all(destinatarios.map(usuarioId =>
            this.crearNotificacion({
                usuarioId,
                ...info,
                manifiestoId,
                prioridad: nuevoEstado === 'RECHAZADO' ? 'ALTA' : 'NORMAL'
            })
        ));
    }
    // Disparar alerta para un evento — llamar desde manifiesto.controller.ts con setImmediate()
    // Nunca lanza excepciones — los errores se loguean y se ignoran
    async dispararAlertaEvento(params: {
        evento: string;
        manifiestoId: string;
        realizadoPorId: string;
        datos?: Record<string, any>;
    }): Promise<void> {
        try {
            const { evento, manifiestoId, realizadoPorId, datos } = params;

            if (evento === 'CAMBIO_ESTADO' && datos?.estadoNuevo) {
                await this.notificarCambioEstado(manifiestoId, datos.estadoNuevo, realizadoPorId);
            } else if (evento === 'INCIDENTE') {
                const m = await prisma.manifiesto.findUnique({
                    where: { id: manifiestoId },
                    select: { numero: true, operador: { select: { usuario: { select: { id: true } } } } }
                });
                if (m) {
                    const destinatarios: string[] = [];
                    const opUserId = m.operador?.usuario?.id;
                    if (opUserId && opUserId !== realizadoPorId) destinatarios.push(opUserId);
                    const adminIds = await this.getAdminIds();
                    adminIds.forEach(id => { if (!destinatarios.includes(id) && id !== realizadoPorId) destinatarios.push(id); });
                    await Promise.all(destinatarios.map(usuarioId =>
                        this.crearNotificacion({
                            usuarioId,
                            tipo: 'INCIDENTE_REPORTADO',
                            titulo: '⚠️ Incidente en Tránsito',
                            mensaje: `Incidente reportado en manifiesto ${m.numero}${datos?.descripcion ? ': ' + datos.descripcion : ''}`,
                            manifiestoId,
                            prioridad: 'ALTA'
                        })
                    ));
                }
            } else if (evento === 'RECHAZO_CARGA') {
                const m = await prisma.manifiesto.findUnique({
                    where: { id: manifiestoId },
                    select: { numero: true, generador: { select: { usuario: { select: { id: true } } } } }
                });
                if (m) {
                    const destinatarios: string[] = [];
                    const genUserId = m.generador?.usuario?.id;
                    if (genUserId && genUserId !== realizadoPorId) destinatarios.push(genUserId);
                    const adminIds = await this.getAdminIds();
                    adminIds.forEach(id => { if (!destinatarios.includes(id) && id !== realizadoPorId) destinatarios.push(id); });
                    await Promise.all(destinatarios.map(usuarioId =>
                        this.crearNotificacion({
                            usuarioId,
                            tipo: 'MANIFIESTO_RECHAZADO',
                            titulo: '❌ Carga Rechazada',
                            mensaje: `La carga del manifiesto ${m.numero} fue rechazada`,
                            manifiestoId,
                            prioridad: 'ALTA'
                        })
                    ));
                }
            } else if (evento === 'DIFERENCIA_PESO') {
                const m = await prisma.manifiesto.findUnique({
                    where: { id: manifiestoId },
                    select: { numero: true, generador: { select: { usuario: { select: { id: true } } } } }
                });
                if (m) {
                    const destinatarios: string[] = [];
                    const genUserId = m.generador?.usuario?.id;
                    if (genUserId && genUserId !== realizadoPorId) destinatarios.push(genUserId);
                    const adminIds = await this.getAdminIds();
                    adminIds.forEach(id => { if (!destinatarios.includes(id) && id !== realizadoPorId) destinatarios.push(id); });
                    await Promise.all(destinatarios.map(usuarioId =>
                        this.crearNotificacion({
                            usuarioId,
                            tipo: 'ALERTA_SISTEMA',
                            titulo: '⚖️ Diferencia de Peso Detectada',
                            mensaje: `El manifiesto ${m.numero} presenta diferencia de peso${datos?.delta ? ' del ' + datos.delta : ''}`,
                            manifiestoId,
                            prioridad: 'ALTA'
                        })
                    ));
                }
            }

            // Crear AlertaGenerada para cada regla activa que coincida (log global para ADMIN)
            const reglas = await prisma.reglaAlerta.findMany({
                where: { evento: evento as EventoAlerta, activa: true }
            });
            for (const regla of reglas) {
                await prisma.alertaGenerada.create({
                    data: {
                        reglaId: regla.id,
                        manifiestoId,
                        datos: JSON.stringify(datos ?? {}),
                        estado: 'PENDIENTE'
                    }
                });

                // Notificar a destinatarios configurados en la regla
                let destList: string[] = [];
                try {
                    destList = JSON.parse(regla.destinatarios || '[]');
                } catch { /* malformed JSON, skip */ }

                const roles = destList.filter((d: string) => !d.startsWith('email:'));
                const emails = destList
                    .filter((d: string) => d.startsWith('email:'))
                    .map((d: string) => d.replace('email:', ''));

                // Recopilar todos los emails: explícitos de la regla + usuarios del rol con notifEmail activo
                const allEmailsSet = new Set<string>(emails);
                for (const rol of roles) {
                    await this.notificarPorRol(rol, {
                        tipo: 'ALERTA_SISTEMA' as TipoNotificacion,
                        titulo: regla.nombre,
                        mensaje: `Regla activada: ${regla.nombre}${datos?.descripcion ? ' — ' + datos.descripcion : ''}`,
                        manifiestoId,
                        prioridad: 'ALTA' as PrioridadNotificacion
                    });
                    // Añadir emails de usuarios del rol que tienen notifEmail activo
                    const usuariosConEmail = await prisma.usuario.findMany({
                        where: { rol: rol as any, activo: true, notifEmail: true },
                        select: { email: true },
                    });
                    usuariosConEmail.forEach(u => allEmailsSet.add(u.email));
                }

                if (allEmailsSet.size > 0) {
                    await emailService.sendAlertEmail(Array.from(allEmailsSet), regla, manifiestoId, datos ?? {});
                }
            }

            console.log(`[ALERTA] evento=${evento} manifiestoId=${manifiestoId}`);
        } catch (err) {
            console.error(`[ALERTA] Error disparando evento ${params.evento}:`, err);
        }
    }
}

export const notificationService = new NotificationService();

// ============ CONTROLADOR DE NOTIFICACIONES ============

// Obtener notificaciones del usuario actual
export const getNotificaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;
        const { leida, limit = 20, offset = 0 } = req.query;
        const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));

        const where: any = { usuarioId };
        if (leida === 'false') where.leida = false;
        if (leida === 'true') where.leida = true;

        const [notificaciones, total, noLeidas] = await Promise.all([
            prisma.notificacion.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip: parseInt(offset as string),
                include: {
                    manifiesto: {
                        select: { numero: true, estado: true }
                    }
                }
            }),
            prisma.notificacion.count({ where }),
            prisma.notificacion.count({ where: { usuarioId, leida: false } })
        ]);

        res.json({
            success: true,
            data: {
                notificaciones,
                total,
                noLeidas,
                pagina: Math.floor(parseInt(offset as string) / limitNum) + 1,
                totalPaginas: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        next(error);
    }
};

// Marcar notificación como leída
export const marcarLeida = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as any).user.id;

        const notificacion = await prisma.notificacion.update({
            where: { id, usuarioId },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, data: notificacion });
    } catch (error) {
        next(error);
    }
};

// Marcar todas como leídas
export const marcarTodasLeidas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;

        await prisma.notificacion.updateMany({
            where: { usuarioId, leida: false },
            data: { leida: true, fechaLeida: new Date() }
        });

        res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        next(error);
    }
};

// Eliminar notificación
export const eliminarNotificacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const usuarioId = (req as any).user.id;

        await prisma.notificacion.delete({
            where: { id, usuarioId }
        });

        res.json({ success: true, message: 'Notificación eliminada' });
    } catch (error) {
        next(error);
    }
};

// ============ CONTROLADOR DE REGLAS DE ALERTA ============

// Obtener reglas de alerta
export const getReglasAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reglas = await prisma.reglaAlerta.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                creadoPor: { select: { nombre: true, apellido: true } },
                _count: { select: { alertasGeneradas: true } }
            }
        });

        res.json({ success: true, data: reglas });
    } catch (error) {
        next(error);
    }
};

// Crear regla de alerta
export const crearReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;
        const { nombre, descripcion, evento, condicion, destinatarios } = req.body;

        // Frontend already sends condicion and destinatarios as JSON strings — do NOT re-stringify
        const condicionStr = typeof condicion === 'string' ? condicion : JSON.stringify(condicion);
        const destinatariosStr = typeof destinatarios === 'string' ? destinatarios : JSON.stringify(destinatarios);

        const regla = await prisma.reglaAlerta.create({
            data: {
                nombre,
                descripcion,
                evento: evento as EventoAlerta,
                condicion: condicionStr,
                destinatarios: destinatariosStr,
                creadoPorId: usuarioId
            }
        });

        res.status(201).json({ success: true, data: regla });
    } catch (error) {
        next(error);
    }
};

// Actualizar regla de alerta
export const actualizarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, evento, condicion, destinatarios, activa } = req.body;

        // Frontend already sends condicion and destinatarios as JSON strings — do NOT re-stringify
        const condicionStr = condicion
            ? (typeof condicion === 'string' ? condicion : JSON.stringify(condicion))
            : undefined;
        const destinatariosStr = destinatarios
            ? (typeof destinatarios === 'string' ? destinatarios : JSON.stringify(destinatarios))
            : undefined;

        const regla = await prisma.reglaAlerta.update({
            where: { id },
            data: {
                nombre,
                descripcion,
                evento: evento as EventoAlerta,
                condicion: condicionStr,
                destinatarios: destinatariosStr,
                activa
            }
        });

        res.json({ success: true, data: regla });
    } catch (error) {
        next(error);
    }
};

// Eliminar regla de alerta
export const eliminarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await prisma.reglaAlerta.delete({ where: { id } });

        res.json({ success: true, message: 'Regla eliminada' });
    } catch (error) {
        next(error);
    }
};

// ============ CONTROLADOR DE ALERTAS GENERADAS ============

// Obtener alertas generadas
export const getAlertasGeneradas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { estado, limit = 50, offset = 0 } = req.query;
        const alertasLimit = Math.min(500, Math.max(1, parseInt(limit as string)));

        const where: any = {};
        if (estado) where.estado = estado;

        const [alertas, total] = await Promise.all([
            prisma.alertaGenerada.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: alertasLimit,
                skip: parseInt(offset as string),
                include: {
                    regla: { select: { nombre: true, evento: true } },
                    manifiesto: { select: { numero: true, estado: true } }
                }
            }),
            prisma.alertaGenerada.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                alertas,
                total,
                pagina: Math.floor(parseInt(offset as string) / alertasLimit) + 1,
                totalPaginas: Math.ceil(total / alertasLimit)
            }
        });
    } catch (error) {
        next(error);
    }
};

// Resolver alerta
export const resolverAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { estado, notas } = req.body;
        const usuarioId = (req as any).user.id;

        const alerta = await prisma.alertaGenerada.update({
            where: { id },
            data: {
                estado: estado as EstadoAlerta,
                notas,
                resueltaPor: usuarioId,
                fechaResolucion: new Date()
            }
        });

        res.json({ success: true, data: alerta });
    } catch (error) {
        next(error);
    }
};

// ============ DETECCIÓN DE ANOMALÍAS GPS ============

interface PuntoGPS {
    latitud: number;
    longitud: number;
    timestamp: Date;
    velocidad?: number;
}

class AnomaliaDetector {
    // Calcular distancia entre dos puntos en km (Haversine)
    private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    // Detectar anomalías en la ruta
    async detectarAnomalias(manifiestoId: string, userId?: string): Promise<any[]> {
        const anomaliasDetectadas: any[] = [];

        // Obtener tracking del manifiesto
        const tracking = await prisma.trackingGPS.findMany({
            where: { manifiestoId },
            orderBy: { timestamp: 'asc' }
        });

        if (tracking.length < 2) return anomaliasDetectadas;

        // Obtener info del manifiesto
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId },
            include: {
                generador: true,
                operador: true
            }
        });

        if (!manifiesto) return anomaliasDetectadas;

        // Analizar puntos
        for (let i = 1; i < tracking.length; i++) {
            const puntoAnterior = tracking[i - 1];
            const puntoActual = tracking[i];

            // Calcular distancia y tiempo
            const distancia = this.calcularDistancia(
                puntoAnterior.latitud, puntoAnterior.longitud,
                puntoActual.latitud, puntoActual.longitud
            );
            const tiempoHoras = (puntoActual.timestamp.getTime() - puntoAnterior.timestamp.getTime()) / (1000 * 60 * 60);
            const velocidadCalculada = tiempoHoras > 0 ? distancia / tiempoHoras : 0;

            // 1. Detectar velocidad anormal (> 120 km/h)
            if (velocidadCalculada > 120) {
                anomaliasDetectadas.push({
                    tipo: 'VELOCIDAD_ANORMAL' as TipoAnomalia,
                    descripcion: `Velocidad anormalmente alta detectada: ${velocidadCalculada.toFixed(1)} km/h`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: velocidadCalculada,
                    valorEsperado: 100,
                    severidad: 'ALTA' as SeveridadAnomalia
                });
            }

            // 2. Detectar parada prolongada (> 2 horas sin movimiento significativo)
            if (distancia < 0.1 && tiempoHoras > 2) {
                anomaliasDetectadas.push({
                    tipo: 'PARADA_PROLONGADA' as TipoAnomalia,
                    descripcion: `Parada prolongada de ${(tiempoHoras * 60).toFixed(0)} minutos`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: tiempoHoras * 60,
                    valorEsperado: 60,
                    severidad: tiempoHoras > 4 ? 'ALTA' as SeveridadAnomalia : 'MEDIA' as SeveridadAnomalia
                });
            }

            // 3. Detectar pérdida de GPS (gap > 30 min sin datos)
            if (tiempoHoras > 0.5 && distancia > 10) {
                anomaliasDetectadas.push({
                    tipo: 'GPS_PERDIDO' as TipoAnomalia,
                    descripcion: `Pérdida de señal GPS por ${(tiempoHoras * 60).toFixed(0)} minutos`,
                    latitud: puntoActual.latitud,
                    longitud: puntoActual.longitud,
                    valorDetectado: tiempoHoras * 60,
                    valorEsperado: 5,
                    severidad: 'MEDIA' as SeveridadAnomalia
                });
            }
        }

        // Guardar anomalías detectadas
        for (const anomalia of anomaliasDetectadas) {
            await prisma.anomaliaTransporte.create({
                data: {
                    manifiestoId,
                    ...anomalia
                }
            });

            // Emitir evento de dominio para que el alertaSubscriber maneje notificaciones y alertas
            domainEvents.emit({
                type: 'ANOMALIA_GPS',
                manifiestoId,
                tipoAnomalia: anomalia.tipo,
                descripcion: anomalia.descripcion,
                severidad: anomalia.severidad,
                userId: userId ?? manifiestoId,
            });
        }

        return anomaliasDetectadas;
    }

    // Verificar tiempo excesivo de tránsito
    async verificarTiempoTransito(manifiestoId: string): Promise<boolean> {
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id: manifiestoId }
        });

        if (!manifiesto || !manifiesto.fechaRetiro || manifiesto.estado !== 'EN_TRANSITO') {
            return false;
        }

        const horasTransito = (Date.now() - manifiesto.fechaRetiro.getTime()) / (1000 * 60 * 60);
        const LIMITE_HORAS = 24; // Máximo 24 horas de tránsito

        if (horasTransito > LIMITE_HORAS) {
            // Crear anomalía
            await prisma.anomaliaTransporte.create({
                data: {
                    manifiestoId,
                    tipo: 'TIEMPO_EXCESIVO',
                    descripcion: `Tiempo de tránsito excede ${LIMITE_HORAS} horas: ${horasTransito.toFixed(1)} horas`,
                    latitud: 0,
                    longitud: 0,
                    valorDetectado: horasTransito,
                    valorEsperado: LIMITE_HORAS,
                    severidad: 'ALTA'
                }
            });

            // Emitir evento de dominio
            domainEvents.emit({
                type: 'TIEMPO_EXCESIVO',
                manifiestoId,
                horasTransito,
                numero: manifiesto.numero,
                userId: manifiestoId, // userId no disponible en este contexto
            });

            return true;
        }

        return false;
    }
}

export const anomaliaDetector = new AnomaliaDetector();

// Endpoint para detectar anomalías
export const detectarAnomalias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const anomalias = await anomaliaDetector.detectarAnomalias(manifiestoId);
        res.json({ success: true, data: anomalias });
    } catch (error) {
        next(error);
    }
};

// Obtener anomalías de un manifiesto
export const getAnomalias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const { resuelta } = req.query;

        const where: any = { manifiestoId };
        if (resuelta !== undefined) where.resuelta = resuelta === 'true';

        const anomalias = await prisma.anomaliaTransporte.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: anomalias });
    } catch (error) {
        next(error);
    }
};

// Resolver anomalía
export const resolverAnomalia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { notas } = req.body;
        const usuarioId = (req as any).user.id;

        const anomalia = await prisma.anomaliaTransporte.update({
            where: { id },
            data: {
                resuelta: true,
                resueltaPor: usuarioId,
                fechaResolucion: new Date(),
                notas
            }
        });

        res.json({ success: true, data: anomalia });
    } catch (error) {
        next(error);
    }
};

// ============ CARGA MASIVA DE DATOS ============

export const cargaMasivaGeneradores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                // Verificar si existe
                const existe = await prisma.generador.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    // Actualizar
                    await prisma.generador.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroInscripcion: registro.numeroinscripcion || registro.numero_inscripcion,
                            categoria: registro.categoria
                        }
                    });
                } else {
                    // Crear usuario y generador
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'GENERADOR',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.generador.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroInscripcion: registro.numeroinscripcion || registro.numero_inscripcion || 'PENDIENTE',
                            categoria: registro.categoria || 'General'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaTransportistas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                const existe = await prisma.transportista.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    await prisma.transportista.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion
                        }
                    });
                } else {
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'TRANSPORTISTA',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.transportista.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion || 'PENDIENTE'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaOperadores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo no proporcionado' });
        }

        const csv = req.file.buffer.toString('utf-8');
        const lineas = csv.split('\n').filter(l => l.trim());
        const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());

        const resultados = {
            total: lineas.length - 1,
            exitosos: 0,
            errores: [] as { linea: number; error: string }[]
        };

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            const registro: any = {};
            cabecera.forEach((col, idx) => {
                registro[col] = valores[idx];
            });

            try {
                const existe = await prisma.operador.findUnique({
                    where: { cuit: registro.cuit }
                });

                if (existe) {
                    await prisma.operador.update({
                        where: { cuit: registro.cuit },
                        data: {
                            razonSocial: registro.razonsocial || registro.razon_social,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion,
                            categoria: registro.categoria
                        }
                    });
                } else {
                    const password = await require('bcryptjs').hash('temporal123', 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            email: registro.email,
                            password,
                            rol: 'OPERADOR',
                            nombre: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            activo: true
                        }
                    });

                    await prisma.operador.create({
                        data: {
                            usuarioId: usuario.id,
                            razonSocial: registro.razonsocial || registro.razon_social,
                            cuit: registro.cuit,
                            domicilio: registro.domicilio,
                            telefono: registro.telefono,
                            email: registro.email,
                            numeroHabilitacion: registro.numerohabilitacion || registro.numero_habilitacion || 'PENDIENTE',
                            categoria: registro.categoria || 'General'
                        }
                    });
                }

                resultados.exitosos++;
            } catch (error: any) {
                resultados.errores.push({
                    linea: i + 1,
                    error: error.message
                });
            }
        }

        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

// Descargar plantilla CSV
export const descargarPlantilla = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tipo } = req.params;

        const plantillas: Record<string, string> = {
            generadores: 'cuit,razon_social,domicilio,telefono,email,numero_inscripcion,categoria\n30-12345678-9,Empresa Demo SA,Av. Ejemplo 1234,261-4567890,contacto@empresa.com,MDZ-001-2024,Industrial',
            transportistas: 'cuit,razon_social,domicilio,telefono,email,numero_habilitacion\n30-98765432-1,Transporte Demo SRL,Ruta 40 Km 5,261-9876543,info@transporte.com,HAB-T-001',
            operadores: 'cuit,razon_social,domicilio,telefono,email,numero_habilitacion,categoria\n30-55555555-5,Operador Demo SA,Parque Industrial 100,261-5555555,operador@demo.com,HAB-O-001,Disposición Final'
        };

        if (!plantillas[tipo]) {
            return res.status(400).json({ success: false, error: 'Tipo de plantilla no válido' });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=plantilla_${tipo}.csv`);
        res.send(plantillas[tipo]);
    } catch (error) {
        next(error);
    }
};

import { Request, Response, NextFunction } from 'express';
import { Rol, TipoNotificacion, PrioridadNotificacion, EventoAlerta, EstadoAlerta, TipoAnomalia, SeveridadAnomalia } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { emailService } from '../services/email.service';
import { domainEvents } from '../services/domainEvent.service';
import { AuthRequest } from '../middlewares/auth.middleware';

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

    // Crear notificacion para un usuario + enviar por canales configurados
    async crearNotificacion(data: {
        usuarioId: string;
        tipo: TipoNotificacion;
        titulo: string;
        mensaje: string;
        datos?: any;
        manifiestoId?: string;
        prioridad?: PrioridadNotificacion;
    }) {
        const notif = await prisma.notificacion.create({
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

        // Send via configured channels (fire-and-forget, never blocks)
        setImmediate(async () => {
            try {
                const user = await prisma.usuario.findUnique({
                    where: { id: data.usuarioId },
                    select: { email: true, nombre: true, notifEmail: true, notifWhatsapp: true, notifTelegram: true, whatsappPhone: true, telegramChatId: true },
                });
                if (!user) return;

                // Email channel
                if (user.notifEmail) {
                    const subject = `[SITREP] ${data.titulo}`;
                    emailService.sendAlertEmail(
                        [user.email],
                        { nombre: data.titulo, descripcion: data.mensaje },
                        data.manifiestoId || null,
                        { mensaje: data.mensaje, ...(data.datos || {}) },
                    ).catch(() => {});
                }

                // WhatsApp channel (placeholder — requires integration with WhatsApp Business API)
                if (user.notifWhatsapp && user.whatsappPhone) {
                    logger.info({ channel: 'WhatsApp', to: user.whatsappPhone }, `${data.titulo}: ${data.mensaje}`);
                    // TODO: Integrate with WhatsApp Business API or Twilio
                    // await whatsappService.send(user.whatsappPhone, `*${data.titulo}*\n${data.mensaje}`);
                }

                // Telegram channel (placeholder — requires Telegram Bot API)
                if (user.notifTelegram && user.telegramChatId) {
                    logger.info({ channel: 'Telegram', chatId: user.telegramChatId }, `${data.titulo}: ${data.mensaje}`);
                    // TODO: Integrate with Telegram Bot API
                    // await telegramService.send(user.telegramChatId, `*${data.titulo}*\n${data.mensaje}`);
                }
            } catch (err) {
                logger.error({ err }, 'Error sending notification via channels');
            }
        });

        return notif;
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
            where: { rol: rol as Rol, activo: true },
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

        const gen = manifiesto.generador;
        const trans = manifiesto.transportista;
        const oper = manifiesto.operador;
        const num = manifiesto.numero;

        // Build maps URL from generador coordinates (pickup location)
        const mapsUrl = gen.latitud && gen.longitud
            ? `https://maps.google.com/?q=${gen.latitud},${gen.longitud}`
            : null;
        const fechaRetiro = manifiesto.fechaEstimadaRetiro
            ? manifiesto.fechaEstimadaRetiro.toLocaleDateString('es-AR')
            : null;

        // APROBADO: personalized notifications per role with location data
        if (nuevoEstado === 'APROBADO') {
            const promises: Promise<any>[] = [];

            // Transportista: full pickup details with map link
            if (trans.usuario.id !== actorId) {
                const retiroInfo = fechaRetiro ? ` Retiro: ${fechaRetiro}.` : '';
                promises.push(this.crearNotificacion({
                    usuarioId: trans.usuario.id,
                    tipo: 'MANIFIESTO_FIRMADO' as TipoNotificacion,
                    titulo: 'Nuevo retiro asignado',
                    mensaje: `${num} —${retiroInfo} ${gen.razonSocial}, ${gen.domicilio || ''}`.trim(),
                    manifiestoId,
                    prioridad: 'ALTA' as PrioridadNotificacion,
                    datos: {
                        tipo: 'retiro_asignado',
                        fechaRetiro: fechaRetiro || null,
                        direccion: gen.domicilio || null,
                        lat: gen.latitud, lng: gen.longitud,
                        mapsUrl,
                        generador: gen.razonSocial,
                        operadorDestino: oper.razonSocial,
                    },
                }));
            }

            // Operador: upcoming reception
            if (oper.usuario.id !== actorId) {
                promises.push(this.crearNotificacion({
                    usuarioId: oper.usuario.id,
                    tipo: 'MANIFIESTO_FIRMADO' as TipoNotificacion,
                    titulo: 'Manifiesto firmado — recibiras residuos',
                    mensaje: `${num} de ${gen.razonSocial}.${fechaRetiro ? ` Retiro estimado: ${fechaRetiro}` : ''}`,
                    manifiestoId,
                    prioridad: 'NORMAL' as PrioridadNotificacion,
                    datos: {
                        tipo: 'recepcion_programada',
                        fechaRetiro: fechaRetiro || null,
                        generador: gen.razonSocial,
                        transportista: trans.razonSocial,
                    },
                }));
            }

            // Generador (if not the signer)
            if (gen.usuario.id !== actorId) {
                promises.push(this.crearNotificacion({
                    usuarioId: gen.usuario.id,
                    tipo: 'MANIFIESTO_FIRMADO' as TipoNotificacion,
                    titulo: 'Tu manifiesto fue firmado',
                    mensaje: `${num} firmado y listo para retiro`,
                    manifiestoId,
                    prioridad: 'NORMAL' as PrioridadNotificacion,
                }));
            }

            // Admins
            const adminIds = await this.getAdminIds();
            for (const adminId of adminIds) {
                if (adminId !== actorId && adminId !== gen.usuario.id && adminId !== trans.usuario.id && adminId !== oper.usuario.id) {
                    promises.push(this.crearNotificacion({
                        usuarioId: adminId,
                        tipo: 'MANIFIESTO_FIRMADO' as TipoNotificacion,
                        titulo: 'Manifiesto firmado',
                        mensaje: `${num} firmado por ${gen.razonSocial}`,
                        manifiestoId,
                        prioridad: 'NORMAL' as PrioridadNotificacion,
                    }));
                }
            }

            await Promise.all(promises);
            return;
        }

        // Other states: generic notification to all parties
        const mensajes: Record<string, { titulo: string; mensaje: string; tipo: TipoNotificacion }> = {
            'EN_TRANSITO': {
                titulo: 'Transporte Iniciado',
                mensaje: `El manifiesto ${num} esta en camino`,
                tipo: 'MANIFIESTO_EN_TRANSITO'
            },
            'ENTREGADO': {
                titulo: 'Entrega Confirmada',
                mensaje: `El manifiesto ${num} ha sido entregado en destino`,
                tipo: 'MANIFIESTO_ENTREGADO'
            },
            'RECIBIDO': {
                titulo: 'Recepcion Confirmada',
                mensaje: `El operador ha confirmado la recepcion del manifiesto ${num}`,
                tipo: 'MANIFIESTO_RECIBIDO'
            },
            'TRATADO': {
                titulo: 'Tratamiento Completado',
                mensaje: `El manifiesto ${num} ha sido tratado y cerrado`,
                tipo: 'MANIFIESTO_TRATADO'
            },
            'RECHAZADO': {
                titulo: 'Carga Rechazada',
                mensaje: `La carga del manifiesto ${num} ha sido rechazada`,
                tipo: 'MANIFIESTO_RECHAZADO'
            },
            'EN_TRATAMIENTO': {
                titulo: 'Tratamiento Iniciado',
                mensaje: `El manifiesto ${num} ha iniciado el proceso de tratamiento`,
                tipo: 'INFO_GENERAL'
            }
        };

        const info = mensajes[nuevoEstado];
        if (!info) return;

        const destinatarios = [gen.usuario.id, trans.usuario.id, oper.usuario.id].filter(id => id !== actorId);
        const adminIds = await this.getAdminIds();
        adminIds.forEach(id => { if (!destinatarios.includes(id)) destinatarios.push(id); });

        await Promise.all(destinatarios.map(usuarioId =>
            this.crearNotificacion({
                usuarioId, ...info, manifiestoId,
                prioridad: nuevoEstado === 'RECHAZADO' ? 'ALTA' : 'NORMAL'
            })
        ));
    }
}

export const notificationService = new NotificationService();

// ============ CONTROLADOR DE NOTIFICACIONES ============

// Obtener notificaciones del usuario actual
export const getNotificaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as AuthRequest).user!.id;
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
        const usuarioId = (req as AuthRequest).user!.id;

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
        const usuarioId = (req as AuthRequest).user!.id;

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
        const usuarioId = (req as AuthRequest).user!.id;

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
        const usuarioId = (req as AuthRequest).user!.id;
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
        const usuarioId = (req as AuthRequest).user!.id;

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
        const usuarioId = (req as AuthRequest).user!.id;

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

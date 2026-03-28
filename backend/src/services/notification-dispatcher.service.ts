import { Rol, TipoNotificacion, PrioridadNotificacion } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { emailService } from './email.service';

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
            const isInSitu = manifiesto.modalidad === 'IN_SITU';

            // Transportista: full pickup details with map link (skip for IN_SITU — no transportista)
            if (trans && trans.usuario.id !== actorId) {
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

            // Operador: upcoming reception (IN_SITU gets a different message — proceed in-situ)
            if (oper.usuario.id !== actorId) {
                const titulo = isInSitu
                    ? 'Tratamiento in situ requerido'
                    : 'Manifiesto firmado — recibiras residuos';
                const mensaje = isInSitu
                    ? `${num} de ${gen.razonSocial}. Debe proceder con tratamiento in situ en ${gen.domicilio || 'domicilio del generador'}.`
                    : `${num} de ${gen.razonSocial}.${fechaRetiro ? ` Retiro estimado: ${fechaRetiro}` : ''}`;
                promises.push(this.crearNotificacion({
                    usuarioId: oper.usuario.id,
                    tipo: 'MANIFIESTO_FIRMADO' as TipoNotificacion,
                    titulo,
                    mensaje,
                    manifiestoId,
                    prioridad: isInSitu ? 'ALTA' as PrioridadNotificacion : 'NORMAL' as PrioridadNotificacion,
                    datos: {
                        tipo: isInSitu ? 'tratamiento_insitu' : 'recepcion_programada',
                        fechaRetiro: fechaRetiro || null,
                        generador: gen.razonSocial,
                        transportista: trans?.razonSocial || null,
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
            const transUserId = trans?.usuario?.id;
            for (const adminId of adminIds) {
                if (adminId !== actorId && adminId !== gen.usuario.id && adminId !== transUserId && adminId !== oper.usuario.id) {
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

        const destinatarios = [gen.usuario.id, trans?.usuario?.id, oper.usuario.id].filter((id): id is string => !!id && id !== actorId);
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

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

// Tipos de eventos WebSocket
export const WS_EVENTS = {
  // Manifiestos
  MANIFIESTO_CREATED: 'manifiesto:created',
  MANIFIESTO_UPDATED: 'manifiesto:updated',
  MANIFIESTO_ESTADO_CHANGED: 'manifiesto:estado-changed',

  // GPS tracking
  GPS_UPDATE: 'gps:update',
  GPS_BATCH: 'gps:batch',

  // Notificaciones
  NOTIFICATION: 'notification',
  NOTIFICATION_COUNT: 'notification:count',

  // Stats
  STATS_UPDATED: 'stats:updated',

  // Viajes
  VIAJE_STARTED: 'viaje:started',
  VIAJE_ENDED: 'viaje:ended',
  VIAJE_UPDATE: 'viaje:update'
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

class WebSocketService {
  private io: Server | null = null;

  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.CORS_ORIGIN.split(',').map(o => o.trim()),
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Middleware de autenticación JWT
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token ||
                      socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Token requerido'));
        }

        const decoded = jwt.verify(token, config.JWT_SECRET as string) as {
          id: string;
          email: string;
          rol: string;
        };

        socket.userId = decoded.id;
        socket.userRole = decoded.rol;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        next(new Error('Token inválido'));
      }
    });

    // Manejo de conexiones
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`[WS] Connected: ${socket.userEmail} (${socket.userRole})`);

      // Unir a rooms según el rol y usuario
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }
      if (socket.userRole) {
        socket.join(`role:${socket.userRole}`);
      }

      // Suscribirse a un manifiesto específico (para tracking GPS)
      socket.on('subscribe:manifiesto', (manifiestoId: string) => {
        socket.join(`manifiesto:${manifiestoId}`);
        console.log(`[WS] ${socket.userEmail} subscribed to manifiesto:${manifiestoId}`);
      });

      socket.on('unsubscribe:manifiesto', (manifiestoId: string) => {
        socket.leave(`manifiesto:${manifiestoId}`);
      });

      // Suscribirse a viaje (tracking en tiempo real)
      socket.on('subscribe:viaje', (viajeId: string) => {
        socket.join(`viaje:${viajeId}`);
      });

      socket.on('unsubscribe:viaje', (viajeId: string) => {
        socket.leave(`viaje:${viajeId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[WS] Disconnected: ${socket.userEmail}`);
      });
    });

    console.log('[WS] WebSocket server initialized');
  }

  // Emitir a un usuario específico
  emitToUser(userId: string, event: string, data: unknown): void {
    this.io?.to(`user:${userId}`).emit(event, data);
  }

  // Emitir a todos los usuarios de un rol
  emitToRole(role: string, event: string, data: unknown): void {
    this.io?.to(`role:${role}`).emit(event, data);
  }

  // Emitir a múltiples roles
  emitToRoles(roles: string[], event: string, data: unknown): void {
    roles.forEach(role => this.emitToRole(role, event, data));
  }

  // Emitir a suscriptores de un manifiesto
  emitToManifiesto(manifiestoId: string, event: string, data: unknown): void {
    this.io?.to(`manifiesto:${manifiestoId}`).emit(event, data);
  }

  // Emitir a suscriptores de un viaje
  emitToViaje(viajeId: string, event: string, data: unknown): void {
    this.io?.to(`viaje:${viajeId}`).emit(event, data);
  }

  // Emitir a todos los conectados
  emitToAll(event: string, data: unknown): void {
    this.io?.emit(event, data);
  }

  // Obtener estadísticas de conexiones
  getStats(): { total: number; byRole: Record<string, number> } {
    if (!this.io) return { total: 0, byRole: {} };

    const sockets = this.io.sockets.sockets;
    const byRole: Record<string, number> = {};
    let total = 0;

    sockets.forEach((socket: AuthenticatedSocket) => {
      total++;
      const role = socket.userRole || 'unknown';
      byRole[role] = (byRole[role] || 0) + 1;
    });

    return { total, byRole };
  }

  // ========================================
  // HELPERS PARA EVENTOS ESPECÍFICOS
  // ========================================

  // Notificar cambio de estado de manifiesto
  notifyManifiestoEstadoChanged(
    manifiestoId: string,
    nuevoEstado: string,
    manifiestoNumero: string,
    involucrados: { generadorUserId?: string; transportistaUserId?: string; operadorUserId?: string }
  ): void {
    const payload = {
      id: manifiestoId,
      numero: manifiestoNumero,
      estado: nuevoEstado,
      timestamp: new Date().toISOString()
    };

    // Notificar a suscriptores del manifiesto
    this.emitToManifiesto(manifiestoId, WS_EVENTS.MANIFIESTO_ESTADO_CHANGED, payload);

    // Notificar a usuarios involucrados
    if (involucrados.generadorUserId) {
      this.emitToUser(involucrados.generadorUserId, WS_EVENTS.MANIFIESTO_ESTADO_CHANGED, payload);
    }
    if (involucrados.transportistaUserId) {
      this.emitToUser(involucrados.transportistaUserId, WS_EVENTS.MANIFIESTO_ESTADO_CHANGED, payload);
    }
    if (involucrados.operadorUserId) {
      this.emitToUser(involucrados.operadorUserId, WS_EVENTS.MANIFIESTO_ESTADO_CHANGED, payload);
    }

    // Notificar a admins que deben actualizar stats
    this.emitToRole('ADMIN', WS_EVENTS.STATS_UPDATED, { timestamp: new Date().toISOString() });
  }

  // Emitir actualización GPS
  notifyGPSUpdate(
    manifiestoId: string,
    viajeId: string,
    ubicacion: { lat: number; lng: number; velocidad?: number; timestamp: string }
  ): void {
    const payload = { manifiestoId, viajeId, ...ubicacion };

    // A suscriptores del manifiesto
    this.emitToManifiesto(manifiestoId, WS_EVENTS.GPS_UPDATE, payload);

    // A suscriptores del viaje
    this.emitToViaje(viajeId, WS_EVENTS.GPS_UPDATE, payload);
  }

  // Notificar nueva notificación
  notifyNewNotification(userId: string, notificacion: {
    id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    prioridad: string;
  }): void {
    this.emitToUser(userId, WS_EVENTS.NOTIFICATION, notificacion);
  }
}

// Singleton
export const wsService = new WebSocketService();

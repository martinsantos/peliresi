import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Tipos de eventos (sincronizados con backend)
export const WS_EVENTS = {
  MANIFIESTO_CREATED: 'manifiesto:created',
  MANIFIESTO_UPDATED: 'manifiesto:updated',
  MANIFIESTO_ESTADO_CHANGED: 'manifiesto:estado-changed',
  GPS_UPDATE: 'gps:update',
  GPS_BATCH: 'gps:batch',
  NOTIFICATION: 'notification',
  NOTIFICATION_COUNT: 'notification:count',
  STATS_UPDATED: 'stats:updated',
  VIAJE_STARTED: 'viaje:started',
  VIAJE_ENDED: 'viaje:ended',
  VIAJE_UPDATE: 'viaje:update'
} as const;

export type WSEvent = typeof WS_EVENTS[keyof typeof WS_EVENTS];

interface ManifiestoEstadoPayload {
  id: string;
  numero: string;
  estado: string;
  timestamp: string;
}

interface GPSUpdatePayload {
  manifiestoId: string;
  viajeId: string;
  lat: number;
  lng: number;
  velocidad?: number;
  timestamp: string;
}

interface NotificationPayload {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  prioridad: string;
}

type EventCallback<T = unknown> = (data: T) => void;

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToManifiesto: (manifiestoId: string) => void;
  unsubscribeFromManifiesto: (manifiestoId: string) => void;
  subscribeToViaje: (viajeId: string) => void;
  unsubscribeFromViaje: (viajeId: string) => void;
  onManifiestoEstadoChanged: (callback: EventCallback<ManifiestoEstadoPayload>) => () => void;
  onGPSUpdate: (callback: EventCallback<GPSUpdatePayload>) => () => void;
  onNotification: (callback: EventCallback<NotificationPayload>) => () => void;
  onStatsUpdated: (callback: EventCallback<{ timestamp: string }>) => () => void;
  on: <T = unknown>(event: string, callback: EventCallback<T>) => () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 10,
    reconnectionDelay = 1000
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());

  // Obtener token de auth
  const getToken = useCallback(() => {
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.token || parsed.accessToken;
      }
    } catch {
      // Ignorar errores de parsing
    }
    return null;
  }, []);

  // Conectar al servidor WebSocket
  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      console.warn('[WS] No auth token available, skipping connection');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('[WS] Connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message);
      setIsConnected(false);
    });

    // Re-registrar todos los listeners guardados
    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        newSocket.on(event, callback);
      });
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [getToken, reconnection, reconnectionAttempts, reconnectionDelay]);

  // Desconectar
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Suscribirse a un manifiesto específico (para GPS tracking)
  const subscribeToManifiesto = useCallback((manifiestoId: string) => {
    socketRef.current?.emit('subscribe:manifiesto', manifiestoId);
  }, []);

  const unsubscribeFromManifiesto = useCallback((manifiestoId: string) => {
    socketRef.current?.emit('unsubscribe:manifiesto', manifiestoId);
  }, []);

  // Suscribirse a un viaje
  const subscribeToViaje = useCallback((viajeId: string) => {
    socketRef.current?.emit('subscribe:viaje', viajeId);
  }, []);

  const unsubscribeFromViaje = useCallback((viajeId: string) => {
    socketRef.current?.emit('unsubscribe:viaje', viajeId);
  }, []);

  // Registrar listener genérico
  const on = useCallback(<T = unknown>(event: string, callback: EventCallback<T>): (() => void) => {
    // Guardar listener para reconexiones
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback as EventCallback);

    // Registrar en socket actual si existe
    socketRef.current?.on(event, callback as EventCallback);

    // Retornar función de limpieza
    return () => {
      listenersRef.current.get(event)?.delete(callback as EventCallback);
      socketRef.current?.off(event, callback as EventCallback);
    };
  }, []);

  // Helpers para eventos específicos
  const onManifiestoEstadoChanged = useCallback((callback: EventCallback<ManifiestoEstadoPayload>) => {
    return on(WS_EVENTS.MANIFIESTO_ESTADO_CHANGED, callback);
  }, [on]);

  const onGPSUpdate = useCallback((callback: EventCallback<GPSUpdatePayload>) => {
    return on(WS_EVENTS.GPS_UPDATE, callback);
  }, [on]);

  const onNotification = useCallback((callback: EventCallback<NotificationPayload>) => {
    return on(WS_EVENTS.NOTIFICATION, callback);
  }, [on]);

  const onStatsUpdated = useCallback((callback: EventCallback<{ timestamp: string }>) => {
    return on(WS_EVENTS.STATS_UPDATED, callback);
  }, [on]);

  // Auto-conectar si hay token
  useEffect(() => {
    if (autoConnect && getToken()) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect, getToken]);

  // Reconectar cuando el token cambie
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth') {
        if (e.newValue) {
          connect();
        } else {
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    subscribeToManifiesto,
    unsubscribeFromManifiesto,
    subscribeToViaje,
    unsubscribeFromViaje,
    onManifiestoEstadoChanged,
    onGPSUpdate,
    onNotification,
    onStatsUpdated,
    on
  };
}

export default useWebSocket;

/**
 * Hook para gestion de notificaciones
 * Encapsula la logica de carga, marcado y eliminacion
 * SINCRONIZADO con WEB: usa getMisAlertas() igual que Notificaciones.tsx
 */

import { useState, useCallback, useEffect } from 'react';
import { notificationService, type Notificacion } from '../services/notification.service';
import { authService } from '../services/auth.service';

interface UseNotificacionesOptions {
    isOnline: boolean;
    enabled: boolean;
    pollingInterval?: number;
}

interface UseNotificacionesReturn {
    notificaciones: Notificacion[];
    noLeidas: number;
    marcarLeida: (id: string) => Promise<boolean>;
    eliminar: (id: string) => Promise<boolean>;
    marcarTodasLeidas: () => Promise<boolean>;
    reload: () => Promise<void>;
}

export function useNotificaciones({
    isOnline,
    enabled,
    pollingInterval = 30000
}: UseNotificacionesOptions): UseNotificacionesReturn {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [noLeidas, setNoLeidas] = useState(0);

    // Obtener el actorId según el rol del usuario (igual que WEB Notificaciones.tsx)
    const getActorId = useCallback((): string | undefined => {
        const user = authService.getStoredUser();
        if (!user) return undefined;

        switch (user.rol) {
            case 'GENERADOR': return user.generador?.id;
            case 'TRANSPORTISTA': return user.transportista?.id;
            case 'OPERADOR': return user.operador?.id;
            default: return undefined;
        }
    }, []);

    const loadNotificaciones = useCallback(async () => {
        if (!isOnline) return;

        try {
            const user = authService.getStoredUser();
            if (!user) return;

            // SINCRONIZADO con WEB: usa getMisAlertas() con limit: 100
            const data = await notificationService.getMisAlertas({
                rol: user.rol,
                actorId: getActorId(),
                limit: 100 // Mismo limit que WEB
            });
            setNotificaciones(data.notificaciones || []);
            setNoLeidas(data.noLeidas || 0);
        } catch (err) {
            console.warn('[useNotificaciones] Error loading notifications:', err);
        }
    }, [isOnline, getActorId]);

    const marcarLeida = useCallback(async (id: string): Promise<boolean> => {
        try {
            await notificationService.marcarLeida(id);
            setNotificaciones(prev => prev.map(n =>
                n.id === id ? { ...n, leida: true } : n
            ));
            setNoLeidas(prev => Math.max(0, prev - 1));
            return true;
        } catch (err) {
            console.error('[useNotificaciones] Error marking as read:', err);
            return false;
        }
    }, []);

    const eliminar = useCallback(async (id: string): Promise<boolean> => {
        try {
            await notificationService.eliminar(id);
            setNotificaciones(prev => prev.filter(n => n.id !== id));
            return true;
        } catch (err) {
            console.error('[useNotificaciones] Error deleting:', err);
            return false;
        }
    }, []);

    const marcarTodasLeidas = useCallback(async (): Promise<boolean> => {
        try {
            await notificationService.marcarTodasLeidas();
            setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
            setNoLeidas(0);
            return true;
        } catch (err) {
            console.error('[useNotificaciones] Error marking all as read:', err);
            return false;
        }
    }, []);

    // Cargar notificaciones y configurar polling
    useEffect(() => {
        if (enabled && isOnline) {
            loadNotificaciones();
            const interval = setInterval(loadNotificaciones, pollingInterval);
            return () => clearInterval(interval);
        }
    }, [enabled, isOnline, loadNotificaciones, pollingInterval]);

    return {
        notificaciones,
        noLeidas,
        marcarLeida,
        eliminar,
        marcarTodasLeidas,
        reload: loadNotificaciones
    };
}

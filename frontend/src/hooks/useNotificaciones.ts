/**
 * Hook para gestion de notificaciones
 * Encapsula la logica de carga, marcado y eliminacion
 * SINCRONIZADO con WEB: usa getMisAlertas() igual que Notificaciones.tsx
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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

    // FIX MEMORY LEAK: AbortController para cancelar polling al cambiar de perfil
    const abortControllerRef = useRef<AbortController | null>(null);

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
    // FIX MEMORY LEAK: Usar AbortController para cancelar requests pendientes
    useEffect(() => {
        if (!enabled || !isOnline) return;

        const loadWithAbort = async () => {
            // Cancelar request anterior si existe
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();

            try {
                const user = authService.getStoredUser();
                if (!user) return;

                // SINCRONIZADO con WEB: usa getMisAlertas() con limit: 100
                const data = await notificationService.getMisAlertas({
                    rol: user.rol,
                    actorId: getActorId(),
                    limit: 100 // Mismo limit que WEB
                });

                // Solo actualizar si no fue abortado
                if (!abortControllerRef.current?.signal.aborted) {
                    setNotificaciones(data.notificaciones || []);
                    setNoLeidas(data.noLeidas || 0);
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    console.log('[useNotificaciones] Request cancelado - cambio de perfil');
                    return;
                }
                console.warn('[useNotificaciones] Error loading notifications:', err);
            }
        };

        loadWithAbort();
        const interval = setInterval(loadWithAbort, pollingInterval);

        return () => {
            clearInterval(interval);
            abortControllerRef.current?.abort();
        };
    }, [enabled, isOnline, pollingInterval, getActorId]);

    return {
        notificaciones,
        noLeidas,
        marcarLeida,
        eliminar,
        marcarTodasLeidas,
        reload: loadNotificaciones
    };
}

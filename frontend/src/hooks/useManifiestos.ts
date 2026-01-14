/**
 * Hook para gestion de manifiestos
 * Encapsula la logica de carga, cache, filtrado y notificaciones
 */

import { useState, useCallback, useEffect } from 'react';
import type { UserRole } from '../types/mobile.types';
import { manifiestoService } from '../services/manifiesto.service';
import { authService } from '../services/auth.service';
import { offlineStorage } from '../services/offlineStorage';
import {
    type BackendManifiesto,
    getEstadosParaCargar,
    filterCachedByActor
} from '../utils/manifiestoUtils';

interface UseManifiestosOptions {
    role: UserRole | null;
    isOnline: boolean;
}

interface UseManifiestosReturn {
    manifiestos: BackendManifiesto[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

export function useManifiestos({ role, isOnline }: UseManifiestosOptions): UseManifiestosReturn {
    const [manifiestos, setManifiestos] = useState<BackendManifiesto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getActorIds = useCallback(() => {
        const currentUser = authService.getStoredUser();
        return {
            transportistaId: currentUser?.transportista?.id,
            operadorId: currentUser?.operador?.id,
            generadorId: currentUser?.generador?.id
        };
    }, []);

    const getFilterParams = useCallback(() => {
        const actorIds = getActorIds();
        const filterParams: { transportistaId?: string; generadorId?: string; operadorId?: string } = {};

        switch (role) {
            case 'TRANSPORTISTA':
                if (actorIds.transportistaId) {
                    filterParams.transportistaId = actorIds.transportistaId;
                }
                break;
            case 'OPERADOR':
                if (actorIds.operadorId) {
                    filterParams.operadorId = actorIds.operadorId;
                }
                break;
            case 'GENERADOR':
                if (actorIds.generadorId) {
                    filterParams.generadorId = actorIds.generadorId;
                }
                break;
        }

        return filterParams;
    }, [role, getActorIds]);

    const loadFromCache = useCallback(async (): Promise<BackendManifiesto[]> => {
        const cached = await offlineStorage.getAllManifiestos();
        const actorIds = getActorIds();
        return filterCachedByActor(cached, role!, actorIds);
    }, [role, getActorIds]);

    const loadManifiestos = useCallback(async () => {
        if (!role) return;

        setLoading(true);
        setError(null);

        try {
            const estados = getEstadosParaCargar(role);
            const filterParams = getFilterParams();
            const allManifiestos: BackendManifiesto[] = [];

            // Cargar manifiestos por estado (limit aumentado para consistencia con WEB)
            for (const estado of estados) {
                try {
                    const data = await manifiestoService.getManifiestos({
                        estado,
                        limit: 100, // Aumentado de 20 a 100 para coincidir con WEB
                        ...filterParams
                    });
                    allManifiestos.push(...(data.manifiestos || []));
                } catch (e) {
                    console.warn(`[useManifiestos] Error loading ${estado}:`, e);
                }
            }

            console.log('[useManifiestos] Loaded', allManifiestos.length, 'manifiestos from backend');

            if (allManifiestos.length === 0) {
                // Intentar cargar del cache
                console.log('[useManifiestos] Backend devolvio 0, intentando cache...');
                const filteredCached = await loadFromCache();
                if (filteredCached.length > 0) {
                    setManifiestos(filteredCached);
                    console.log('[useManifiestos] Usando', filteredCached.length, 'manifiestos cacheados');
                } else {
                    setManifiestos([]);
                }
            } else {
                setManifiestos(allManifiestos);
                // Cachear en IndexedDB para offline
                for (const m of allManifiestos) {
                    await offlineStorage.saveManifiesto(m as any);
                }
                console.log('[useManifiestos] Cacheados', allManifiestos.length, 'manifiestos');
            }
        } catch (err) {
            console.error('[useManifiestos] Error loading manifiestos:', err);
            setError('Error al cargar manifiestos');

            // Cargar desde cache en caso de error
            const filteredCached = await loadFromCache();
            if (filteredCached.length > 0) {
                setManifiestos(filteredCached);
                console.log('[useManifiestos] Usando', filteredCached.length, 'manifiestos cacheados (error)');
            } else {
                setManifiestos([]);
            }
        } finally {
            setLoading(false);
        }
    }, [role, getFilterParams, loadFromCache]);

    // Cargar manifiestos cuando cambia el rol o la conectividad
    useEffect(() => {
        if (role && isOnline) {
            loadManifiestos();
        }
    }, [role, isOnline, loadManifiestos]);

    return {
        manifiestos,
        loading,
        error,
        reload: loadManifiestos
    };
}

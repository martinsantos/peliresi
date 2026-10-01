/**
 * SITREP v6 - Manifiestos Hooks
 * ==============================
 * Queries for manifiestos data. Workflow mutations live in useManifiestoWorkflow.ts.
 * This file re-exports all workflow hooks for backward compatibility.
 */

import { useQuery } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';
import { getCachedManifiestos } from '../services/offline-sync';
import { useAuth } from '../contexts/AuthContext';
import type { ManifiestoFilters } from '../types/api';
import type { Manifiesto } from '../types/models';

type UserId = string | number;

const KEYS = {
  all: ['manifiestos'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (filters?: ManifiestoFilters, userScope?: { userId: UserId; rol: string; actorId: string | null } | null) => [...KEYS.lists(), userScope, filters] as const,
  detail: (id: string) => [...KEYS.all, 'detail', id] as const,
  dashboard: () => [...KEYS.all, 'dashboard'] as const,
};

/** Apply filters client-side on cached data */
function applyClientFilters(items: Manifiesto[], filters?: ManifiestoFilters): Manifiesto[] {
  if (!filters) return items;
  let result = items;
  if (filters.estado) {
    result = result.filter(m => m.estado === filters.estado);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(m =>
      m.numero?.toLowerCase().includes(q) ||
      m.generador?.razonSocial?.toLowerCase().includes(q)
    );
  }
  return result;
}

export function useManifiestos(filters?: ManifiestoFilters, options?: { enabled?: boolean }) {
  const { currentUser } = useAuth();
  const userScope = currentUser
    ? { userId: currentUser.id, rol: currentUser.rol, actorId: currentUser.actorId ?? null }
    : null;

  return useQuery({
    queryKey: KEYS.list(filters, userScope),
    enabled: options?.enabled ?? true,
    // New filters must run the offline cache reader instead of remaining paused.
    networkMode: 'always',
    refetchOnReconnect: 'always',
    // A local snapshot is never a fresh server response after returning online.
    staleTime: query => query.state.data && 'offline' in query.state.data && query.state.data.offline ? 0 : 60_000,
    queryFn: async () => {
      const readOffline = async () => {
        const cached = currentUser?.id ? await getCachedManifiestos(currentUser.id) : [];
        // Reconnection may happen while IndexedDB is pending. The reconnect
        // refetch shares this in-flight query, so finish with live data instead.
        if (navigator.onLine) return manifiestoService.list(filters);
        const filtered = applyClientFilters(cached, filters);
        const limit = Math.min(500, Math.max(1, Math.trunc(filters?.limit || 10)));
        const page = Math.max(1, Math.trunc(filters?.page || 1));
        return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit), offline: true as const };
      };
      if (!navigator.onLine) return readOffline();
      try {
        return await manifiestoService.list(filters);
      } catch (err) {
        // Offline fallback: read from IndexedDB
        if (!navigator.onLine && currentUser?.id) {
          return readOffline();
        }
        throw err;
      }
    },
  });
}

export function useManifiesto(id: string) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: KEYS.detail(id),
    networkMode: 'always',
    refetchOnReconnect: 'always',
    retry: (count, error) => navigator.onLine && error.message !== 'No hay una copia descargada de este manifiesto.' && count < 3,
    queryFn: async (): Promise<Manifiesto & { offline?: true }> => {
      const readOffline = async () => {
        const cached = currentUser?.id ? await getCachedManifiestos(currentUser.id) : [];
        if (navigator.onLine) return manifiestoService.getById(id);
        const found = cached.find(m => m.id === id);
        if (found) return { ...found, offline: true as const };
        throw new Error('No hay una copia descargada de este manifiesto.');
      };
      if (!navigator.onLine) return readOffline();
      try {
        return await manifiestoService.getById(id);
      } catch (err) {
        // Offline fallback: find in cached list
        if (!navigator.onLine) return readOffline();
        throw err;
      }
    },
    enabled: !!id,
  });
}

export function useManifiestoDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard(),
    queryFn: () => manifiestoService.dashboard(),
    staleTime: 60 * 1000,
  });
}

// Re-export all workflow mutations for backward compatibility
export {
  useCreateManifiesto,
  useUpdateManifiesto,
  useFirmarManifiesto,
  useConfirmarRetiro,
  useConfirmarEntrega,
  usePesaje,
  useConfirmarRecepcion,
  useConfirmarRecepcionInSitu,
  useRegistrarTratamiento,
  useRechazarManifiesto,
  useRegistrarIncidente,
  useCerrarManifiesto,
  useCancelarManifiesto,
  useRevertirEstado,
  useValidarQR,
} from './useManifiestoWorkflow';

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

const KEYS = {
  all: ['manifiestos'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (filters?: ManifiestoFilters) => [...KEYS.lists(), filters] as const,
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
  if (filters.limit) {
    result = result.slice(0, filters.limit);
  }
  return result;
}

export function useManifiestos(filters?: ManifiestoFilters, options?: { enabled?: boolean }) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: KEYS.list(filters),
    enabled: options?.enabled ?? true,
    staleTime: 60_000, // 1 min — avoids refetch on every focus/mount
    queryFn: async () => {
      try {
        return await manifiestoService.list(filters);
      } catch (err) {
        // Offline fallback: read from IndexedDB
        if (!navigator.onLine && currentUser?.id) {
          const cached = await getCachedManifiestos(currentUser.id);
          const filtered = applyClientFilters(cached, filters);
          return { items: filtered, total: filtered.length, page: 1, limit: filtered.length || 10, totalPages: 1 };
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
    queryFn: async () => {
      try {
        return await manifiestoService.getById(id);
      } catch (err) {
        // Offline fallback: find in cached list
        if (!navigator.onLine && currentUser?.id) {
          const cached = await getCachedManifiestos(currentUser.id);
          const found = cached.find(m => m.id === id);
          if (found) return found;
        }
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

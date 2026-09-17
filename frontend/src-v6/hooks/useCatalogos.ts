/**
 * SITREP v6 - Catalogos Hooks
 * With offline fallback via IndexedDB
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';
import { OFFLINE_CATALOG_KEYS, getOfflineCatalogKey, saveOffline, getOffline } from '../services/indexeddb';
import { useAuth } from '../contexts/AuthContext';
import type { TipoResiduo } from '../types/models';

const STALE_TIME = 10 * 60 * 1000; // 10 min cache for catalogos

/**
 * Fetches catalog data from API and caches to IndexedDB.
 * Falls back to IndexedDB when offline/API fails.
 */
async function fetchWithOfflineFallback<T>(
  key: typeof OFFLINE_CATALOG_KEYS[number],
  userId: string | number | undefined,
  fetcher: () => Promise<T>,
): Promise<T> {
  const scopedKey = userId == null ? null : getOfflineCatalogKey(userId, key);
  try {
    const data = await fetcher();
    // Cache only under the authenticated principal's key. Catalog responses
    // include actor and fleet data and must not survive into another account.
    if (scopedKey) {
      saveOffline('catalogos', { id: scopedKey, data, updatedAt: new Date().toISOString() }).catch(() => {});
    }
    return data;
  } catch (err) {
    // Without a principal, do not serve a persisted fallback from another
    // account after an authentication or connectivity failure.
    if (!scopedKey) throw err;
    const cached = await getOffline<{ data: T }>('catalogos', scopedKey).catch(() => null);
    if (cached?.data) return cached.data as T;
    throw err; // No cache available — propagate original error
  }
}

export function useTiposResiduo() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'tipos-residuo'],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', currentUser?.id, () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
    select: (data) => data.tiposResiduos,
  });
}

/** Returns tiposResiduos + server-side counts (manifiestosPorResiduo, operadoresPorResiduo) */
export function useTiposResiduoEnriched() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'tipos-residuo'],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', currentUser?.id, () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoGeneradores() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'generadores'],
    queryFn: () => fetchWithOfflineFallback('generadores', currentUser?.id, () => catalogoService.generadores()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoTransportistas() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'transportistas'],
    queryFn: () => fetchWithOfflineFallback('transportistas', currentUser?.id, () => catalogoService.transportistas()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoOperadores() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'operadores'],
    queryFn: () => fetchWithOfflineFallback('operadores', currentUser?.id, () => catalogoService.operadores()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoEntidadesExteriores(tipo?: 'TRANSPORTISTA' | 'OPERADOR') {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'entidades-exteriores', tipo],
    queryFn: () => catalogoService.entidadesExteriores(tipo),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoVehiculos() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'vehiculos'],
    queryFn: () => fetchWithOfflineFallback('vehiculos', currentUser?.id, () => catalogoService.vehiculos()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoChoferes() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'choferes'],
    queryFn: () => fetchWithOfflineFallback('choferes', currentUser?.id, () => catalogoService.choferes()),
    staleTime: STALE_TIME,
  });
}

// CRUD mutations for tipos-residuos
export function useCreateTipoResiduo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: Partial<TipoResiduo>) => catalogoService.createTipoResiduo(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogos', 'tipos-residuo'] }),
  });
}

export function useUpdateTipoResiduo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TipoResiduo> }) =>
      catalogoService.updateTipoResiduo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogos', 'tipos-residuo'] }),
  });
}

export function useDeleteTipoResiduo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogoService.deleteTipoResiduo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogos', 'tipos-residuo'] }),
  });
}

// List all tratamientos autorizados (admin)
export function useAllTratamientos() {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['catalogos', currentUser?.id, 'tratamientos'],
    queryFn: () => catalogoService.allTratamientos(),
  });
}

// CRUD mutations for tratamientos autorizados
export function useCreateTratamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: { operadorId: string; tipoResiduoId: string; metodo: string; descripcion?: string; capacidad?: number }) =>
      catalogoService.createTratamiento(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogos', 'tratamientos'] });
      qc.invalidateQueries({ queryKey: ['operadores'] });
    },
  });
}

export function useUpdateTratamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { metodo?: string; descripcion?: string; capacidad?: number; activo?: boolean } }) =>
      catalogoService.updateTratamiento(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogos', 'tratamientos'] });
      qc.invalidateQueries({ queryKey: ['operadores'] });
    },
  });
}

export function useDeleteTratamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogoService.deleteTratamiento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogos', 'tratamientos'] });
      qc.invalidateQueries({ queryKey: ['operadores'] });
    },
  });
}

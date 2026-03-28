/**
 * SITREP v6 - Catalogos Hooks
 * With offline fallback via IndexedDB
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';
import { saveOffline, getOffline } from '../services/indexeddb';
import type { TipoResiduo } from '../types/models';

const STALE_TIME = 10 * 60 * 1000; // 10 min cache for catalogos

/**
 * Fetches catalog data from API and caches to IndexedDB.
 * Falls back to IndexedDB when offline/API fails.
 */
async function fetchWithOfflineFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const data = await fetcher();
    // Cache to IndexedDB for offline use
    saveOffline('catalogos', { id: key, data, updatedAt: new Date().toISOString() }).catch(() => {});
    return data;
  } catch (err) {
    // Try IndexedDB fallback
    const cached = await getOffline('catalogos', key).catch(() => null);
    if (cached?.data) return cached.data as T;
    throw err; // No cache available — propagate original error
  }
}

export function useTiposResiduo() {
  return useQuery({
    queryKey: ['catalogos', 'tipos-residuo'],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
    select: (data) => data.tiposResiduos,
  });
}

/** Returns tiposResiduos + server-side counts (manifiestosPorResiduo, operadoresPorResiduo) */
export function useTiposResiduoEnriched() {
  return useQuery({
    queryKey: ['catalogos', 'tipos-residuo'],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoGeneradores() {
  return useQuery({
    queryKey: ['catalogos', 'generadores'],
    queryFn: () => fetchWithOfflineFallback('generadores', () => catalogoService.generadores()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoTransportistas() {
  return useQuery({
    queryKey: ['catalogos', 'transportistas'],
    queryFn: () => fetchWithOfflineFallback('transportistas', () => catalogoService.transportistas()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoOperadores() {
  return useQuery({
    queryKey: ['catalogos', 'operadores'],
    queryFn: () => fetchWithOfflineFallback('operadores', () => catalogoService.operadores()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoVehiculos() {
  return useQuery({
    queryKey: ['catalogos', 'vehiculos'],
    queryFn: () => fetchWithOfflineFallback('vehiculos', () => catalogoService.vehiculos()),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoChoferes() {
  return useQuery({
    queryKey: ['catalogos', 'choferes'],
    queryFn: () => fetchWithOfflineFallback('choferes', () => catalogoService.choferes()),
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
  return useQuery({
    queryKey: ['catalogos', 'tratamientos'],
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

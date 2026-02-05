/**
 * SITREP v6 - Catalogos Hooks
 * With offline fallback via IndexedDB
 */

import { useQuery } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';
import { saveOffline, getOffline } from '../services/indexeddb';

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

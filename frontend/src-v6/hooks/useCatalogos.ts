/**
 * SITREP v6 - Catalogos Hooks
 * With offline fallback via IndexedDB
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';
import { updateOffline, getOffline } from '../services/indexeddb';
import { supportRequestContext } from '../utils/supportSession';
import { useQueryOwner } from './useQueryOwner';
import type { TipoResiduo } from '../types/models';

const STALE_TIME = 10 * 60 * 1000; // 10 min cache for catalogos

type CatalogueCopy<T> = { id: string; owner: string; data: T; updatedAt: string };

/** Only a disconnected session can use its own downloaded catalogue.
 * An HTTP error must remain visible, especially permission failures. */
async function fetchWithOfflineFallback<T>(
  resource: string,
  owner: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const context = supportRequestContext();
  const key = 'context-v2:' + JSON.stringify([owner, resource]);
  const assertContext = () => {
    if (!owner || !context || supportRequestContext() !== context) {
      throw new Error('Cambió el contexto de la cuenta. Volvé a consultar.');
    }
  };
  if (!navigator.onLine) {
    assertContext();
    const cached = await getOffline<CatalogueCopy<T>>('catalogos', key);
    assertContext();
    if (navigator.onLine) return fetchWithOfflineFallback(resource, owner, fetcher);
    if (cached?.owner === owner && cached.data != null) return cached.data;
    throw new Error('No hay una copia descargada de este catálogo para tu actividad y sede. Reconectate para consultarlo.');
  }
  const data = await fetcher();
  assertContext();
  // A failed optional download must not hide a valid server response.
  await updateOffline<CatalogueCopy<T>>('catalogos', key, () => {
    assertContext();
    return { id: key, owner, data, updatedAt: new Date().toISOString() };
  }).catch(() => {});
  assertContext();
  return data;
}

export function useTiposResiduo() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['catalogos', 'tipos-residuo', owner],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', owner, () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
    select: (data) => data.tiposResiduos,
    enabled: Boolean(owner),
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

/** Returns tiposResiduos + server-side counts (manifiestosPorResiduo, operadoresPorResiduo) */
export function useTiposResiduoEnriched() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['catalogos', 'tipos-residuo', owner],
    queryFn: () => fetchWithOfflineFallback('tipos-residuo', owner, () => catalogoService.tiposResiduo()),
    staleTime: STALE_TIME,
    enabled: Boolean(owner),
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useCatalogoGeneradores(enabled = true) {
  const owner = useQueryOwner();
  return useQuery({
    enabled: Boolean(owner) && enabled,
    queryKey: ['catalogos', 'generadores', owner],
    queryFn: () => fetchWithOfflineFallback('generadores', owner, () => catalogoService.generadores()),
    staleTime: STALE_TIME,
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useCatalogoTransportistas(enabled = true) {
  const owner = useQueryOwner();
  return useQuery({
    enabled: Boolean(owner) && enabled,
    queryKey: ['catalogos', 'transportistas', owner],
    queryFn: () => fetchWithOfflineFallback('transportistas', owner, () => catalogoService.transportistas()),
    staleTime: STALE_TIME,
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useCatalogoOperadores(enabled = true) {
  const owner = useQueryOwner();
  return useQuery({
    enabled: Boolean(owner) && enabled,
    queryKey: ['catalogos', 'operadores', owner],
    queryFn: () => fetchWithOfflineFallback('operadores', owner, () => catalogoService.operadores()),
    staleTime: STALE_TIME,
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useCatalogoVehiculos() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['catalogos', 'vehiculos', owner],
    queryFn: () => fetchWithOfflineFallback('vehiculos', owner, () => catalogoService.vehiculos()),
    staleTime: STALE_TIME,
    enabled: Boolean(owner),
    networkMode: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useCatalogoChoferes() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['catalogos', 'choferes', owner],
    queryFn: () => fetchWithOfflineFallback('choferes', owner, () => catalogoService.choferes()),
    staleTime: STALE_TIME,
    enabled: Boolean(owner),
    networkMode: 'always',
    refetchOnReconnect: 'always',
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
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['catalogos', 'tratamientos', owner],
    queryFn: () => catalogoService.allTratamientos(),
    enabled: Boolean(owner),
    networkMode: 'always',
    refetchOnReconnect: 'always',
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

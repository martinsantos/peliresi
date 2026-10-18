import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { inspeccionService } from '../services/inspeccion.service';
import { getAllOffline, getOffline, saveOffline } from '../services/indexeddb';
import { isOfflineNetworkError } from '../services/offlineSession';
import type { PaginatedInspections } from '../services/inspeccion.service';
import { inspectionActor, inspectionTypeOf, type Inspection, type InspectionType } from '../types/inspection';
import type { InspectionActorType, InspectionState } from '../types/inspection';

export interface InspectionListResult extends PaginatedInspections { offline?: true }

type InspectionListParams = { estado?: InspectionState; tipoInspeccion?: InspectionType; tipoActor?: InspectionActorType; actorId?: string; search?: string; page?: number; limit?: number };

export function filterCachedInspections(inspections: Inspection[], params?: InspectionListParams): InspectionListResult {
  const search = params?.search?.trim().toLocaleLowerCase('es-AR') || '';
  const filtered = inspections.filter((inspection) => {
    const actor = inspectionActor(inspection);
    return (!params?.estado || inspection.estado === params.estado)
      && (!params?.tipoInspeccion || inspectionTypeOf(inspection) === params.tipoInspeccion)
      && (!params?.tipoActor || inspection.tipoActor === params.tipoActor)
      && (!params?.actorId || actor?.id === params.actorId)
      && (!search || [inspection.numero, inspection.numeroActa, actor?.razonSocial, actor?.cuit]
        .some((value) => value?.toLocaleLowerCase('es-AR').includes(search)));
  }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const page = Math.max(1, params?.page || 1);
  const limit = Math.max(1, params?.limit || 25);
  return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)), offline: true };
}

export function useInspections(params?: InspectionListParams) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: ['inspecciones', 'list', currentUser?.id, params],
    networkMode: 'always',
    enabled: Boolean(currentUser?.id),
    retry: 1,
    queryFn: async (): Promise<InspectionListResult> => {
      try { return await inspeccionService.list(params); }
      catch (error) {
        if (!currentUser?.id || !isOfflineNetworkError(error)) throw error;
        const cached = await getAllOffline<{ id: string; inspection: Inspection }>('inspection_cases').catch(() => null);
        if (!cached) throw error;
        const scope = `${currentUser.id}:`;
        return filterCachedInspections(cached.filter((entry) => entry.id.startsWith(scope) && entry.inspection?.id === entry.id.slice(scope.length)).map((entry) => entry.inspection), params);
      }
    },
    staleTime: 30_000,
  });
}

export function useInspection(id: string) {
  const { currentUser } = useAuth();
  const cacheKey = currentUser?.id && id ? `${currentUser.id}:${id}` : '';
  const [offlineCacheStatus, setOfflineCacheStatus] = useState({ cacheKey, problem: false });
  const cacheAttempt = useRef(0);
  const activeCacheKey = useRef(cacheKey);
  activeCacheKey.current = cacheKey;

  const query = useQuery({
    queryKey: ['inspecciones', 'detail', currentUser?.id, id],
    // Run the query even offline: its network-only catch reads the scoped
    // IndexedDB snapshot. React Query's default would pause before that catch.
    networkMode: 'always',
    queryFn: async () => {
      try {
        const inspection = await inspeccionService.get(id);
        const attempt = ++cacheAttempt.current;
        setOfflineCacheStatus({ cacheKey, problem: false });
        // A blocked IndexedDB upgrade must never hold an online dossier behind
        // the loading screen. The server copy is usable while the local backup
        // settles independently, and a failed backup is reported to the user.
        void saveOffline('inspection_cases', { id: cacheKey, inspection })
          .then(() => { if (activeCacheKey.current === cacheKey && cacheAttempt.current === attempt) setOfflineCacheStatus({ cacheKey, problem: false }); })
          .catch(() => { if (activeCacheKey.current === cacheKey && cacheAttempt.current === attempt) setOfflineCacheStatus({ cacheKey, problem: true }); });
        return inspection;
      } catch (error) {
        // A cached case is a connectivity fallback, never a replacement for an
        // explicit authorization, deletion, or server error response.
        if (!isAxiosError(error) || error.response || !['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')) {
          throw error;
        }
        const cached = await getOffline<{ inspection: Inspection }>('inspection_cases', cacheKey).catch(() => null);
        if (cached?.inspection) return cached.inspection;
        throw error;
      }
    },
    enabled: Boolean(id && cacheKey),
  });
  return { ...query, offlineCacheProblem: offlineCacheStatus.cacheKey === cacheKey && offlineCacheStatus.problem };
}

export function useInspectionMutation<TInput, TData = unknown>(
  mutationFn: (input: TInput) => Promise<TData>,
  inspectionId?: string,
) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      const refreshes = [queryClient.invalidateQueries({ queryKey: ['inspecciones', 'list'] }), queryClient.invalidateQueries({ queryKey: ['inspecciones', 'operaciones'] })];
      if (inspectionId) {
        // El detalle incluye el usuario para no mezclar datos al impersonar.
        // La clave anterior omitía ese segmento y nunca refrescaba el expediente activo.
        const detailKey = currentUser?.id
          ? ['inspecciones', 'detail', currentUser.id, inspectionId]
          : ['inspecciones', 'detail'];
        refreshes.push(queryClient.invalidateQueries({ queryKey: detailKey }));
      }
      await Promise.all(refreshes);
    },
  });
}

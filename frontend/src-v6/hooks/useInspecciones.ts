import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { inspeccionService } from '../services/inspeccion.service';
import { getAllOffline, getOffline, saveOffline } from '../services/indexeddb';
import { isOfflineNetworkError } from '../services/offlineSession';
import type { PaginatedInspections } from '../services/inspeccion.service';
import { inspectionActor, type Inspection } from '../types/inspection';
import type { InspectionActorType, InspectionState } from '../types/inspection';

export interface InspectionListResult extends PaginatedInspections { offline?: true }

type InspectionListParams = { estado?: InspectionState; tipoActor?: InspectionActorType; actorId?: string; search?: string; page?: number; limit?: number };

export function filterCachedInspections(inspections: Inspection[], params?: InspectionListParams): InspectionListResult {
  const search = params?.search?.trim().toLocaleLowerCase('es-AR') || '';
  const filtered = inspections.filter((inspection) => {
    const actor = inspectionActor(inspection);
    return (!params?.estado || inspection.estado === params.estado)
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

  return useQuery({
    queryKey: ['inspecciones', 'detail', currentUser?.id, id],
    // Run the query even offline: its network-only catch reads the scoped
    // IndexedDB snapshot. React Query's default would pause before that catch.
    networkMode: 'always',
    queryFn: async () => {
      try {
        const inspection = await inspeccionService.get(id);
        await saveOffline('inspection_cases', { id: cacheKey, inspection }).catch(() => undefined);
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
      const refreshes = [queryClient.invalidateQueries({ queryKey: ['inspecciones', 'list'] })];
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

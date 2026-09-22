import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { inspeccionService } from '../services/inspeccion.service';
import { getOffline, saveOffline } from '../services/indexeddb';
import type { Inspection } from '../types/inspection';
import type { InspectionActorType, InspectionState } from '../types/inspection';

export function useInspections(params?: { estado?: InspectionState; tipoActor?: InspectionActorType; actorId?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['inspecciones', 'list', params],
    queryFn: () => inspeccionService.list(params),
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

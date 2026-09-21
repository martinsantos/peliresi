import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    queryFn: async () => {
      try {
        const inspection = await inspeccionService.get(id);
        await saveOffline('inspection_cases', { id: cacheKey, inspection }).catch(() => undefined);
        return inspection;
      } catch (error) {
        const cached = await getOffline<{ inspection: Inspection }>('inspection_cases', cacheKey).catch(() => null);
        if (cached?.inspection) return cached.inspection;
        throw error;
      }
    },
    enabled: Boolean(id && cacheKey),
  });
}

export function useInspectionMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  inspectionId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      const refreshes = [queryClient.invalidateQueries({ queryKey: ['inspecciones', 'list'] })];
      if (inspectionId) refreshes.push(queryClient.invalidateQueries({ queryKey: ['inspecciones', 'detail', inspectionId] }));
      await Promise.all(refreshes);
    },
  });
}

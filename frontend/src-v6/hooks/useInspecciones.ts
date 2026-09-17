import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inspeccionService } from '../services/inspeccion.service';
import type { InspectionActorType, InspectionState } from '../types/inspection';

export function useInspections(params?: { estado?: InspectionState; tipoActor?: InspectionActorType; actorId?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['inspecciones', 'list', params],
    queryFn: () => inspeccionService.list(params),
    staleTime: 30_000,
  });
}

export function useInspection(id: string) {
  return useQuery({
    queryKey: ['inspecciones', 'detail', id],
    queryFn: () => inspeccionService.get(id),
    enabled: Boolean(id),
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

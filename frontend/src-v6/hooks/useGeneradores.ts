/**
 * SITREP v6 - Generador Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actoresService } from '../services/actores.service';
import type { ActorFilters, CreateGeneradorRequest } from '../types/api';

const KEYS = {
  generadores: (filters?: ActorFilters) => ['generadores', filters] as const,
  generador: (id: string) => ['generadores', id] as const,
};

export function useGeneradores(filters?: ActorFilters) {
  return useQuery({
    queryKey: KEYS.generadores(filters),
    queryFn: () => actoresService.listGeneradores(filters),
    staleTime: 60_000,
  });
}

export function useGenerador(id: string) {
  return useQuery({
    queryKey: KEYS.generador(id),
    queryFn: () => actoresService.getGenerador(id),
    enabled: !!id,
  });
}

export function useCreateGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateGeneradorRequest) => actoresService.createGenerador(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

export function useUpdateGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGeneradorRequest> }) =>
      actoresService.updateGenerador(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

export function useDeleteGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actoresService.deleteGenerador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

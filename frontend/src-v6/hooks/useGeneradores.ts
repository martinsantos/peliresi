import { useQueryOwner } from './useQueryOwner';
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
  const owner = useQueryOwner();
  return useQuery({
    queryKey: [...KEYS.generadores(filters), owner],
    queryFn: () => actoresService.listGeneradores(filters),
    staleTime: 60_000,
    enabled: Boolean(owner),
  });
}

export function useGenerador(id: string) {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: [...KEYS.generador(id), owner],
    queryFn: () => actoresService.getGenerador(id),
    enabled: Boolean(owner && id),
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

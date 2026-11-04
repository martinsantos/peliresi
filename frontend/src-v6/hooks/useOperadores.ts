import { useQueryOwner } from './useQueryOwner';
/**
 * SITREP v6 - Operador Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actoresService } from '../services/actores.service';
import type { ActorFilters, CreateOperadorRequest } from '../types/api';

const KEYS = {
  operadores: (filters?: ActorFilters) => ['operadores', filters] as const,
  operador: (id: string) => ['operadores', id] as const,
};

export function useOperadores(filters?: ActorFilters) {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: [...KEYS.operadores(filters), owner],
    queryFn: () => actoresService.listOperadores(filters),
    staleTime: 60_000,
    enabled: Boolean(owner),
  });
}

export function useOperador(id: string) {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: [...KEYS.operador(id), owner],
    queryFn: () => actoresService.getOperador(id),
    enabled: Boolean(owner && id),
  });
}

export function useCreateOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateOperadorRequest) => actoresService.createOperador(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

export function useUpdateOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateOperadorRequest> }) =>
      actoresService.updateOperador(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

export function useDeleteOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actoresService.deleteOperador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

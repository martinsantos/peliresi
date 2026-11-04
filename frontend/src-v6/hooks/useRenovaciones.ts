import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { renovacionService } from '../services/renovacion.service';
import type { RenovacionFilters, CreateRenovacionRequest } from '../types/api';
import { useAdmissionContext } from './useAdmissionContext';

const KEYS = {
  renovaciones: (filters?: RenovacionFilters) => ['renovaciones', filters] as const,
  renovacion: (id: string) => ['renovaciones', id] as const,
};

export function useRenovaciones(filters?: RenovacionFilters) {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.renovaciones(filters), owner],
    queryFn: () => renovacionService.list(filters),
    enabled: ready,
  });
}

export function useRenovacion(id: string) {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.renovacion(id), owner],
    queryFn: () => renovacionService.getById(id),
    enabled: !!id && ready,
    staleTime: 0,
  });
}

export function useCreateRenovacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateRenovacionRequest) => renovacionService.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['renovaciones'] }),
  });
}

export function useAprobarRenovacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, observaciones }: { id: string; observaciones?: string }) =>
      renovacionService.aprobar(id, observaciones),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['renovaciones'] }),
  });
}

export function useRechazarRenovacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivoRechazo, observaciones }: { id: string; motivoRechazo: string; observaciones?: string }) =>
      renovacionService.rechazar(id, motivoRechazo, observaciones),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['renovaciones'] }),
  });
}

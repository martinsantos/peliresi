import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { renovacionService } from '../services/renovacion.service';
import type { RenovacionFilters, CreateRenovacionRequest } from '../types/api';

const KEYS = {
  renovaciones: (filters?: RenovacionFilters) => ['renovaciones', filters] as const,
  renovacion: (id: string) => ['renovaciones', id] as const,
};

export function useRenovaciones(filters?: RenovacionFilters) {
  return useQuery({
    queryKey: KEYS.renovaciones(filters),
    queryFn: () => renovacionService.list(filters),
  });
}

export function useRenovacion(id: string) {
  return useQuery({
    queryKey: KEYS.renovacion(id),
    queryFn: () => renovacionService.getById(id),
    enabled: !!id,
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

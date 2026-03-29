/**
 * SITREP v6 - Alertas Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertaService } from '../services/alerta.service';
import type { AlertaFilters, CreateReglaAlertaRequest } from '../types/api';

const KEYS = {
  reglas: ['alertas', 'reglas'] as const,
  alertas: (filters?: AlertaFilters) => ['alertas', 'list', filters] as const,
  anomalias: (manifiestoId?: string) => ['alertas', 'anomalias', manifiestoId] as const,
};

export function useReglasAlerta() {
  return useQuery({
    queryKey: KEYS.reglas,
    queryFn: () => alertaService.listReglas(),
    staleTime: 60_000,
  });
}

export function useCreateReglaAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateReglaAlertaRequest) => alertaService.createRegla(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.reglas }),
  });
}

export function useAlertas(filters?: AlertaFilters, enabled = true) {
  return useQuery({
    queryKey: KEYS.alertas(filters),
    queryFn: () => alertaService.listAlertas(filters),
    staleTime: 30_000,
    enabled,
  });
}

export function useResolverAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      alertaService.resolverAlerta(id, notas),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  });
}

export function useUpdateReglaAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateReglaAlertaRequest & { activa: boolean }> }) =>
      alertaService.updateRegla(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.reglas }),
  });
}

export function useDeleteReglaAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertaService.deleteRegla(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.reglas }),
  });
}

export function useAnomalias(manifiestoId?: string) {
  return useQuery({
    queryKey: KEYS.anomalias(manifiestoId),
    queryFn: () => alertaService.listAnomalias(manifiestoId),
    staleTime: 60_000,
  });
}

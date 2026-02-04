/**
 * SITREP v6 - Manifiestos Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';
import type {
  ManifiestoFilters, CreateManifiestoRequest, FirmarManifiestoRequest,
  ConfirmarRetiroRequest, ConfirmarEntregaRequest, PesajeRequest,
  ConfirmarRecepcionRequest, RegistrarTratamientoRequest,
  RechazarManifiestoRequest, RegistrarIncidenteRequest,
} from '../types/api';

const KEYS = {
  all: ['manifiestos'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (filters?: ManifiestoFilters) => [...KEYS.lists(), filters] as const,
  detail: (id: string) => [...KEYS.all, 'detail', id] as const,
  dashboard: () => [...KEYS.all, 'dashboard'] as const,
};

export function useManifiestos(filters?: ManifiestoFilters) {
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => manifiestoService.list(filters),
  });
}

export function useManifiesto(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => manifiestoService.getById(id),
    enabled: !!id,
  });
}

export function useManifiestoDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard(),
    queryFn: () => manifiestoService.dashboard(),
    staleTime: 60 * 1000,
  });
}

export function useCreateManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateManifiestoRequest) => manifiestoService.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.lists() }),
  });
}

export function useUpdateManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & Partial<CreateManifiestoRequest>) =>
      manifiestoService.update(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useFirmarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & FirmarManifiestoRequest) =>
      manifiestoService.firmar(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useConfirmarRetiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarRetiroRequest) =>
      manifiestoService.confirmarRetiro(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useConfirmarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarEntregaRequest) =>
      manifiestoService.confirmarEntrega(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function usePesaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & PesajeRequest) =>
      manifiestoService.pesaje(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useConfirmarRecepcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarRecepcionRequest) =>
      manifiestoService.confirmarRecepcion(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRegistrarTratamiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & RegistrarTratamientoRequest) =>
      manifiestoService.registrarTratamiento(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRechazarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & RechazarManifiestoRequest) =>
      manifiestoService.rechazar(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRegistrarIncidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: { id: string } & RegistrarIncidenteRequest) =>
      manifiestoService.registrarIncidente(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useCerrarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => manifiestoService.cerrar(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRevertirEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estadoNuevo, motivo }: { id: string; estadoNuevo: string; motivo?: string }) =>
      manifiestoService.revertirEstado(id, estadoNuevo, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useValidarQR() {
  return useMutation({
    mutationFn: (code: string) => manifiestoService.validarQR(code),
  });
}

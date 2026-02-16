/**
 * SITREP v6 - Manifiestos Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';
import { getCachedManifiestos } from '../services/offline-sync';
import { useAuth } from '../contexts/AuthContext';
import type {
  ManifiestoFilters, CreateManifiestoRequest, FirmarManifiestoRequest,
  ConfirmarRetiroRequest, ConfirmarEntregaRequest, PesajeRequest,
  ConfirmarRecepcionRequest, RegistrarTratamientoRequest,
  RechazarManifiestoRequest, RegistrarIncidenteRequest,
} from '../types/api';
import type { Manifiesto } from '../types/models';

const KEYS = {
  all: ['manifiestos'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (filters?: ManifiestoFilters) => [...KEYS.lists(), filters] as const,
  detail: (id: string) => [...KEYS.all, 'detail', id] as const,
  dashboard: () => [...KEYS.all, 'dashboard'] as const,
};

/** Apply filters client-side on cached data */
function applyClientFilters(items: Manifiesto[], filters?: ManifiestoFilters): Manifiesto[] {
  if (!filters) return items;
  let result = items;
  if (filters.estado) {
    result = result.filter(m => m.estado === filters.estado);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(m =>
      m.numero?.toLowerCase().includes(q) ||
      (m as any).generador?.razonSocial?.toLowerCase().includes(q)
    );
  }
  if (filters.limit) {
    result = result.slice(0, filters.limit);
  }
  return result;
}

export function useManifiestos(filters?: ManifiestoFilters) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: async () => {
      try {
        return await manifiestoService.list(filters);
      } catch (err) {
        // Offline fallback: read from IndexedDB
        if (!navigator.onLine && currentUser?.id) {
          const cached = await getCachedManifiestos(currentUser.id);
          const filtered = applyClientFilters(cached, filters);
          return { items: filtered, total: filtered.length, page: 1, limit: filtered.length || 10, totalPages: 1 };
        }
        throw err;
      }
    },
  });
}

export function useManifiesto(id: string) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      try {
        return await manifiestoService.getById(id);
      } catch (err) {
        // Offline fallback: find in cached list
        if (!navigator.onLine && currentUser?.id) {
          const cached = await getCachedManifiestos(currentUser.id);
          const found = cached.find(m => m.id === id);
          if (found) return found;
        }
        throw err;
      }
    },
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

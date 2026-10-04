/**
 * SITREP v6 - Notificaciones Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacionService } from '../services/notificacion.service';
import { getAccessToken } from '../services/api';
import type { NotificacionFilters } from '../types/api';

const KEYS = {
  all: ['notificaciones'] as const,
  list: (filters?: NotificacionFilters) => [...KEYS.all, 'list', filters] as const,
  noLeidas: () => [...KEYS.all, 'no-leidas'] as const,
};

export function useNotificaciones(filters?: NotificacionFilters) {
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => notificacionService.list(filters),
    // Returning from a workflow must recheck its state, even within the global
    // one-minute cache window. Offline still retains the last available record.
    staleTime: 0,
  });
}

export function useNotificacionesNoLeidas() {
  const hasToken = !!getAccessToken();
  return useQuery({
    queryKey: KEYS.noLeidas(),
    queryFn: () => notificacionService.getNoLeidas(),
    refetchInterval: hasToken ? 30_000 : false,
    enabled: hasToken,
  });
}

export function useMarcarLeida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificacionService.marcarLeida(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificacionService.marcarTodasLeidas(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useEliminarNotificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificacionService.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

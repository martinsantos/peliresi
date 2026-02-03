/**
 * SITREP v6 - Notificaciones Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacionService } from '../services/notificacion.service';
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
  });
}

export function useNotificacionesNoLeidas() {
  return useQuery({
    queryKey: KEYS.noLeidas(),
    queryFn: () => notificacionService.getNoLeidas(),
    refetchInterval: 30 * 1000,
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

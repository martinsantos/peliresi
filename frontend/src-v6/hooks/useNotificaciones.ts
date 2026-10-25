/**
 * SITREP v6 - Notificaciones Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacionService } from '../services/notificacion.service';
import { getAccessToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { NotificacionFilters } from '../types/api';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';

const KEYS = {
  all: ['notificaciones'] as const,
  list: (owner: string, filters?: NotificacionFilters) => [...KEYS.all, 'list', owner, filters] as const,
  noLeidas: (owner: string) => [...KEYS.all, 'no-leidas', owner] as const,
};

export function useNotificaciones(filters?: NotificacionFilters) {
  const { currentUser, isRestricted } = useAuth();
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  return useQuery({
    queryKey: KEYS.list(owner, filters),
    queryFn: () => notificacionService.list(filters),
    enabled: !!owner,
    // Returning from a workflow must recheck its state, even within the global
    // one-minute cache window. Offline still retains the last available record.
    staleTime: 0,
  });
}

export function useNotificacionesNoLeidas() {
  const { currentUser, isRestricted } = useAuth();
  const hasToken = !!getAccessToken() && !!currentUser && !isRestricted;
  const owner = isRestricted ? '' : inspectionWorkspaceOwner(currentUser);
  return useQuery({
    queryKey: KEYS.noLeidas(owner),
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

import { useQueryOwner } from './useQueryOwner';
/**
 * SITREP v6 - Dashboard Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function useDashboardStats() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['dashboard', 'stats', owner],
    enabled: Boolean(owner),
    queryFn: () => analyticsService.getDashboardStats(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useManifiestosPorMes() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['dashboard', 'manifiestos-por-mes', owner],
    queryFn: () => analyticsService.getManifiestosPorMes(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(owner),
  });
}

export function useResiduosPorTipo() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['dashboard', 'residuos-por-tipo', owner],
    queryFn: () => analyticsService.getResiduosPorTipo(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(owner),
  });
}

export function useManifiestosPorEstado() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['dashboard', 'manifiestos-por-estado', owner],
    queryFn: () => analyticsService.getManifiestosPorEstado(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(owner),
  });
}

export function useTiempoPromedioPorEtapa() {
  const owner = useQueryOwner();
  return useQuery({
    queryKey: ['dashboard', 'tiempo-promedio', owner],
    queryFn: () => analyticsService.getTiempoPromedioPorEtapa(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(owner),
  });
}

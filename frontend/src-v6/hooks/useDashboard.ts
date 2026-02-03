/**
 * SITREP v6 - Dashboard Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => analyticsService.getDashboardStats(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useManifiestosPorMes() {
  return useQuery({
    queryKey: ['dashboard', 'manifiestos-por-mes'],
    queryFn: () => analyticsService.getManifiestosPorMes(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useResiduosPorTipo() {
  return useQuery({
    queryKey: ['dashboard', 'residuos-por-tipo'],
    queryFn: () => analyticsService.getResiduosPorTipo(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useManifiestosPorEstado() {
  return useQuery({
    queryKey: ['dashboard', 'manifiestos-por-estado'],
    queryFn: () => analyticsService.getManifiestosPorEstado(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useTiempoPromedioPorEtapa() {
  return useQuery({
    queryKey: ['dashboard', 'tiempo-promedio'],
    queryFn: () => analyticsService.getTiempoPromedioPorEtapa(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

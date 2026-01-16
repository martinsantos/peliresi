/**
 * useDashboardStats - Hook compartido para WEB y APP
 * OPTIMIZADO: Usa React Query para caché y deduplicación
 *
 * Centraliza la carga de estadísticas del dashboard desde el backend.
 * Usado por Dashboard.tsx (WEB) y MobileApp.tsx (APP) para garantizar
 * que ambas plataformas muestren la misma información.
 *
 * Endpoint: /api/manifiestos/dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { manifiestoService } from '../services/manifiesto.service';
import { queryKeys } from '../lib/queryClient';
import type { DashboardStats, Manifiesto } from '../types';

interface UseDashboardStatsOptions {
  /** Auto-refresh interval in ms (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: false with React Query) */
  autoRefresh?: boolean;
}

interface UseDashboardStatsResult {
  /** Stats from backend - estadisticas object */
  stats: DashboardStats['estadisticas'] | null;
  /** List of recent manifiestos */
  recientes: Manifiesto[];
  /** List of manifiestos en transito */
  enTransitoList: Manifiesto[];
  /** Full dashboard data */
  fullData: DashboardStats | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Last update timestamp */
  lastUpdated: Date | null;
}

const DEFAULT_OPTIONS: UseDashboardStatsOptions = {
  refreshInterval: 30000,
  autoRefresh: false, // React Query maneja el caché inteligentemente
};

export function useDashboardStats(
  role: string | undefined,
  isOnline: boolean = true,
  options: UseDashboardStatsOptions = {}
): UseDashboardStatsResult {
  const { refreshInterval, autoRefresh } = { ...DEFAULT_OPTIONS, ...options };

  const {
    data,
    isLoading,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: queryKeys.dashboardStats(role || 'unknown'),
    queryFn: async () => {
      const result = await manifiestoService.getDashboard();
      console.log('[useDashboardStats] Stats loaded via React Query:', result?.estadisticas);
      return result;
    },
    // Solo fetch si hay rol y estamos online
    enabled: !!role && isOnline,
    // Datos frescos por 30 segundos (reduce requests duplicados)
    staleTime: 30 * 1000,
    // Mantener en caché 5 minutos
    gcTime: 5 * 60 * 1000,
    // Auto-refresh solo si está habilitado explícitamente
    refetchInterval: autoRefresh ? refreshInterval : false,
    // No refetch automático al enfocar ventana
    refetchOnWindowFocus: false,
    // Reintentos con backoff
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Función de refresh manual
  const refresh = async () => {
    await refetch();
  };

  return {
    stats: data?.estadisticas || null,
    recientes: data?.recientes || [],
    enTransitoList: data?.enTransitoList || [],
    fullData: data || null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}

export default useDashboardStats;

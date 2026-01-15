/**
 * useDashboardStats - Hook compartido para WEB y APP
 *
 * Centraliza la carga de estadísticas del dashboard desde el backend.
 * Usado por Dashboard.tsx (WEB) y MobileApp.tsx (APP) para garantizar
 * que ambas plataformas muestren la misma información.
 *
 * Endpoint: /api/manifiestos/dashboard
 * Auto-refresh: cada 30 segundos
 */

import { useState, useEffect, useCallback } from 'react';
import { manifiestoService } from '../services/manifiesto.service';
import type { DashboardStats, Manifiesto } from '../types';

interface UseDashboardStatsOptions {
  /** Auto-refresh interval in ms (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: true) */
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
  autoRefresh: true,
};

export function useDashboardStats(
  role: string | undefined,
  isOnline: boolean = true,
  options: UseDashboardStatsOptions = {}
): UseDashboardStatsResult {
  const { refreshInterval, autoRefresh } = { ...DEFAULT_OPTIONS, ...options };

  const [stats, setStats] = useState<DashboardStats['estadisticas'] | null>(null);
  const [recientes, setRecientes] = useState<Manifiesto[]>([]);
  const [enTransitoList, setEnTransitoList] = useState<Manifiesto[]>([]);
  const [fullData, setFullData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    // Skip if no role or offline
    if (!role) {
      setLoading(false);
      return;
    }

    if (!isOnline) {
      console.log('[useDashboardStats] Offline - skipping fetch');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await manifiestoService.getDashboard();

      if (data) {
        setFullData(data);
        setStats(data.estadisticas || null);
        setRecientes(data.recientes || []);
        setEnTransitoList(data.enTransitoList || []);
        setLastUpdated(new Date());
        console.log('[useDashboardStats] Stats loaded:', data.estadisticas);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Error cargando estadísticas';
      console.error('[useDashboardStats] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [role, isOnline]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !isOnline || !role) return;

    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStats, isOnline, role]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && role && !loading) {
      fetchStats();
    }
  }, [isOnline]);

  return {
    stats,
    recientes,
    enTransitoList,
    fullData,
    loading,
    error,
    refresh: fetchStats,
    lastUpdated,
  };
}

export default useDashboardStats;

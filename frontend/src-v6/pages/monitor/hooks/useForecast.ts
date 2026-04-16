/**
 * useForecast — FORECAST mode data fetching (self-contained)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchForecast, type ForecastResponse } from '../api/monitor-api';

export function useForecast(dias = 7, enabled = true) {
  return useQuery<ForecastResponse>({
    queryKey: ['monitor-forecast', dias],
    queryFn: () => fetchForecast(dias),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

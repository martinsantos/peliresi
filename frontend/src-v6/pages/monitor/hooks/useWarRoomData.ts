/**
 * useWarRoomData — LIVE mode data fetching (self-contained)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchMonitorLive, type MonitorLiveResponse } from '../api/monitor-api';

export function useWarRoomData(enabled = true) {
  return useQuery<MonitorLiveResponse>({
    queryKey: ['monitor-live'],
    queryFn: fetchMonitorLive,
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled,
  });
}

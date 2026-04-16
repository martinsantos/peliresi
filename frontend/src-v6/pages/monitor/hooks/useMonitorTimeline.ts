/**
 * useMonitorTimeline — PLAYBACK mode data fetching (self-contained)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTimeline, type TimelineResponse } from '../api/monitor-api';

export function useMonitorTimeline(fecha: string | null, dias = 1) {
  return useQuery<TimelineResponse>({
    queryKey: ['monitor-timeline', fecha, dias],
    queryFn: () => fetchTimeline(fecha!, dias),
    enabled: !!fecha,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

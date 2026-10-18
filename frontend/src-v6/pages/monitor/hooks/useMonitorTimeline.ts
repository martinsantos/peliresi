/**
 * useMonitorTimeline — PLAYBACK mode data fetching (self-contained)
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTimeline, type TimelineResponse } from '../api/monitor-api';

export function useMonitorTimeline(fecha: string | null, dias = 1, enabled = true) {
  return useQuery<TimelineResponse>({
    queryKey: ['monitor-timeline', fecha, dias],
    queryFn: ({ signal }) => fetchTimeline(fecha!, dias, signal),
    enabled: enabled && !!fecha,
    retry: false, // Explicit retry avoids repeatedly allocating a rejected large period.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/**
 * Timeline Engine — Pure functions for PLAYBACK mode (Fase 5)
 * GPS interpolation, timeline building, event processing
 */

import type { TimelineEvent } from '../api/monitor-api';

/** Interpolate position between two GPS points */
export function interpolatePosition(
  prev: { lat: number; lng: number; time: number },
  next: { lat: number; lng: number; time: number },
  currentTime: number,
): { lat: number; lng: number } {
  if (next.time === prev.time) return { lat: prev.lat, lng: prev.lng };
  const t = Math.max(0, Math.min(1, (currentTime - prev.time) / (next.time - prev.time)));
  return {
    lat: prev.lat + (next.lat - prev.lat) * t,
    lng: prev.lng + (next.lng - prev.lng) * t,
  };
}

/** Build sorted timeline with unix timestamps */
export function buildTimeline(events: TimelineEvent[]): Array<TimelineEvent & { unixMs: number }> {
  return events
    .map(e => ({ ...e, unixMs: new Date(e.timestamp).getTime() }))
    .sort((a, b) => a.unixMs - b.unixMs);
}

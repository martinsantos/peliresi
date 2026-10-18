import { computeDateRange } from '../../../utils/date-presets';

export function periodEnd(start: string, days: number): string {
  return new Date(new Date(start + 'T00:00:00Z').getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);
}
export function recentPeriod(days: number, now = new Date()): string {
  return computeDateRange(days, now).desde;
}

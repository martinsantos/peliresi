import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeDateRange } from '../../utils/date-presets';
import { periodEnd, recentPeriod } from '../../pages/monitor/utils/playback-period';

afterEach(() => vi.useRealTimers());

describe('Operational presets are inclusive Mendoza calendar periods', () => {
  it('keeps Ver Todos unfiltered', () => {
    expect(computeDateRange(0)).toEqual({ desde: '', hasta: '' });
  });

  it.each([1, 3, 7, 15, 30])('%i days include today once, not an extra day', days => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    const range = computeDateRange(days);
    expect(range.hasta).toBe('2026-10-05');
    expect(range.desde).toBe(recentPeriod(days));
    expect(periodEnd(range.desde, days)).toBe(range.hasta);
  });

  it('uses the Mendoza day when UTC has already changed year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T01:00:00Z'));
    expect(computeDateRange(1)).toEqual({ desde: '2026-12-31', hasta: '2026-12-31' });
    expect(computeDateRange(7)).toEqual({ desde: '2026-12-25', hasta: '2026-12-31' });
  });

  it('does calendar arithmetic across leap February', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-03-01T12:00:00Z'));
    expect(computeDateRange(3)).toEqual({ desde: '2028-02-28', hasta: '2028-03-01' });
  });
});

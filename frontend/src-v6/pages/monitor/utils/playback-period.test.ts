import { expect, it } from 'vitest';
import { recentPeriod, periodEnd } from './playback-period';
it('last 30 days include today exactly once, across a month boundary', () => {
  const start = recentPeriod(30, new Date('2026-10-04T12:00:00Z'));
  expect(start).toBe('2026-09-05'); expect(periodEnd(start, 30)).toBe('2026-10-04');
});
it('uses Mendoza calendar even when UTC has already changed year', () => {
  const start = recentPeriod(7, new Date('2027-01-01T01:00:00Z'));
  expect(start).toBe('2026-12-25'); expect(periodEnd(start, 7)).toBe('2026-12-31');
});
it('one day and leap February retain exact boundaries', () => {
  expect(periodEnd('2028-02-28', 1)).toBe('2028-02-28');
  expect(periodEnd('2028-02-28', 3)).toBe('2028-03-01');
});

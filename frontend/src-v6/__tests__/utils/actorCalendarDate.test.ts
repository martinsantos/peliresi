import { expect, it } from 'vitest';
import { formatActorCalendarDate, formatActorEventDate } from '../../utils/actorCalendarDate';

it.each(['2030-01-01', '2030-01-01T00:00:00.000Z', new Date('2030-01-01T00:00:00.000Z')])('preserves date-only expiry %s instead of the previous Mendoza day', value => {
  expect(formatActorCalendarDate(value)).toBe('01/01/2030');
});
it.each([
  ['2026-10-01T02:00:00.000Z', '30/09/2026'],
  ['2026-10-01T03:00:00.000Z', '01/10/2026'],
  ['2026-10-01T00:00:00-03:00', '01/10/2026'],
  [new Date('2026-10-01T12:00:00Z'), '01/10/2026'],
  [null, '—'], [undefined, '—'], ['invalid', '—'],
])('shows audit instant %s in the Mendoza business day', (value, result) => {
  expect(formatActorEventDate(value)).toBe(result);
});
it.each([null, undefined, '', 'invalid'])('does not invent an expiry for %j', value => {
  expect(formatActorCalendarDate(value)).toBe('—');
});

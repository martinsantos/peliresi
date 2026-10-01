import { expect, it } from 'vitest';
import { formatActorCalendarDate } from '../../utils/actorCalendarDate';

it.each(['2030-01-01', '2030-01-01T00:00:00.000Z', new Date('2030-01-01T00:00:00.000Z')])('preserves date-only expiry %s instead of the previous Mendoza day', value => {
  expect(formatActorCalendarDate(value)).toBe('01/01/2030');
});
it.each([null, undefined, '', 'invalid'])('does not invent an expiry for %j', value => {
  expect(formatActorCalendarDate(value)).toBe('—');
});

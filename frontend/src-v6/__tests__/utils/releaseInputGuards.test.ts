import { expect, it } from 'vitest';
import { hasAsciiControlCharacters } from '../../utils/controlCharacters';
import { httpErrorStatus } from '../../utils/httpErrorStatus';

it('rejects all ASCII control characters before URL normalization without rejecting readable text', () => {
  for (let code = 0; code < 32; code++) expect(hasAsciiControlCharacters('/actores/' + String.fromCharCode(code) + 'id')).toBe(true);
  for (const value of ['/actores/id?nombre=Peña', 'https://example.test', '', String.fromCharCode(127)]) expect(hasAsciiControlCharacters(value)).toBe(false);
});
it('reads structured HTTP statuses and safely ignores unknown failures', () => {
  expect(httpErrorStatus({ response: { status: 409 } })).toBe(409);
  expect(httpErrorStatus(Object.assign(new Error('Revoked'), { status: 403 }))).toBe(403);
  for (const value of [null, undefined, 'fail', new Error('offline'), { response: null }, { response: { status: '409' } }]) expect(httpErrorStatus(value)).toBeUndefined();
});

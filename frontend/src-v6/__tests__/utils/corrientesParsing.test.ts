import { describe, expect, it } from 'vitest';
import { parseCorrientes } from '../../data/corrientes-y';
describe('corrientes from saved fichas survive edit and draft recovery', () => {
  it.each(['Y8, Y9', 'Y8/Y9', 'Y8;Y9', 'Y8-Y9', 'y8 / y9', 'Y8 Y9', 'Y8,Y8,Y9'])('parses %s without combining or dropping a corriente', value => {
    expect(parseCorrientes(value)).toEqual(['Y8', 'Y9']);
  });
  it('keeps an explicit cleared value empty', () => expect(parseCorrientes('')).toEqual([]));
});

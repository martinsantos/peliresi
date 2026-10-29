import { expect, test } from 'vitest';
import { MANIFIESTO_DETAIL_INCLUDE } from '../../utils/manifiestoIncludes';

test('the manifest detail takes at most 100 GPS positions in a deterministic reception order', () => {
  expect(MANIFIESTO_DETAIL_INCLUDE.tracking).toEqual({ take: 100,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }] });
});

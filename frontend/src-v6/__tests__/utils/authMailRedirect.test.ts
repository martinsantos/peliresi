import { expect, it } from 'vitest';
import { safeLocalRedirect } from '../../utils/authRedirect';
it.each(['//outside.invalid', '/\\outside.invalid', '/%2foutside.invalid', '/%5coutside.invalid', '/\noutside.invalid', 'https://outside.invalid', 'javascript:alert(1)', null])('rejects unsafe email continuation %s', value => {
  expect(safeLocalRedirect(value, '/mi-solicitud')).toBe('/mi-solicitud');
});
it('preserves a safe local destination including query and anchor', () => {
  expect(safeLocalRedirect('/inscripcion/generador?paso=2#datos')).toBe('/inscripcion/generador?paso=2#datos');
});

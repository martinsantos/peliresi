import { describe, expect, it } from 'vitest';
import { manifestListReturn } from '../../utils/manifestListReturn';

describe('manifest list return context', () => {
  it('retains search, phase, dates, actors and sorting on the same surface', () => {
    const target = '/manifiestos?q=QA&fase=active&fechaDesde=2026-10-01&generadorId=g&sortBy=numero&sortOrder=asc';
    expect(manifestListReturn({ manifestListReturn: target }, '/manifiestos')).toBe(target);
    expect(manifestListReturn({ manifestListReturn: '/mobile/manifiestos?estado=TRATADO' }, '/mobile/manifiestos')).toBe('/mobile/manifiestos?estado=TRATADO');
  });
  it('rejects outside destinations, malformed state and other surfaces', () => {
    for (const target of ['https://other.invalid/manifiestos', '//other.invalid/manifiestos', '/login', '/app/manifiestos', 'javascript:alert(1)', 123, null]) {
      expect(manifestListReturn({ manifestListReturn: target }, '/manifiestos')).toBe('/manifiestos');
    }
    expect(manifestListReturn(null, '/manifiestos')).toBe('/manifiestos');
  });
});

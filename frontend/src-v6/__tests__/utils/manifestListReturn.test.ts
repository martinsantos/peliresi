import { describe, expect, it } from 'vitest';
import { manifestListReturn, manifestWorkspaceReturn, previousManifestReturn } from '../../utils/manifestListReturn';

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

it.each(['', '/mobile', '/app'])('only restores a same-surface previous manifest on %s', prefix => {
  const list = prefix + '/manifiestos';
  expect(previousManifestReturn({ manifestPreviousId: 'cm-qa_123' }, list)).toBe(list + '/cm-qa_123');
  for (const invalid of ['', '../dashboard', 'a/b', '//other.invalid', 'a?x=1', 'a#x', 'nuevo', 'NUEVO', 'baja-intensidad', 'a'.repeat(129), 123, null]) {
    expect(previousManifestReturn({ manifestPreviousId: invalid }, list)).toBeNull();
  }
  expect(previousManifestReturn(null, list)).toBeNull();
});

it.each(['','/mobile','/app'])('returns to the explicit home origin or the filtered list on %s',prefix=>{
 expect(manifestWorkspaceReturn({manifestHomeReturn:prefix+'/dashboard'},prefix+'/manifiestos')).toEqual({path:prefix+'/dashboard',label:'Inicio'});
 expect(manifestWorkspaceReturn({manifestListReturn:prefix+'/manifiestos?vista=programados&programado=QA'},prefix+'/manifiestos')).toEqual({path:prefix+'/manifiestos?vista=programados&programado=QA',label:'Manifiestos'});
 for(const invalid of ['https://other.invalid/dashboard','/admin/usuarios','/dashboard/other','//other.invalid/dashboard'])
 expect(manifestWorkspaceReturn({manifestHomeReturn:invalid},prefix+'/manifiestos')).toEqual({path:prefix+'/manifiestos',label:'Manifiestos'});
});

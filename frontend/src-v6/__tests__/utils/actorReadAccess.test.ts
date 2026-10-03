import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import { actorDetailFromPath, actorReturnPath, canReadActorDetail, canReadActorInspectionHistory, actorInspectionAccess } from '../../utils/actorReadAccess';

const types = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const;
test('four administrators consult three categories without a sector coincidence', () => {
  for (const rol of ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] as const) {
    for (const type of types) assert.equal(canReadActorDetail({ rol }, type, 'actor-2'), true);
  }
});
test('inspector consultation and ordinary actor identity remain separate', () => {
  for (const type of types) {
    assert.equal(canReadActorDetail({ rol: 'GENERADOR', esInspector: true }, type, 'actor-2'), true);
    assert.equal(canReadActorDetail({ rol: type, actorId: 'actor-1' }, type, 'actor-1'), true);
    assert.equal(canReadActorDetail({ rol: type, actorId: 'actor-1' }, type, 'actor-2'), false);
    assert.equal(canReadActorDetail({ rol: type }, type, 'actor-1'), false);
    assert.equal(canReadActorDetail({ rol: 'AUDITOR' }, type, 'actor-1'), false);
    for (const other of types.filter(candidate => candidate !== type)) {
      assert.equal(canReadActorDetail({ rol: other, actorId: 'actor-1' }, type, 'actor-1'), false);
    }
  }
});
test('anonymous and empty identifiers never produce a readable ficha', () => {
  for (const type of types) {
    assert.equal(canReadActorDetail(null, type, 'actor-1'), false);
    assert.equal(canReadActorDetail({ rol: 'ADMIN' }, type, ''), false);
    assert.equal(canReadActorDetail({ rol: 'ADMIN' }, type, '  '), false);
  }
});
test('canonical web, responsive and legacy app detail screens share the exact identity', () => {
  for (const [plural, type] of [['generadores', 'GENERADOR'], ['transportistas', 'TRANSPORTISTA'], ['operadores', 'OPERADOR']] as const) {
    for (const prefix of ['/admin/actores', '/mobile/admin/actores', '/actores']) {
      assert.deepEqual(actorDetailFromPath(`${prefix}/${plural}/actor-1`), { type, id: 'actor-1' });
    }
  }
  assert.deepEqual(actorDetailFromPath('/admin/generadores/actor-1'), { type: 'GENERADOR', id: 'actor-1' });
  assert.deepEqual(actorDetailFromPath('/admin/operadores/actor-1'), { type: 'OPERADOR', id: 'actor-1' });
});
test('lists, new, editor, renewal and malformed paths cannot inherit consultation access', () => {
  for (const path of ['/admin/actores/generadores', '/admin/actores/generadores/nuevo',
    '/admin/actores/operadores/actor-1/editar', '/admin/actores/generadores/actor-1/renovar',
    '/admin/actores/operadores/%', '/admin/actores/operadores/actor%2fedit', '/admin/actores/operadores/actor%5cedit']) {
    assert.equal(actorDetailFromPath(path), null);
  }
});
test('sector inspection scope does not widen when consulting another actor category', () => {
  for (const type of types) {
    assert.equal(canReadActorInspectionHistory({ rol: 'ADMIN' }, type), true);
    assert.equal(canReadActorInspectionHistory({ rol: 'GENERADOR', esInspector: true }, type), true);
    assert.equal(canReadActorInspectionHistory({ rol: type, actorId: 'a' }, type), false);
  }
  assert.equal(canReadActorInspectionHistory({ rol: 'ADMIN_GENERADOR', esInspector: true }, 'OPERADOR'), false);
  assert.equal(canReadActorInspectionHistory({ rol: 'ADMIN_GENERADOR' }, 'GENERADOR'), true);
});
test('actors use participation while cross-sector readers do not fetch a misleading history', () => {
  assert.equal(actorInspectionAccess({ rol: 'GENERADOR', actorId: 'g-1' }, 'GENERADOR', 'g-1'), 'participation');
  assert.equal(actorInspectionAccess({ rol: 'GENERADOR', actorId: 'g-1' }, 'GENERADOR', 'g-2'), null);
  assert.equal(actorInspectionAccess({ rol: 'ADMIN_GENERADOR' }, 'OPERADOR', 'o-1'), null);
  assert.equal(actorInspectionAccess({ rol: 'GENERADOR', esInspector: true }, 'OPERADOR', 'o-1'), 'staff');
});
test('return preserves path, query, hash and legacy inspection origin', () => {
  assert.equal(actorReturnPath({ actorReturn: '/manifiestos/m-1?pagina=2#registro' }, '/dashboard'), '/manifiestos/m-1?pagina=2#registro');
  assert.equal(actorReturnPath({ inspectionReturn: '/mobile/inspecciones/i-1#acta' }, '/dashboard'), '/mobile/inspecciones/i-1#acta');
});
test('malformed or external return state falls back to an authorized local destination', () => {
  for (const target of ['https://example.test', '//example.test', '/\\example.test', '/path\n', 4]) {
    assert.equal(actorReturnPath({ actorReturn: target }, '/dashboard'), '/dashboard');
  }
  for (const state of [null, [], 'bad']) assert.equal(actorReturnPath(state, '/dashboard'), '/dashboard');
});

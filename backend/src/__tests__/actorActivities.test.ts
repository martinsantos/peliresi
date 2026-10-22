import { describe, expect, it } from 'vitest';
import { approvedActivities, isActorActivity } from '../domain/actorActivities';
describe('additional actor activities', () => {
  const account = { rol: 'GENERADOR', generador: { id: 'g' }, operador: { id: 'o' } };
  it('preserves the legacy role without granting unapproved linked actors', () => {
    expect(approvedActivities(account, [])).toEqual(['GENERADOR']);
  });
  it('requires an approved application bound to the exact actor', () => {
    expect(approvedActivities(account, [{ tipoActor: 'OPERADOR', operadorId: 'o' }])).toEqual(['GENERADOR', 'OPERADOR']);
    expect(approvedActivities(account, [{ tipoActor: 'OPERADOR', operadorId: 'other' }])).toEqual(['GENERADOR']);
    expect(approvedActivities({ ...account, operador: null }, [{ tipoActor: 'OPERADOR', operadorId: 'o' }])).toEqual(['GENERADOR']);
  });
  it.each(['ADMIN', 'ADMIN_OPERADOR', 'AUDITOR', null, {}, 'operador'])('never accepts privileged or malformed role %s', value => {
    expect(isActorActivity(value)).toBe(false);
  });
});

it('an inactive activity is denied even with its earlier approval; other active roles remain available', () => {
  const account = { rol: 'GENERADOR', generador: { id: 'g', activo: true }, operador: { id: 'o', activo: false } };
  expect(approvedActivities(account, [{ tipoActor: 'OPERADOR', operadorId: 'o' }])).toEqual(['GENERADOR']);
  expect(approvedActivities({ ...account, generador: { id: 'g', activo: false } }, [])).toEqual([]);
});

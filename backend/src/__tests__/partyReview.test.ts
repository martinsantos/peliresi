import { describe, expect, it } from 'vitest';
import { canReviewAsCounterpart } from '../domain/partyReview';
const parties = { generadorId: 'g', transportistaId: 't', operadorId: 'o' };
const author = { creadoPorId: 'author', impersonadoPorId: 'impersonator' };
describe('counterpart post-facto review', () => {
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('requires the linked %s and distinct author', rol => {
    const key = rol.toLowerCase();
    const id = parties[(key + 'Id') as keyof typeof parties];
    const user = { id: 'counterpart', rol, [key]: { id } };
    expect(canReviewAsCounterpart(user, author, parties)).toBe(true);
    expect(canReviewAsCounterpart({ ...user, id: 'author' }, author, parties)).toBe(false);
    expect(canReviewAsCounterpart({ ...user, id: 'impersonator' }, author, parties)).toBe(false);
    expect(canReviewAsCounterpart({ ...user, [key]: { id: 'outsider' } }, author, parties)).toBe(false);
    expect(canReviewAsCounterpart({ ...user, restricted: true }, author, parties)).toBe(false);
    expect(canReviewAsCounterpart({ ...user, impersonatedBy: { id: 'admin' } }, author, parties)).toBe(false);
  });
  it('a relation never substitutes the active role or invents an unregistered participant', () => {
    expect(canReviewAsCounterpart({ id: 'u', rol: 'ADMIN', generador: { id: 'g' } }, author, parties)).toBe(false);
    expect(canReviewAsCounterpart({ id: 'u', rol: 'GENERADOR' }, author, {})).toBe(false);
  });
});

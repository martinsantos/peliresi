import { afterEach, expect, it, vi } from 'vitest';
import { manifestFeatureEnabled, manifestPracticeIdentity } from '../../lib/manifestTraining';
import { inTrainingSession } from '../../lib/trainingScope';
import { exceptionalCanApprove, exceptionalCreator } from '../../domain/manifiestoExcepcional';
import { canReviewAsCounterpart } from '../../domain/partyReview';
afterEach(() => vi.unstubAllEnvs());
const participant = { id: 'cap-generator-1', email: 'generator@capacitacion.invalid', rol: 'GENERADOR',
  generador: { id: 'cap-g-1' }, impersonatedBy: { id: 'teacher' }, restricted: false };
it.each(['MANIFEST_EXCEPTIONAL_ENABLED','MANIFEST_ADDENDA_ENABLED','MANIFEST_PARTY_REVIEW_ENABLED'] as const)('keeps %s off outside the signed school context', flag => {
  vi.stubEnv(flag, 'false');
  expect(manifestFeatureEnabled(flag)).toBe(false);
  expect(inTrainingSession(() => manifestFeatureEnabled(flag))).toBe(true);
  expect(manifestFeatureEnabled(flag)).toBe(false);
});
it('simulates a school approval without mutating the attributed request or changing operational impersonation', () => {
  const approver = { parte: 'generador' as const, rol: 'GENERADOR' as const, actorId: 'cap-g-1' };
  expect(exceptionalCanApprove(manifestPracticeIdentity(participant), approver)).toBe(false);
  inTrainingSession(() => {
    const actor = manifestPracticeIdentity(participant);
    expect(exceptionalCanApprove(actor, approver)).toBe(true);
    expect(exceptionalCanApprove(actor, { ...approver, actorId: 'another-team' })).toBe(false);
    expect(exceptionalCanApprove({ ...actor, restricted: true }, approver)).toBe(false);
    expect(canReviewAsCounterpart(actor, { creadoPorId: actor.id }, { generadorId: 'cap-g-1' })).toBe(false);
    expect(canReviewAsCounterpart(actor, { creadoPorId: 'cap-transporter' }, { generadorId: 'cap-g-1' })).toBe(true);
  });
  expect(participant.impersonatedBy).toEqual({ id: 'teacher' });
  expect(manifestPracticeIdentity(participant)).toBe(participant);
});
it('requires a school identity even within the realm; an operational administrator stays impersonated', () => {
  const admin = { ...participant, rol: 'ADMIN', email: 'admin@example.org' };
  expect(inTrainingSession(() => manifestPracticeIdentity(admin))).toBe(admin);
  expect(() => exceptionalCreator(manifestPracticeIdentity(admin))).toThrow(/suplantada/);
});
it('does not leak training capabilities across concurrent asynchronous requests', async () => {
  vi.stubEnv('MANIFEST_ADDENDA_ENABLED','false');
  const [school,real] = await Promise.all([inTrainingSession(async () => { await Promise.resolve(); return manifestFeatureEnabled('MANIFEST_ADDENDA_ENABLED'); }), Promise.resolve().then(() => manifestFeatureEnabled('MANIFEST_ADDENDA_ENABLED'))]);
  expect([school,real]).toEqual([true,false]);
});

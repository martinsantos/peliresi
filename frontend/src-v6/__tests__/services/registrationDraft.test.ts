import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readRegistrationDraft, writeRegistrationDraft, clearRegistrationDraft } from '../../services/registrationDraft';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('registration recovery is scoped, bounded and contains no credentials or file bytes', () => {
  const input = { step: 3, form: { razonSocial: 'QA', domicilio: 'QA 123', password: 'NEVER-STORE', confirmPassword: 'NEVER-STORE' },
    selectedY: ['Y8'], files: [{ tipo: 'MEMORIA_TECNICA', nombre: 'QA.pdf' }] };
  it('recovers current-step fields after reopening, keeping empty edits', () => {
    expect(writeRegistrationDraft('owner', 'public:GEN:qa', input)).toBe(true);
    expect(readRegistrationDraft('owner', 'public:GEN:qa')).toMatchObject({ data: { step: 3, form: { razonSocial: 'QA', domicilio: 'QA 123' } } });
    writeRegistrationDraft('owner', 'public:GEN:qa', { form: { razonSocial: '' }, step: 1 });
    expect(readRegistrationDraft('owner', 'public:GEN:qa')?.data).toEqual({ form: { razonSocial: '' }, step: 1 });
  });
  it('never reads another user, request or actor category draft', () => {
    writeRegistrationDraft('owner', 'public:GEN:qa', input);
    for (const [owner, scope] of [['other', 'public:GEN:qa'], ['owner', 'public:OP:qa'], ['owner', 'public:GEN:another']]) expect(readRegistrationDraft(owner, scope)).toBeNull();
  });
  it('strips secrets at any depth and does not pretend a File was saved', () => {
    writeRegistrationDraft('owner', 'scope', { ...input, nested: { accessToken: 'SECRET-TOKEN', password: 'SECRET', safe: 0 }, file: new File(['sensitive bytes'], 'QA.pdf') });
    const stored = localStorage.getItem(localStorage.key(0)!);
    expect(stored).not.toMatch(/NEVER-STORE|SECRET|sensitive bytes|accessToken|confirmPassword/);
    expect(readRegistrationDraft('owner', 'scope')?.data).toMatchObject({ nested: { safe: 0 } });
    expect(readRegistrationDraft('owner', 'scope')?.data).not.toHaveProperty('file');
  });
  it('reports storage failure without claiming the draft is saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QA quota'); });
    expect(writeRegistrationDraft('owner', 'scope', input)).toBe(false);
  });
  it('does not save without an owner or allow an oversized draft', () => {
    expect(writeRegistrationDraft('', 'scope', input)).toBe(false);
    expect(writeRegistrationDraft('owner', 'scope', { value: 'x'.repeat(300000) })).toBe(false);
  });
  it('expires stale drafts and clears only the selected one', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    writeRegistrationDraft('owner', 'a', input); writeRegistrationDraft('owner', 'b', input);
    clearRegistrationDraft('owner', 'a'); expect(readRegistrationDraft('owner', 'a')).toBeNull(); expect(readRegistrationDraft('owner', 'b')).not.toBeNull();
    vi.mocked(Date.now).mockReturnValue(1700000000000 + 31 * 86400000); expect(readRegistrationDraft('owner', 'b')).toBeNull();
  });
});

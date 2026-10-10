import { beforeEach, describe, expect, it } from 'vitest';
import { readTrialDraft, saveTrialDraft } from '../../services/registrationTrial';

beforeEach(() => localStorage.clear());
describe('functional trial is local recovery, not a real application', () => {
  it('recovers current step, shared fields, structured fleet and pending filenames', () => {
    const form = { razonSocial: 'QA prueba', choferesJson: '[{"nombre":"Juan"}]' };
    expect(saveTrialDraft('TRANSPORTISTA', { form, step: 3, files: ['LICENCIA_CHOFER_driver-qa-001'] })).toBe(true);
    expect(readTrialDraft('TRANSPORTISTA')?.data).toMatchObject({ form, step: 3, files: ['LICENCIA_CHOFER_driver-qa-001'] });
    expect(readTrialDraft('GENERADOR')).toBeNull();
    expect(localStorage.getItem('sitrep_pending_solicitud')).toBeNull();
  });
  it('does not save credentials, account identifiers or binary attachments', () => {
    saveTrialDraft('OPERADOR', { form: { razonSocial: 'QA', password: 'secret' }, step: 1, file: new File(['QA'], 'license.png') });
    const raw = JSON.stringify(readTrialDraft('OPERADOR'));
    expect(raw).not.toContain('secret'); expect(raw).not.toContain('license.png'); expect(raw).not.toContain('solicitudId');
  });
  it('ignores corrupted records without clearing other drafts', () => {
    saveTrialDraft('GENERADOR', { form: { razonSocial: 'QA own' }, step: 1 });
    localStorage.setItem('sitrep_pending_solicitud', 'REAL-ID');
    expect(readTrialDraft('GENERADOR')?.data.form).toEqual({ razonSocial: 'QA own' });
    expect(localStorage.getItem('sitrep_pending_solicitud')).toBe('REAL-ID');
  });
});

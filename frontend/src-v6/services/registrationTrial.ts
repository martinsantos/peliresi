import { readRegistrationDraft, writeRegistrationDraft } from './registrationDraft';

// No real account ID or pending-solicitud pointer participates in this namespace.
const scope = (type: string) => `trial:${type}`;
export const readTrialDraft = (type: string) => readRegistrationDraft('trial-local', scope(type));
export function saveTrialDraft(type: string, data: Record<string, unknown>, expectedRevision?: string | null): boolean {
  const current = readTrialDraft(type);
  if (expectedRevision !== undefined && (current?.data.revision ?? null) !== expectedRevision) return false;
  return writeRegistrationDraft('trial-local', scope(type), { form: data.form, step: data.step, files: data.files, revision: crypto.randomUUID() });
}

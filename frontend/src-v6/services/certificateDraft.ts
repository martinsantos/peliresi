import { readSupportCommandRecord, updateSupportCommandRecord } from './supportCommandStore';
import { certificateCommandKey, type CertificateScope, type CertificateCommand } from './certificateCommand';

export type CertificateDraft = { kind: 'PARCIAL' | 'FINAL'; amounts: Record<string, string>; method: string; note: string };
type Stored = { id: string; scope: CertificateScope; savedAt: number; draft: CertificateDraft | null };
export const certificateDraftKey = (scope: CertificateScope) => 'preparation:' + certificateCommandKey(scope);
function verify(record: Stored, scope: CertificateScope) {
  const draft = record.draft;
  if (record.id !== certificateDraftKey(scope) || certificateCommandKey(record.scope) !== certificateCommandKey(scope)
    || !Number.isFinite(record.savedAt) || (draft !== null && (!draft || !['PARCIAL', 'FINAL'].includes(draft.kind)
      || typeof draft.method !== 'string' || draft.method.length > 200 || typeof draft.note !== 'string' || draft.note.length > 500
      || !draft.amounts || typeof draft.amounts !== 'object' || Array.isArray(draft.amounts)
      || Object.keys(draft.amounts).length > 1000 || Object.entries(draft.amounts).some(([id, value]) => !id || typeof value !== 'string')))) {
    throw Error('No pudimos verificar el borrador de certificación. Conservamos la copia sin reemplazarla.');
  }
}
export async function readCertificateDraft(scope: CertificateScope) {
  const record = await readSupportCommandRecord<Stored>(certificateDraftKey(scope));
  if (!record) return null;
  verify(record, scope);
  return record.draft;
}
export async function writeCertificateDraft(scope: CertificateScope, draft: CertificateDraft | null, canWrite: () => boolean) {
  // Project only editable fields: a preparation never stores a reusable signature.
  const record: Stored = { id: certificateDraftKey(scope), scope: { ...scope }, savedAt: Date.now(),
    draft: draft ? { kind: draft.kind, amounts: { ...draft.amounts }, method: draft.method, note: draft.note } : null };
  verify(record, scope);
  await updateSupportCommandRecord<Stored>(record.id, current => {
    if (!canWrite()) throw Error('La edición cambió de pestaña o de cuenta.');
    if (current) verify(current, scope);
    return record;
  });
}
export function draftAfterCertificate(command: CertificateCommand): CertificateDraft | null {
  if (command.status === 'pending') throw Error('Comprobá el resultado antes de modificar el borrador.');
  return command.status === 'confirmed' ? null : {
    kind: command.input.tipo, method: command.input.metodo, note: command.input.nota,
    amounts: Object.fromEntries(command.input.cantidades.map(row => [row.residuoId, String(row.cantidad)])),
  };
}

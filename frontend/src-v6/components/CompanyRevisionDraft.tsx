import { Button } from './ui/ButtonV2';
import { useRecoverableForm } from '../hooks/useRecoverableForm';
import { DraftConflictNotice } from './DraftConflictNotice';

export const companyDraftKey = (scope: string, company: string, form: string) =>
  'sitrep:company-form:v1:' + encodeURIComponent(JSON.stringify([scope, company, form]));
type CompanyDraft<T> = { value: T; revision: number; changedKeys: Array<keyof T> };

/** Background notices may refresh a record; they must never replace a dirty form. */
export function useCompanyRevisionDraft<T extends object>(source: T, revision: number, key: string) {
  const valid = (input: unknown): input is CompanyDraft<T> => {
    if (!input || typeof input !== 'object') return false;
    const record = input as CompanyDraft<T>;
    return Number.isFinite(record.revision) && record.revision >= 0 && Array.isArray(record.changedKeys)
      && record.changedKeys.every(field => Object.hasOwn(source, field)) && !!record.value && typeof record.value === 'object'
      && Object.keys(record.value).every(field => Object.hasOwn(source, field))
      && Object.entries(source).every(([field, value]) => {
        const candidate = (record.value as Record<string, unknown>)[field];
        return Array.isArray(value) ? Array.isArray(candidate) && candidate.every(item => typeof item === 'string')
          : typeof candidate === typeof value && (typeof candidate !== 'string' || candidate.length <= 10000);
      });
  };
  const recovery = useRecoverableForm<CompanyDraft<T>>(key, { value: source, revision, changedKeys: [] }, valid);
  const draft = recovery.value;
  const dirty = draft.changedKeys.length > 0;
  const current = dirty ? draft : { value: source, revision, changedKeys: [] as Array<keyof T> };
  return {
    value: current.value,
    revision: current.revision,
    dirty,
    recovery,
    conflict: recovery.conflict || (dirty && draft.revision !== revision),
    serverConflict: dirty && draft.revision !== revision,
    change: (changes: Partial<T>) => recovery.update(previous => {
      const base = previous.changedKeys.length ? previous : { value: source, revision, changedKeys: [] as Array<keyof T> };
      return { ...base, value: { ...base.value, ...changes }, changedKeys: [...new Set([...base.changedKeys, ...(Object.keys(changes) as Array<keyof T>)])] };
    }),
    // Retain only the fields the person edited. Keeping their address must not
    // undo an unrelated name change made by another authorized person.
    keep: () => recovery.update({ ...current, revision, value: { ...source, ...Object.fromEntries(current.changedKeys.map(field => [field, current.value[field]])) } }),
    useServer: recovery.clear,
  };
}

export function CompanyDraftNotice({ draft, label }: { draft: { dirty: boolean; recovery: Pick<ReturnType<typeof useRecoverableForm>, 'error' | 'conflict' | 'conflictSaved' | 'conflictCount' | 'restored' | 'saved' | 'reload' | 'overwrite' | 'clear'> }; label: string }) {
  const r = draft.recovery;
  if (r.conflict) return <DraftConflictNotice durable={r.conflictSaved} count={r.conflictCount} onReload={r.reload} onKeep={r.overwrite}/>;
  if (!draft.dirty || (!r.saved && !r.error)) return null;
  return <div className="mb-3 flex flex-col items-stretch gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 sm:flex-row sm:items-center">
    <p role={r.error ? 'alert' : 'status'} className="min-w-0 flex-1">{r.error ? 'No pudimos guardar este borrador en el dispositivo. Mantené la pantalla abierta; tus datos siguen aquí.' : r.saved ? (r.restored ? 'Borrador recuperado en este dispositivo · cambios sin aplicar' : 'Borrador en este dispositivo · cambios sin aplicar') : 'Cambios registrados en SITREP · actualizando la consulta'}</p>
    {r.saved && <Button type="button" variant="outline" aria-label={'Descartar borrador de ' + label} onClick={r.clear}>Descartar borrador</Button>}
  </div>;
}

export function CompanyRevisionNotice({ fields, keep, useServer }: { fields: Array<[string, string]>; keep: () => void; useServer: () => void }) {
  return <div role="alert" className="mb-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-800">
    <p className="font-semibold">Los datos de SITREP cambiaron</p>
    <p className="mt-1">Tus cambios siguen en el formulario. Compará con lo guardado en SITREP antes de continuar.</p>
    <dl className="my-3 grid gap-2 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium">{label}</dt><dd className="break-words">{value || 'Sin completar'}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={keep}>Conservar mis cambios</Button><Button type="button" variant="outline" onClick={useServer}>Usar datos de SITREP</Button></div>
  </div>;
}

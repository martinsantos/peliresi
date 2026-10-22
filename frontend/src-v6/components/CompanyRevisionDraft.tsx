import { useState } from 'react';
import { Button } from './ui/ButtonV2';

/** Background notices may refresh a record; they must never replace a dirty form. */
export function useCompanyRevisionDraft<T extends object>(source: T, revision: number) {
  const [draft, setDraft] = useState({ value: source, revision, changedKeys: [] as Array<keyof T> });
  const dirty = draft.changedKeys.length > 0;
  if (!dirty && draft.revision !== revision) setDraft({ value: source, revision, changedKeys: [] });
  return {
    value: draft.value,
    revision: draft.revision,
    conflict: dirty && draft.revision !== revision,
    change: (changes: Partial<T>) => setDraft(current => ({ ...current, value: { ...current.value, ...changes }, changedKeys: [...new Set([...current.changedKeys, ...(Object.keys(changes) as Array<keyof T>)])] })),
    // Retain only the fields the person edited. Keeping their address must not
    // undo an unrelated name change made by another authorized person.
    keep: () => setDraft(current => ({ ...current, revision, value: { ...source, ...Object.fromEntries(current.changedKeys.map(key => [key, current.value[key]])) } })),
    useServer: () => setDraft({ value: source, revision, changedKeys: [] }),
  };
}

export function CompanyRevisionNotice({ fields, keep, useServer }: { fields: Array<[string, string]>; keep: () => void; useServer: () => void }) {
  return <div role="alert" className="mb-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-800">
    <p className="font-semibold">Otra persona actualizó estos datos</p>
    <p className="mt-1">Tus cambios siguen en el formulario. Compará con lo guardado en SITREP antes de continuar.</p>
    <dl className="my-3 grid gap-2 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium">{label}</dt><dd className="break-words">{value || 'Sin completar'}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={keep}>Conservar mis cambios</Button><Button type="button" variant="outline" onClick={useServer}>Usar datos de SITREP</Button></div>
  </div>;
}

import { applicationDeclarationGroups, applicationFieldLabel, applicationFieldValue, recordJson } from '../../utils/admissionReview';
import { Button } from '../ui/ButtonV2';

/** Read-only representation of the original declaration, including historical fields. */
export function ApplicationDeclarationSummary({ raw, title, grouped = false, onRetry, retrying = false }: {
  raw?: string; title: string; grouped?: boolean; onRetry: () => void; retrying?: boolean;
}) {
  const data = recordJson(raw);
  if (!data) return <div role="alert" className="space-y-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-900">
    <p>No pudimos interpretar {title.toLocaleLowerCase()}. No se reemplazaron por datos vacíos. La aprobación espera una declaración legible.</p>
    <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>Actualizar {title.toLocaleLowerCase()}</Button>
  </div>;
  if (!Object.keys(data).length) return <p className="text-sm text-neutral-600">Sin datos declarados en {title.toLocaleLowerCase()}.{grouped && ' Completá la declaración antes de aprobar.'}</p>;
  const groups = grouped ? applicationDeclarationGroups(data) : [{ title, rows: Object.entries(data).map(([key, value]) => ({ key, value })) }];
  return <div className="space-y-5">{groups.map(group => <section key={group.title} aria-label={group.title} className="space-y-3">
    {grouped && <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-800">{group.title}</h4>}
    <dl className="space-y-3">{group.rows.map(({ key, value }) => <div key={key}>
      <dt className="text-xs text-neutral-600">{applicationFieldLabel(key)}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-neutral-800 [overflow-wrap:anywhere]">{applicationFieldValue(key, value)}</dd>
    </div>)}</dl>
  </section>)}</div>;
}

import type { Field, ReadingKind } from '../utils/registrationOcrFields';

export function RegistrationOcrFields({ kind, fields }: { kind: ReadingKind; fields: Field[] }) {
  return <section aria-label={kind === 'arca' ? 'Lectura de constancia ARCA' : 'Lectura de comprobante ATM'} className="rounded-lg border bg-neutral-50 p-3">
    <strong>{kind === 'arca' ? 'Constancia ARCA (AFIP)' : 'Comprobante ATM'}</strong>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}>
      <dt className="text-sm text-neutral-600">{label}</dt><dd className="break-words font-medium">{value || 'No leído'}</dd>
    </div>)}</dl>
  </section>;
}

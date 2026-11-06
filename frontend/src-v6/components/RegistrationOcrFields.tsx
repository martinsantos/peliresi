import type { ReceiptAnalysis } from '../types/documentAnalysis';

export type ReadingKind = 'receipt' | 'license' | 'document' | 'electricity' | 'arca';
type Field = [string, string | undefined | null];

export function registrationOcrFields(kind: ReadingKind, analysis: ReceiptAnalysis): Field[] {
  if (kind === 'arca') return [['CUIT', analysis.arca?.cuit], ['Razón social', analysis.arca?.razonSocial]];
  if (kind === 'receipt') {
    const p = analysis.pago?.propuesta?.campos;
    return [['ID comprobante', p?.idComprobante], ['CUIT', p?.cuit], ['Código de tasa', p?.codigoTasa],
      ['Fecha de pago', p?.fechaPago], ['Importe', p?.importe], ['Período', p?.periodo], ['Referencia de liquidación', p?.referenciaLiquidacion]];
  }
  if (kind === 'electricity') {
    const e = analysis.electricidad;
    return [['Distribuidora', e?.nombreDistribuidora], ['Categoría tarifaria', e?.campos.categoriaTarifaria],
      ['Consumo facturado', e?.campos.consumoKwh], ...(e?.distribuidora === 'EDESTE' ? [['Ruta y folio', e.campos.suministro] as Field] : [])];
  }
  return [];
}

export function RegistrationOcrFields({ kind, fields }: { kind: ReadingKind; fields: Field[] }) {
  return <section aria-label={kind === 'arca' ? 'Lectura de constancia ARCA' : 'Lectura de comprobante ATM'} className="rounded-lg border bg-neutral-50 p-3">
    <strong>{kind === 'arca' ? 'Constancia ARCA (AFIP)' : 'Comprobante ATM'}</strong>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}>
      <dt className="text-sm text-neutral-600">{label}</dt><dd className="break-words font-medium">{value || 'No leído'}</dd>
    </div>)}</dl>
  </section>;
}

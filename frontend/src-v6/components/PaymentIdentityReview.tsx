import { useId, useRef, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ConfirmPaymentInput, PaymentIdentity, ReceiptAnalysis } from '../types/documentAnalysis';
import { getApiErrorMessage } from '../utils/api-error';

const fields: Array<[keyof Omit<PaymentIdentity, 'emisor'>, string, string]> = [
  ['idComprobante', 'ID Comprobante ATM', 'text'], ['cuit', 'CUIT del obligado', 'text'],
  ['codigoTasa', 'Código de tasa', 'text'], ['fechaPago', 'Fecha de pago', 'date'],
  ['importe', 'Importe pagado (ARS)', 'text'], ['periodo', 'Período / concepto', 'text'],
  ['referenciaLiquidacion', 'Referencia de liquidación o trámite', 'text'],
  ['transaccion', 'Transacción (si figura)', 'text'], ['control', 'Control (si figura)', 'text'],
];
export function PaymentIdentityReview({ analysis, sha256, cuit, referencia, onConfirm }: {
  analysis?: ReceiptAnalysis | null; sha256?: string | null; cuit?: string; referencia: string;
  onConfirm: (data: ConfirmPaymentInput) => Promise<void>;
}) {
  const control = useId(), inFlight = useRef(false);
  const [values, setValues] = useState<PaymentIdentity>(() => ({ emisor: 'ATM_TASAS', idComprobante: '', transaccion: '', control: '',
    cuit: cuit || '', codigoTasa: '', fechaPago: '', importe: '', periodo: 'Inscripción ' + new Date().getFullYear(), referenciaLiquidacion: referencia,
    ...analysis?.pago?.propuesta?.campos, ...analysis?.pago?.identidad }));
  const [checked, setChecked] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const confirmed = analysis?.pago?.revision === 'CONFIRMADO' && analysis.pago.sha256 === sha256;
  const save = async () => {
    if (!checked || !sha256 || inFlight.current) return;
    inFlight.current = true; setPending(true); setError('');
    try { await onConfirm({ ...values, emisor: 'ATM_TASAS', originalRevisado: true, expectedSha256: sha256 }); }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo confirmar la identidad. Tus datos siguen aquí.')); }
    finally { inFlight.current = false; setPending(false); }
  };
  if (confirmed) return <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900"><ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" /><p><strong>Pago reservado para este trámite.</strong> ID {analysis.pago?.identidad?.idComprobante}. La reserva se conserva aunque cambie la foto. Falta la decisión documental si está pendiente.</p></div>;
  return <details className="mt-3 rounded-lg border border-neutral-300 bg-white p-3" data-testid="payment-identity-review">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-primary-900"><LockKeyhole size={18} aria-hidden="true" />Identificar y reservar pago ATM</summary>
    <p className="my-2 text-sm leading-6 text-neutral-700">Revisá el ticket original para la repartición. El OCR propone datos; la reserva impide otro uso en SITREP y no acredita fondos ante ATM.</p>
    {analysis?.pago?.propuesta?.conflictos.length ? <p role="alert" className="mb-2 text-sm text-amber-900">Hay valores distintos en la lectura. Completá cada dato contra el original.</p> : null}
    <fieldset disabled={pending} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, type]) => <div key={key} className="min-w-0"><label htmlFor={control + key} className="mb-1 block text-sm font-medium text-neutral-800">{label}</label><input id={control + key} type={type} value={values[key]} maxLength={160} onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} inputMode={key === 'importe' ? 'decimal' : type === 'text' ? 'text' : undefined} className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-700" /></div>)}
      <label className="flex min-h-11 items-start gap-2 text-sm leading-6 text-neutral-800 sm:col-span-2"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="mt-1 size-5 shrink-0 accent-primary-800" />Revisé estos datos en el original y corresponden al obligado, concepto y trámite.</label>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-sm leading-6 text-error-800">{error}</p>}
    {!sha256 && <p role="alert" className="mt-2 text-sm text-amber-900">Falta la huella del original. Reintentá su lectura antes de confirmar.</p>}
    <button type="button" disabled={!checked || !sha256 || pending} onClick={() => void save()} className="mt-3 min-h-11 rounded-lg bg-primary-800 px-4 text-sm font-semibold text-white hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 disabled:bg-neutral-200 disabled:text-neutral-600">{pending ? 'Confirmando…' : 'Confirmar y reservar pago'}</button>
  </details>;
}

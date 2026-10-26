import { useId, useRef, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ConfirmPaymentInput, PaymentIdentity, ReceiptAnalysis } from '../types/documentAnalysis';
import { getApiErrorMessage } from '../utils/api-error';
import { validPaymentAmount, validPaymentDate } from '../utils/paymentReviewValidation';

const fields: Array<[keyof Omit<PaymentIdentity, 'emisor'>, string, string]> = [
  ['idComprobante', 'ID Comprobante ATM', 'text'], ['cuit', 'CUIT del obligado', 'text'],
  ['codigoTasa', 'Código de tasa', 'text'], ['fechaPago', 'Fecha de pago', 'date'],
  ['importe', 'Importe pagado (ARS)', 'text'], ['periodo', 'Período / concepto', 'text'],
  ['referenciaLiquidacion', 'Referencia de liquidación o trámite', 'text'],
  ['transaccion', 'Transacción (si figura)', 'text'], ['control', 'Control (si figura)', 'text'],
];
type PaymentReviewProps = {
  analysis?: ReceiptAnalysis | null; sha256?: string | null; cuit?: string; referencia: string;
  estadoDocumento?: string;
  onConfirm: (data: ConfirmPaymentInput) => Promise<void>;
};
export function PaymentIdentityReview(props: PaymentReviewProps) {
  return <PaymentReviewFields key={JSON.stringify([props.sha256, props.cuit, props.referencia])} {...props} />;
}
function PaymentReviewFields({ analysis, sha256, cuit, referencia, estadoDocumento, onConfirm }: PaymentReviewProps) {
  const control = useId(), inFlight = useRef(false);
  const incoming: PaymentIdentity = { emisor: 'ATM_TASAS', idComprobante: '', transaccion: '', control: '',
    cuit: cuit || '', codigoTasa: '', fechaPago: '', importe: '', periodo: 'Inscripción ' + new Date().getFullYear(), referenciaLiquidacion: referencia,
    ...analysis?.pago?.propuesta?.campos, ...analysis?.pago?.identidad };
  // Compare values, not object identity: ordinary refetches must preserve the review.
  const readingKey = JSON.stringify([fields.map(([key]) => incoming[key]), [...(analysis?.pago?.propuesta?.conflictos || [])].sort()]);
  const [acceptedReading, setAcceptedReading] = useState(readingKey);
  const [values, setValues] = useState<PaymentIdentity>(() => incoming);
  const [keptManual, setKeptManual] = useState(false);
  const readingChanged = readingKey !== acceptedReading;
  const [checked, setChecked] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [invalid, setInvalid] = useState<Partial<Record<keyof PaymentIdentity, string>>>({});
  const inputs = useRef<Partial<Record<keyof PaymentIdentity, HTMLInputElement | null>>>({});
  const confirmed = analysis?.pago?.revision === 'CONFIRMADO' && analysis.pago.sha256 === sha256;
  const save = async () => {
    if (!checked || !sha256 || inFlight.current || readingChanged) return;
    const errors: Partial<Record<keyof PaymentIdentity, string>> = {};
    for (const [key, label] of fields) {
      if (!['transaccion', 'control'].includes(key) && !values[key].trim()) errors[key] = 'Completá ' + label.toLowerCase() + ' según el original.';
    }
    for (const key of ['idComprobante', 'codigoTasa', 'transaccion', 'control'] as const) {
      if (values[key].trim() && !/^[a-zA-Z0-9 ._/-]{1,60}$/.test(values[key].trim())) errors[key] = 'Copiá el identificador del original: hasta 60 letras, números, espacios, puntos, guiones o barras.';
    }
    if (values.idComprobante.trim() && !/\d/.test(values.idComprobante)) errors.idComprobante = 'Incluí el número del comprobante ATM.';
    if (values.codigoTasa.trim() && !/^\d+$/.test(values.codigoTasa.replace(/[ ._/-]/g, ''))) errors.codigoTasa = 'El código de tasa debe ser numérico.';
    const enteredCuit = values.cuit.replace(/[ -]/g, '');
    if (values.cuit.trim() && (!/^\d{11}$/.test(enteredCuit) || (cuit && enteredCuit !== cuit.replace(/\D/g, '')))) errors.cuit = 'El CUIT debe coincidir con el obligado de este trámite.';
    if (values.importe.trim() && !validPaymentAmount(values.importe)) errors.importe = 'Ingresá un importe mayor que cero, con hasta dos decimales. Por ejemplo: 12.500,50.';
    if (values.fechaPago.trim() && !validPaymentDate(values.fechaPago)) errors.fechaPago = 'Ingresá una fecha de pago válida según el original.';
    setInvalid(errors); setError('');
    const first = fields.find(([key]) => errors[key])?.[0];
    if (first) { inputs.current[first]?.focus(); return; }
    inFlight.current = true; setPending(true); setError('');
    try { await onConfirm({ ...values, emisor: 'ATM_TASAS', originalRevisado: true, expectedSha256: sha256 }); }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo confirmar la identidad. Tus datos siguen aquí.')); }
    finally { inFlight.current = false; setPending(false); }
  };
  if (confirmed) return <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900"><ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" /><div>
    <p><strong>Pago reservado para este trámite.</strong>{analysis.pago?.identidad?.idComprobante && <> ID {analysis.pago.identidad.idComprobante}.</>}</p>
    {estadoDocumento === 'PENDIENTE' && <p>Revisá el documento para aprobarlo o rechazarlo.</p>}
    {estadoDocumento === 'APROBADO' && <p>Documento aprobado.</p>}
    {estadoDocumento === 'RECHAZADO' && <p>Documento rechazado. La reserva no se libera para otro trámite.</p>}
    <p>La reserva se conserva aunque cambie la foto. No acredita fondos ante ATM.</p>
  </div></div>;
  return <details className="mt-3 rounded-lg border border-neutral-300 bg-white p-3" data-testid="payment-identity-review">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-primary-900"><LockKeyhole size={18} aria-hidden="true" />Identificar y reservar pago ATM</summary>
    <p className="my-2 text-sm leading-6 text-neutral-700">Revisá el ticket original para la repartición. El OCR propone datos; la reserva impide otro uso en SITREP y no acredita fondos ante ATM.</p>
    {readingChanged && <div role="alert" className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p>Hay una nueva lectura del mismo comprobante. Tus datos siguen aquí. Elegí qué valores revisar antes de reservar el pago.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="min-h-11 rounded-lg bg-primary-800 px-3 font-semibold text-white focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 disabled:opacity-50" onClick={() => { setValues(incoming); setAcceptedReading(readingKey); setChecked(false); setInvalid({}); setError(''); setKeptManual(false); }}>Usar nueva lectura</button>
        <button type="button" disabled={pending} className="min-h-11 rounded-lg border border-neutral-400 bg-white px-3 font-semibold text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 disabled:opacity-50" onClick={() => { setAcceptedReading(readingKey); setChecked(false); setError(''); setKeptManual(true); }}>Conservar mis datos</button>
      </div>
    </div>}
    {keptManual && !readingChanged && <p role="status" className="my-2 text-sm text-neutral-700">Conservaste tus datos manuales. Revisalos contra el original antes de confirmar.</p>}
    {analysis?.pago?.propuesta?.conflictos.length ? <p role="alert" className="mb-2 text-sm text-amber-900">Hay valores distintos en la lectura. Completá cada dato contra el original.</p> : null}
    <fieldset disabled={pending || readingChanged} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, type]) => <div key={key} className="min-w-0"><label htmlFor={control + key} className="mb-1 block text-sm font-medium text-neutral-800">{label}</label><input ref={node => { inputs.current[key] = node; }} id={control + key} type={type} value={values[key]} maxLength={160} aria-required={!['transaccion', 'control'].includes(key)} aria-invalid={!!invalid[key]} aria-describedby={invalid[key] ? control + key + '-error' : undefined} onChange={event => { setValues(previous => ({ ...previous, [key]: event.target.value })); setInvalid(previous => ({ ...previous, [key]: undefined })); }} inputMode={key === 'importe' ? 'decimal' : type === 'text' ? 'text' : undefined} className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-700" />{invalid[key] && <p id={control + key + '-error'} role="alert" className="mt-1 text-sm text-error-800">{invalid[key]}</p>}</div>)}
      <label className="flex min-h-11 items-start gap-2 text-sm leading-6 text-neutral-800 sm:col-span-2"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="mt-1 size-5 shrink-0 accent-primary-800" />Revisé estos datos en el original y corresponden al obligado, concepto y trámite.</label>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-sm leading-6 text-error-800">{error}</p>}
    {!sha256 && <p role="alert" className="mt-2 text-sm text-amber-900">Falta la huella del original. Reintentá su lectura antes de confirmar.</p>}
    <button type="button" disabled={!checked || !sha256 || pending || readingChanged} onClick={() => void save()} className="mt-3 min-h-11 rounded-lg bg-primary-800 px-4 text-sm font-semibold text-white hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 disabled:bg-neutral-200 disabled:text-neutral-600">{pending ? 'Confirmando…' : 'Confirmar y reservar pago'}</button>
  </details>;
}

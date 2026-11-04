import { createHash } from 'node:crypto';
import { AppError } from '../middlewares/errorHandler';

export type PaymentIdentity = {
  emisor: 'ATM_TASAS';
  idComprobante: string;
  transaccion: string;
  control: string;
  cuit: string;
  codigoTasa: string;
  fechaPago: string;
  importe: string;
  periodo: string;
  referenciaLiquidacion: string;
};
export type PaymentProposal = { campos: Partial<PaymentIdentity>; conflictos: string[] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export const paymentIdentifier = (value: string) => plain(value).replace(/[ .\-_/]/g, '').replace(/^0+(?=\d)/, '');

/** Exact decimal arithmetic; neither a tax amount nor a currency conversion. */
export function decimalAmount(raw: string): string | undefined {
  let value = raw.trim().replace(/^\$\s*/, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(value)) return;
  if (value.includes(',')) {
    if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(value)) return;
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return;
  const [whole, cents = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}`;
}
function isoDate(raw: string): string | undefined {
  const local = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const value = local ? `${local[3]}-${local[2]}-${local[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

/** Only labelled values. Ambiguous OCR is kept as evidence, never guessed. */
export function paymentProposal(text: string): PaymentProposal {
  const normalized = plain(text), campos: Partial<PaymentIdentity> = {}, conflictos: string[] = [];
  const rules: Array<[keyof PaymentIdentity, RegExp, (raw: string) => string | undefined]> = [
    ['idComprobante', /\bID\s*(?:DE\s*)?COMPROBANTE\s*[:#-]?\s*([A-Z0-9][A-Z0-9 ._/-]{0,55})/g, value => paymentIdentifier(value.trim())],
    ['transaccion', /\b(?:N[°º.]?\s*(?:DE\s*)?)?TRANSACCION\s*[:#-]\s*([A-Z0-9][A-Z0-9 ._/-]{0,55})/g, value => paymentIdentifier(value.trim())],
    ['control', /\bCONTROL\s*[:#-]\s*([A-Z0-9][A-Z0-9 ._/-]{0,55})/g, value => paymentIdentifier(value.trim())],
    ['cuit', /\bCUIT(?:\s+DEL\s+(?:OBLIGADO|CONTRIBUYENTE))?\s*[:#-]?\s*(\d{2}[ -]?\d{8}[ -]?\d)\b/g, value => value.replace(/\D/g, '')],
    ['codigoTasa', /\bCODIGO\s*(?:DE\s*)?TASA\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{0,29})/g, paymentIdentifier],
    ['fechaPago', /\bFECHA\s*(?:DE\s*)?PAGO\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b/g, isoDate],
    ['importe', /\bIMPORTE\s*(?:TOTAL|PAGADO)?\s*[:#-]?\s*\$?\s*(\d[\d.,]*)/g, decimalAmount],
  ];
  for (const [field, pattern, convert] of rules) {
    const values = [...new Set([...normalized.matchAll(pattern)].map(match => convert(match[1])).filter((value): value is string => Boolean(value)))];
    if (values.length === 1) campos[field] = values[0] as never;
    else if (values.length > 1) conflictos.push(field);
  }
  if (/\bATM\b|ADMINISTRACION TRIBUTARIA MENDOZA/.test(normalized)) campos.emisor = 'ATM_TASAS';
  return { campos, conflictos };
}

export function normalizePaymentIdentity(input: unknown, obligatedCuit: string): PaymentIdentity {
  const data = record(input), fields = ['idComprobante', 'transaccion', 'control', 'cuit', 'codigoTasa', 'fechaPago', 'importe', 'periodo', 'referenciaLiquidacion'] as const;
  if (data.emisor !== 'ATM_TASAS' || data.originalRevisado !== true) throw new AppError('Revisá el ticket original de ATM y confirmá su identidad antes de aprobarlo.', 400);
  const values = Object.fromEntries(fields.map(key => {
    const value = data[key];
    if (value != null && (typeof value !== 'string' || value.length > 160)) throw new AppError('Los datos del pago deben ser texto de hasta 160 caracteres.', 400);
    return [key, typeof value === 'string' ? value.trim() : ''];
  })) as Record<typeof fields[number], string>;
  for (const key of ['idComprobante', 'transaccion', 'control', 'codigoTasa'] as const) {
    if (values[key] && !/^[a-zA-Z0-9 ._/-]{1,60}$/.test(values[key])) throw new AppError(`Identificador inválido: ${key}`, 400);
    values[key] = paymentIdentifier(values[key]);
  }
  const cuit = values.cuit.replace(/[ -]/g, ''), expected = obligatedCuit.replace(/\D/g, '');
  if (!/\d/.test(values.idComprobante) || !/^\d+$/.test(values.codigoTasa)) throw new AppError('El ID Comprobante debe contener su número y el código de tasa debe ser numérico. No uses valores de ejemplo.', 400);
  if (!/^\d{11}$/.test(cuit) || cuit !== expected) throw new AppError('El CUIT del obligado debe coincidir con el de este trámite. No se confirmó el pago.', 409);
  const fechaPago = isoDate(values.fechaPago), importe = decimalAmount(values.importe);
  if (!values.idComprobante || !values.codigoTasa || !fechaPago || !importe || Number(importe) <= 0 || !values.periodo || !values.referenciaLiquidacion) {
    throw new AppError('Completá ID Comprobante, código de tasa, fecha, importe, período/concepto y referencia de liquidación o trámite. Si no son legibles, solicitá el original.', 400);
  }
  return { ...values, emisor: 'ATM_TASAS', cuit, fechaPago, importe };
}

/** CUIT, amount, period and application are deliberately NOT part of uniqueness:
 * changing the beneficiary, tax or application cannot make a payment new. */
export function paymentKeys(data: Partial<PaymentIdentity>): string[] {
  if (data.emisor !== 'ATM_TASAS') return [];
  const values: string[] = [];
  if (data.idComprobante) values.push('ATM_TASAS:COMPROBANTE:' + paymentIdentifier(data.idComprobante));
  if (data.transaccion && data.control) values.push('ATM_TASAS:OPERACION:' + paymentIdentifier(data.transaccion) + ':' + paymentIdentifier(data.control));
  return [...new Set(values)].sort().map(value => createHash('sha256').update(value).digest('hex')).sort();
}

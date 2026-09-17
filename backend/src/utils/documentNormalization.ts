import crypto from 'crypto';

/** Normalize identifiers before applying uniqueness or OCR comparison rules. */
export function normalizeDocumentIdentifier(value: string | null | undefined): string {
  return (value || '').normalize('NFKC').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizePlate(value: string | null | undefined): string {
  return normalizeDocumentIdentifier(value);
}

export function normalizeDni(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export function normalizeCuitDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export function normalizeAtmReference(value: string | null | undefined): string {
  return normalizeDocumentIdentifier(value);
}

export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function atmFingerprintHmac(input: {
  issuer: string;
  reference: string;
  cuit?: string | null;
  amountCents?: bigint | number | null;
  period?: string | null;
  paidAt?: Date | string | null;
}, secret: string): string {
  const paidAt = input.paidAt ? new Date(input.paidAt).toISOString().slice(0, 10) : '';
  const amount = input.amountCents === null || input.amountCents === undefined ? '' : String(input.amountCents);
  const payload = [
    normalizeDocumentIdentifier(input.issuer),
    normalizeAtmReference(input.reference),
    normalizeCuitDigits(input.cuit),
    amount,
    normalizeDocumentIdentifier(input.period),
    paidAt,
  ].join('|');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

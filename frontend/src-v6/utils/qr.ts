/** Canonical QR payload parsing shared by the web and PWA scanners. */
export interface ParsedQrPayload {
  id?: string;
  numero?: string;
}

export type ParsedSitrepQr =
  | ({ kind: 'manifiesto' } & ParsedQrPayload)
  | { kind: 'certificado'; token: string };

// Production numbers are YYYY-NNNNNN. Keep compatibility with legacy MAN-/M-
// numbers used in older printed material, while rejecting arbitrary URLs/text.
const NUMERO_RE = /^(?:(?:MAN|M)[-_])?\d{4}[-_]\d{4,}$/i;
const LEGACY_NUMERO_RE = /^(?:MAN|M)-[A-Za-z0-9][A-Za-z0-9-]{2,80}$/i;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,100}$/;
const CERTIFICATE_TOKEN_RE = /^[A-Za-z0-9_-]{20,4096}\.[A-Za-z0-9_-]{20,1024}$/;

export function isValidManifiestoNumero(value: unknown): value is string {
  return typeof value === 'string' && (NUMERO_RE.test(value.trim()) || LEGACY_NUMERO_RE.test(value.trim()));
}

function fromObject(value: unknown): ParsedQrPayload | null {
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  const id = typeof object.id === 'string' && ID_RE.test(object.id) ? object.id : undefined;
  const numeroCandidate = object.numero ?? object.numeroManifiesto ?? object.manifiestoNumero;
  const numero = isValidManifiestoNumero(numeroCandidate) ? numeroCandidate.trim() : undefined;
  return id || numero ? { id, numero } : null;
}

/** Accept raw numbers, generated verification URLs and legacy JSON payloads. */
export function parseManifiestoQr(raw: string): ParsedQrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isValidManifiestoNumero(trimmed)) return { numero: trimmed };

  try {
    const parsed = fromObject(JSON.parse(trimmed));
    if (parsed) return parsed;
  } catch {
    // Continue with URL parsing.
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const marker = segments.slice(-3, -1).join('/');
    const numero = segments.at(-1);
    if (marker === 'manifiestos/verificar' && isValidManifiestoNumero(numero)) {
      return { numero: numero!.trim() };
    }
  } catch {
    // Not a URL.
  }

  return null;
}

/**
 * Parse every QR issued by SITREP without following the host embedded in the
 * code.  The scanner always navigates inside its current trusted origin.
 */
export function parseSitrepQr(raw: string): ParsedSitrepQr | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const marker = segments.slice(-3, -1).join('/');
    const token = segments.at(-1);
    if (marker === 'certificados/verificar' && token && CERTIFICATE_TOKEN_RE.test(token)) {
      return { kind: 'certificado', token };
    }
  } catch {
    // Raw manifest numbers and legacy JSON are handled below.
  }

  const manifiesto = parseManifiestoQr(trimmed);
  return manifiesto ? { kind: 'manifiesto', ...manifiesto } : null;
}

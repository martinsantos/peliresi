export interface ParsedQrPayload {
  id?: string;
  numero?: string;
}

const NUMERO_RE = /^(?:(?:MAN|M)[-_])?\d{4}[-_]\d{4,}$/i;
const LEGACY_NUMERO_RE = /^(?:MAN|M)-[A-Za-z0-9][A-Za-z0-9-]{2,80}$/i;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,100}$/;

export function parseQrPayload(raw: unknown): ParsedQrPayload | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  const isNumero = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' && (NUMERO_RE.test(candidate.trim()) || LEGACY_NUMERO_RE.test(candidate.trim()));

  const fromObject = (candidate: unknown): ParsedQrPayload | null => {
    if (!candidate || typeof candidate !== 'object') return null;
    const object = candidate as Record<string, unknown>;
    const id = typeof object.id === 'string' && ID_RE.test(object.id) ? object.id : undefined;
    const numeroCandidate = object.numero ?? object.numeroManifiesto ?? object.manifiestoNumero;
    const numero = isNumero(numeroCandidate) ? numeroCandidate.trim() : undefined;
    return id || numero ? { id, numero } : null;
  };

  if (isNumero(value)) return { numero: value };
  try {
    const parsed = fromObject(JSON.parse(value));
    if (parsed) return parsed;
  } catch {
    // Not JSON; try URL below.
  }
  try {
    const url = new URL(value);
    const last = url.pathname.split('/').filter(Boolean).at(-1);
    if (isNumero(last)) return { numero: last!.trim() };
  } catch {
    // Not a URL.
  }
  return null;
}

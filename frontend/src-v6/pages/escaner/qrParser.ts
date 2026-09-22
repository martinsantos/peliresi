/**
 * Parsers for payloads emitted by the real camera QR scanner.
 *
 * Inspection trace URLs are deliberately strict: a QR code must point to
 * SITREP's canonical public verification route on an allowed host.  This
 * prevents the scanner from turning arbitrary QR content into navigation.
 */

export const CANONICAL_QR_HOSTS = [
  'rptrazar.mendoza.gov.ar',
  // Legacy public hostname still used by already-issued SITREP material.
  'sitrep.ultimamilla.com.ar',
] as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const INSPECTION_PATH = /^\/verificar\/inspecciones\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export type ParsedQrPayload =
  | { kind: 'inspection'; token: string; url: string }
  | { kind: 'manifiesto'; id: string };

export const isValidManifiestoId = (data: string): boolean =>
  /^M-\d{4}-\d{4,}$/i.test(data.trim());

function isAllowedInspectionHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if ((import.meta.env?.DEV ?? false) && LOCAL_HOSTS.has(host)) {
    return url.protocol === 'http:';
  }
  return CANONICAL_QR_HOSTS.includes(host as (typeof CANONICAL_QR_HOSTS)[number]) && url.protocol === 'https:';
}

/** Returns the token only for a canonical, same-service inspection URL. */
export function parseInspectionTraceUrl(raw: string): { token: string; url: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!isAllowedInspectionHost(url) || url.search || url.hash) return null;
    const match = url.pathname.match(INSPECTION_PATH);
    if (!match) return null;
    return { token: match[1], url: url.toString() };
  } catch {
    return null;
  }
}

/**
 * Parse the QR formats already emitted by SITREP, plus inspection trace URLs.
 * Raw manifest IDs and legacy manifest URLs remain supported.
 */
export function parseQrPayload(raw: string): ParsedQrPayload | null {
  const trimmed = raw.trim();
  const inspection = parseInspectionTraceUrl(trimmed);
  if (inspection) return { kind: 'inspection', ...inspection };

  if (isValidManifiestoId(trimmed)) return { kind: 'manifiesto', id: trimmed };

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && isValidManifiestoId(decodeURIComponent(last))) {
      return { kind: 'manifiesto', id: decodeURIComponent(last) };
    }
  } catch {
    // Not a URL; JSON payload compatibility is checked below.
  }

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate = json.id ?? json.manifiestoId ?? json.manifiesto_id;
    if (candidate && isValidManifiestoId(String(candidate))) {
      return { kind: 'manifiesto', id: String(candidate) };
    }
  } catch {
    // Invalid/non-JSON QR content.
  }

  return null;
}

export function parseManifiestoId(raw: string): string | null {
  const parsed = parseQrPayload(raw);
  return parsed?.kind === 'manifiesto' ? parsed.id : null;
}

/** A rejected request is not replayed automatically, especially a mutation. */
export function rateLimitMessage(headers?: Record<string, unknown>, now = Date.now()): string {
  const value = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  let seconds: number | undefined;
  if (/^\d+$/.test(raw)) seconds = Number(raw);
  else if (/^[A-Za-z]{3}, /.test(raw)) {
    const date = Date.parse(raw);
    if (Number.isFinite(date)) seconds = Math.ceil((date - now) / 1000);
  }
  const wait = seconds !== undefined && Number.isFinite(seconds) && seconds >= 0 && seconds <= 86_400
    ? `en ${Math.max(1, seconds)} ${seconds > 1 ? 'segundos' : 'segundo'}` : 'en un momento';
  return `Podés reintentar ${wait}. No hace falta recargar la página.`;
}

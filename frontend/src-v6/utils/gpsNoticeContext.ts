type GpsNotice = { tipo?: string; titulo?: string; datos?: string | null; mensaje?: string | null };

function noticeData(notice: GpsNotice): Record<string, unknown> {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(notice.datos || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* Historical notices may not contain structured metadata. */ }
  return data;
}

function isGpsType(notice: GpsNotice, data: Record<string, unknown>): boolean {
  return notice.tipo === 'ANOMALIA_DETECTADA' || notice.tipo === 'ANOMALIA_GPS'
    || (notice.tipo === 'ALERTA_SISTEMA' && data.evento === 'ANOMALIA_GPS');
}

export function isGpsNotice(notice: GpsNotice): boolean {
  return isGpsType(notice, noticeData(notice));
}

/** Do not rename configured rules or rewrite the stored title used to deduplicate notices. */
export function gpsNoticeTitle(notice: GpsNotice): string | null {
  const data = noticeData(notice);
  if (notice.tipo !== 'ANOMALIA_DETECTADA' || notice.titulo !== '⚠️ Anomalía GPS Detectada') return null;
  return data.tipoAnomalia === 'FUERA_CORREDOR_GEOGRAFICO' || /corredor geogr[aá]fico/i.test(notice.mensaje || '')
    ? 'GPS: corredor para revisar' : null;
}

/** Keep historical notices intact while clarifying what their timestamps prove. */
export function gpsNoticeContext(notice: GpsNotice): string | null {
  const data = noticeData(notice);
  if (!isGpsType(notice, data)) return null;
  const message = notice.mensaje || '';
  const corridor = data.tipoAnomalia === 'FUERA_CORREDOR_GEOGRAFICO' || /corredor geogr[aá]fico/i.test(message);
  const context = [
    !/hora de captura no disponible/i.test(message) ? 'La hora de captura puede ser anterior a la recepción.' : null,
    corridor && !/no se compara una ruta vial autorizada/i.test(message) ? 'No se compara una ruta vial autorizada.' : null,
  ].filter(Boolean);
  return context.length ? `${context.join(' ')} Verificá el caso con transporte antes de concluir.` : null;
}

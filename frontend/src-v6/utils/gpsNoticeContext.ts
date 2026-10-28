/** Keep historical notices intact while clarifying what their timestamps prove. */
export function gpsNoticeContext(notice: { tipo?: string; datos?: string | null; mensaje?: string | null }): string | null {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(notice.datos || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* Historical notices may not contain structured metadata. */ }
  const gps = notice.tipo === 'ANOMALIA_DETECTADA' || notice.tipo === 'ANOMALIA_GPS'
    || (notice.tipo === 'ALERTA_SISTEMA' && data.evento === 'ANOMALIA_GPS');
  if (!gps || data.tipoAnomalia === 'FUERA_CORREDOR_GEOGRAFICO') return null;
  if (/hora de captura no disponible/i.test(notice.mensaje || '')) return null;
  return 'La hora de captura puede ser anterior a la recepción. Verificá el caso con transporte antes de concluir.';
}

import type { Notificacion } from '../types/models';

/** Acknowledging a notice does not complete work. Use the current API state. */
export function notificationFollowup(notice: Notificacion): string | null {
  let data: { tipo?: string; version?: number; estadoDetectado?: string; familia?: string };
  try { data = JSON.parse(notice.datos || 'null'); }
  catch { return null; }
  if (data?.familia === 'catalogo_verificable' && data.version === 1) {
    if (notice.seguimientoEstado === 'RESUELTA') return 'Caso resuelto · Consultar fuente e historial';
    if (notice.seguimientoEstado === 'DESCARTADA') return 'Caso descartado · Consultar fuente e historial';
    return data.tipo === 'requerimiento_inspeccion' ? 'Revisar requerimiento y respuesta · Abrir expediente' : 'Revisar vigencia y documentación · Abrir ficha';
  }
  if (!data || data.tipo !== 'seguimiento_cierre' || data.version !== 1) return null;
  if (notice.seguimientoEstado === 'RESUELTA') return 'Caso resuelto · Ver manifiesto e historial';
  if (notice.seguimientoEstado === 'DESCARTADA') return 'Caso descartado · Ver manifiesto e historial';
  const state = notice.manifiesto?.estado;
  if (!state) return 'Consultar el estado actual del manifiesto';
  if (state === 'TRATADO' || state === 'CANCELADO') return 'Seguimiento finalizado · Ver historial';
  if (state === 'RECIBIDO') return 'Revisar pesaje y tratamiento · Abrir manifiesto';
  if (state === 'EN_TRATAMIENTO') return 'Revisar tratamiento y cierre · Abrir manifiesto';
  return 'Estado actualizado · Abrir manifiesto';
}

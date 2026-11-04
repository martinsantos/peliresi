import type { Notificacion } from '../types/models';

function isIndividualApproval(datos: string | null): boolean {
  try {
    const data = JSON.parse(datos || '{}');
    return data?.tipo === 'propuesta_partes' && data.version === 1
      && ['aprobacion-GENERADOR', 'aprobacion-TRANSPORTISTA', 'aprobacion-OPERADOR'].includes(data.fase);
  } catch { return false; }
}

/** Present an older individual-approval notice without asserting that another
 * approval is still pending. The recorded notice itself is not changed. */
export function notificationMessage(notice: Pick<Notificacion, 'mensaje' | 'datos'>): string {
  const previous = 'Revisá qué aprobaciones faltan.';
  if (typeof notice.mensaje !== 'string' || !notice.mensaje.endsWith(previous) || !isIndividualApproval(notice.datos)) return notice.mensaje;
  return notice.mensaje.slice(0, -previous.length) + 'Revisá las aprobaciones.';
}

/** A live banner has little room; the inbox keeps the full event context. */
export function notificationToastMessage(notice: Pick<Notificacion, 'mensaje' | 'datos' | 'manifiesto'>): string {
  const number = notice.manifiesto?.numero?.trim();
  return number && isIndividualApproval(notice.datos) ? `${number} · Revisá las aprobaciones.` : notificationMessage(notice);
}

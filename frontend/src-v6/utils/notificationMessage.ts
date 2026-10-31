import type { Notificacion } from '../types/models';

/** Present an older individual-approval notice without asserting that another
 * approval is still pending. The recorded notice itself is not changed. */
export function notificationMessage(notice: Pick<Notificacion, 'mensaje' | 'datos'>): string {
  const previous = 'Revisá qué aprobaciones faltan.';
  if (typeof notice.mensaje !== 'string' || !notice.mensaje.endsWith(previous)) return notice.mensaje;
  try {
    const data = JSON.parse(notice.datos || '{}');
    if (data?.tipo !== 'propuesta_partes' || data.version !== 1
      || !['aprobacion-GENERADOR', 'aprobacion-TRANSPORTISTA', 'aprobacion-OPERADOR'].includes(data.fase)) return notice.mensaje;
    return notice.mensaje.slice(0, -previous.length) + 'Consultá el estado actual de las aprobaciones.';
  } catch {
    return notice.mensaje;
  }
}

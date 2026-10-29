import api from './api';
import { GpsPendingError, readPendingGpsQueue, type PendingGpsPoint } from './gpsQueue';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';

export type GpsReceiptSummary = { checked: number; confirmed: number; unconfirmed: number };

export function matchesGpsReceipt(response: unknown, point: PendingGpsPoint): boolean {
  const body = (response as { data?: { success?: unknown; data?: { idempotencia?: { version?: unknown; puntoId?: unknown; confirmado?: unknown }; tracking?: { latitud?: unknown; longitud?: unknown; velocidad?: unknown; direccion?: unknown } } } } | undefined)?.data;
  const receipt = body?.data?.idempotencia, saved = body?.data?.tracking;
  return body?.success === true && receipt?.version === 1 && receipt.confirmado === true && receipt.puntoId === point.puntoId
    && saved != null && Object.hasOwn(saved, 'velocidad') && Object.hasOwn(saved, 'direccion')
    && saved.latitud === point.lat && saved.longitud === point.lng
    && (saved.velocidad ?? null) === (point.speed ?? null) && (saved.direccion ?? null) === (point.heading ?? null);
}

/** Read-only reconciliation. It deliberately never removes or rewrites the
 * shared queue: another tab may still be adding a location. */
export async function verifyStoredGpsReceipts(ownerId: string | number, id: string): Promise<GpsReceiptSummary> {
  const owner = String(ownerId), context = supportRequestContext();
  const ensureSession = () => {
    if (!owner || !context || !supportSessionMatches(owner) || supportRequestContext() !== context) {
      throw new GpsPendingError('La cuenta o actividad cambió. Volvé a abrir el viaje antes de comprobar las ubicaciones.');
    }
  };
  const read = () => {
    const saved = readPendingGpsQueue(owner, id);
    if (!saved.ok) throw new GpsPendingError(saved.reason === 'legacy'
      ? 'Hay ubicaciones anteriores sin titular identificado. Conservá este dispositivo y contactá a soporte.'
      : 'No se pudieron leer las ubicaciones guardadas. Conservá este dispositivo y contactá a soporte.');
    if (!saved.durable) throw new GpsPendingError('No se pudo confirmar el guardado local. Conservá esta pantalla y revisá el almacenamiento.');
    return saved.points;
  };
  ensureSession();
  const points = read(), original = JSON.stringify(points);
  let next = 0, confirmed = 0, unconfirmed = 0;
  const worker = async () => {
    while (next < points.length) {
      const point = points[next++];
      ensureSession();
      if (!point.puntoId) { unconfirmed++; continue; }
      let response: unknown;
      try { response = await api.get(`/manifiestos/${encodeURIComponent(id)}/ubicaciones/${encodeURIComponent(point.puntoId)}/confirmacion`); }
      catch { ensureSession(); unconfirmed++; continue; }
      ensureSession();
      if (matchesGpsReceipt(response, point)) confirmed++; else unconfirmed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(points.length, 4) }, () => worker()));
  ensureSession();
  if (JSON.stringify(read()) !== original) throw new GpsPendingError('Las ubicaciones cambiaron durante la comprobación. Revisá y volvé a intentar.');
  return { checked: points.length, confirmed, unconfirmed };
}

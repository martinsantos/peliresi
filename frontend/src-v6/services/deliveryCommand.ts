import { enqueueDeliveryOnce, getSyncQueue, processSyncQueue } from './indexeddb';
import { OFFLINE_QUEUE_WAKE_EVENT } from './offlineSyncEvents';
import { assertNoOtherGpsQueue, gpsContextScope, newGpsPointId } from './gpsQueue';
import { assertNoStoredFleetGpsForManifest } from './fleetGpsStorage';
import { withGpsTransitionLock } from './gpsCoordination';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import type { ConfirmarEntregaRequest } from '../types/api';

export type DeliveryOutcome = { status: 'confirmed' } | { status: 'pending'; message: string };
export type DeliveryContext = { userId: string | number; owner: string; role: string; companyScoped: boolean; requestContext: string };

/** Persist the exact command before sending it. An uncertain response never
 * discards its reference, so another tab or a later session can verify it. */
export async function submitDelivery(id: string, data: ConfirmarEntregaRequest, context: DeliveryContext): Promise<DeliveryOutcome> {
  const requestContext = supportRequestContext();
  const isCurrent = () => Boolean(requestContext && context.requestContext === requestContext && supportSessionMatches(String(context.userId))
    && supportRequestContext() === requestContext);
  if (!id || !context.owner || !['TRANSPORTISTA', 'ADMIN'].includes(context.role) || !isCurrent()) {
    throw new Error('La cuenta o actividad cambió. Volvé a abrir el viaje antes de confirmar la entrega.');
  }
  // Do not enqueue a delivery while another tab owns unsaved fleet GPS.
  // Enqueue while holding the same lock as GPS writes; the transition checks
  // again after reacquiring it. A blocked delivery must not disable recovery.
  let referencia: string;
  try { referencia = newGpsPointId(); }
  catch { throw new Error('No se pudo preparar una referencia segura para la entrega. Consultá a soporte.'); }
  const saved = await withGpsTransitionLock(id, async () => {
    if (!isCurrent()) throw new Error('La cuenta o actividad cambió. Volvé a abrir el viaje antes de confirmar la entrega.');
    assertNoStoredFleetGpsForManifest(id);
    // An offline delivery would stop tracking in another activity and could
    // make its pending locations impossible to recover from that screen.
    assertNoOtherGpsQueue(context.userId, id, gpsContextScope(context.owner, requestContext));
    return enqueueDeliveryOnce({ type: 'POST', endpoint: `/manifiestos/${id}/confirmar-entrega-idempotente`,
      data: { ...data, referencia }, userId: context.userId, contextOwner: context.owner });
  });
  if (saved.legacy) return { status: 'pending', message: 'Hay una entrega anterior pendiente en este dispositivo. Revisá el manifiesto antes de reintentarla.' };
  const pending = (message: string): DeliveryOutcome => ({ status: 'pending', message });
  if (saved.reused) {
    const prior = saved.action.data as ConfirmarEntregaRequest | null;
    const fields = (value: ConfirmarEntregaRequest | null) => JSON.stringify([value?.observaciones ?? null, value?.latitud ?? null, value?.longitud ?? null]);
    if (fields(prior) !== fields(data)) return pending('Ya hay una entrega guardada con datos anteriores. Revisá su sincronización antes de enviar otros datos.');
  }
  if (!isCurrent()) return pending('La entrega quedó guardada en la actividad original. Volvé a esa actividad para revisarla.');
  if (!navigator.onLine) return pending('La entrega quedó guardada. Se intentará enviar al reconectar con la misma cuenta y actividad.');
  const queueId = saved.action.id;
  if (queueId == null) return pending('La entrega quedó guardada. Revisá su sincronización antes de continuar.');
  const executionContext = { owner: context.owner, gpsOwner: gpsContextScope(context.owner, requestContext), role: context.role, companyScoped: context.companyScoped };
  try {
    let attempt = await processSyncQueue(context.userId, executionContext, true, isCurrent, queueId);
    let remaining = (await getSyncQueue()).find(action => action.id === queueId);
    // A transport error cannot tell whether the server committed. A single
    // replay uses the saved reference and is safe even if it did commit.
    if (remaining?.lastFailureUncertain && navigator.onLine && isCurrent()) {
      attempt = await processSyncQueue(context.userId, executionContext, true, isCurrent, queueId);
      remaining = (await getSyncQueue()).find(action => action.id === queueId);
    }
    if (!isCurrent()) return pending('La entrega quedó asociada a la actividad original. Volvé a esa actividad para revisar su resultado.');
    if (!remaining) return { status: 'confirmed' };
    if (remaining.failureKind === 'auth') return pending('La entrega quedó guardada. Revisá tu sesión y volvé a intentar desde la actividad original.');
    if (remaining.failureKind === 'terminal') return pending(`La entrega quedó guardada para revisión. ${remaining.lastError || 'Revisá el estado del manifiesto.'}`);
    return pending(remaining.lastError || attempt.lastError || 'La entrega quedó guardada. Reintentá su confirmación cuando haya conexión.');
  } catch {
    return pending('La entrega quedó guardada, pero no pudimos comprobar su resultado. Revisá la sincronización antes de continuar.');
  } finally {
    // Update the global notice after the targeted attempt without processing
    // unrelated terminal changes as part of this explicit delivery.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_QUEUE_WAKE_EVENT));
  }
}

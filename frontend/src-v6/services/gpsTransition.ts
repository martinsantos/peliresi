import api from './api';
import { GpsPendingError, flushStoredGpsQueue, runExclusiveGpsTask, sendIdempotentGps } from './gpsQueue';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';

/** Flush this device's owned queue before a delivery or handoff. This does not
 * guarantee that another device has no unsent points. */
export async function withStoredGpsBeforeTransition<T>(ownerId: string | number | undefined, manifestId: string, transition: () => Promise<T>): Promise<T> {
  const owner = ownerId == null ? '' : String(ownerId);
  const context = supportRequestContext();
  const ensureSession = () => {
    if (!owner || !context || !supportSessionMatches(owner) || supportRequestContext() !== context) {
      throw new GpsPendingError('La cuenta o actividad cambió. Volvé a abrir el viaje y revisá las ubicaciones pendientes antes de continuar.');
    }
  };
  ensureSession();
  let result!: T;
  await runExclusiveGpsTask(manifestId, async () => {
    ensureSession();
    try {
      await flushStoredGpsQueue(owner, manifestId, async point => {
        ensureSession();
        await sendIdempotentGps(api, manifestId, point);
        // If the session changed during the response, retain the point; its
        // stable reference makes a later retry safe for the original owner.
        ensureSession();
      });
    } catch (error) {
      if (error instanceof GpsPendingError) throw error;
      if (error instanceof Error && /sin titular identificado|leer las ubicaciones|guardar las ubicaciones/.test(error.message)) {
        throw new GpsPendingError(`Ubicaciones pendientes. ${error.message}`);
      }
      throw new GpsPendingError('Ubicaciones pendientes. No se pudieron sincronizar. Revisá la conexión y volvé a intentar.');
    }
    ensureSession();
    result = await transition();
  });
  return result;
}

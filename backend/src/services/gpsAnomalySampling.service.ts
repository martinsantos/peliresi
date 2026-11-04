import { isTrainingSession } from '../lib/trainingScope';
import logger from '../utils/logger';

type Detector = (manifestId: string, userId?: string) => Promise<unknown>;
const counts = new Map<string, number>();
const key = (id: string) => `${isTrainingSession() ? 'training' : 'operational'}:${id}`;

/** Best-effort sampling after a GPS point commits. This counter belongs to one
 * worker only; it is not a durable queue and cannot guarantee analysis after a
 * crash. Origin and relay share it so a relay is not silently excluded. */
export function sampleGpsAnomalies(manifestId: string, userId: string | undefined, detector: Detector): void {
  const scope = key(manifestId);
  const count = (counts.get(scope) ?? 0) + 1;
  if (count < 10) { counts.set(scope, count); return; }
  counts.delete(scope);
  setImmediate(() => {
    void detector(manifestId, userId).catch(error => {
      logger.error({ manifiestoId: manifestId, error: error instanceof Error ? error.message : String(error) },
        'GPS anomaly analysis failed after position was saved');
    });
  });
}

export function clearGpsAnomalySampling(manifestId: string): void {
  counts.delete(key(manifestId));
}

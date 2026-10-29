import { toast } from '../components/ui/Toast';

/** Observations that could not be written are held only in this page's memory.
 * Keys contain the original account/activity scope; no capability is stored. */
export interface FleetGpsObservation {
  point: { latitud: number; longitud: number; precision: number; velocidad?: number; direccion?: number };
  observedAt: number;
  fingerprint: string | null;
  references: Map<string, string>;
}
const volatile = new Map<string, FleetGpsObservation>();
const notices = new Map<string, string>();
const warn = (event: BeforeUnloadEvent) => { if (volatile.size) { event.preventDefault(); event.returnValue = ''; } };
function updateWarning() {
  if (typeof window === 'undefined') return;
  if (volatile.size) window.addEventListener('beforeunload', warn);
  else window.removeEventListener('beforeunload', warn);
}
export function getVolatileFleetObservation(key: string): FleetGpsObservation | undefined { return volatile.get(key); }
export function rememberVolatileFleetObservation(key: string, observation: FleetGpsObservation): void {
  // Never replace an earlier unsaved observation with a newer sensor reading.
  if (!volatile.has(key)) volatile.set(key, observation);
  updateWarning();
}
export function showVolatileFleetWarning(key: string): void {
  if (notices.has(key)) return;
  notices.set(key, toast.add({ type: 'error', title: 'Ubicación GPS sin guardar',
    message: 'No cierres ni recargues SITREP. Volvé en esta ventana a GPS de mis viajes con la misma cuenta y actividad y reintentá.', duration: 0 }));
}
export function clearVolatileFleetObservation(key: string): void {
  volatile.delete(key);
  const notice = notices.get(key); notices.delete(key);
  if (notice && ![...notices.values()].includes(notice)) toast.remove(notice);
  updateWarning();
}

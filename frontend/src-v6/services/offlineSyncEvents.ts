import { GPS_DELIVERY_CONFIRMED_EVENT } from './gpsQueue';

/** Cross-tab messages stay on this origin and are hints, never authorization. */
export const OFFLINE_QUEUE_CHANGED_EVENT = 'sitrep:offline-queue-changed';
export const OFFLINE_QUEUE_WAKE_EVENT = 'sitrep:offline-queue-wake';
const CHANNEL = 'sitrep:offline-sync:v1';
const origin = `${Date.now()}-${Math.random()}`;
type Message = { origin: string; kind: 'queue' } | { origin: string; kind: 'delivered'; id: string; owner: string };
function publish(message: Message) {
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage(message); channel.close(); } catch { /* Focus and polling remain available. */ }
}
function subscribe(kind: Message['kind'], callback: (message: Message) => void) {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = event => {
      const value = event.data as Partial<Message> | null;
      if (!value || value.origin === origin || value.kind !== kind) return;
      if (value.kind === 'delivered' && (typeof value.id !== 'string' || typeof value.owner !== 'string')) return;
      callback(value as Message);
    };
    return () => channel.close();
  } catch { return () => {}; }
}
export function notifyOfflineQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
    publish({ origin, kind: 'queue' });
  }
}
export function subscribeOfflineQueueChanged(callback: () => void) {
  window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, callback);
  const close = subscribe('queue', callback);
  return () => { window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, callback); close(); };
}
export function notifyDeliveryConfirmed(id: string, owner: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GPS_DELIVERY_CONFIRMED_EVENT, { detail: { id, owner } }));
    publish({ origin, kind: 'delivered', id, owner });
  }
}
export function subscribeDeliveryConfirmed(callback: (event: Event) => void) {
  window.addEventListener(GPS_DELIVERY_CONFIRMED_EVENT, callback);
  const close = subscribe('delivered', message => {
    if (message.kind === 'delivered') callback(new CustomEvent(GPS_DELIVERY_CONFIRMED_EVENT, { detail: { id: message.id, owner: message.owner } }));
  });
  return () => { window.removeEventListener(GPS_DELIVERY_CONFIRMED_EVENT, callback); close(); };
}

import { useEffect } from 'react';
import api from '../services/api';

export type DevicePushState = 'unsupported' | 'channel-off' | 'ask' | 'blocked' | 'worker-pending' | 'enabled';
const scopeForPage = () => /^\/app(?:\/|$)/.test(window.location.pathname) ? '/app/' : '/';
function applicationKey(value: string): Uint8Array {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

/** Silent renewal only when permission already exists. The explicit button
 * calls requestPermission synchronously from the user's gesture, before I/O. */
export async function registerDevicePush(askPermission = false, stillCurrent = () => true): Promise<DevicePushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const permission = askPermission && Notification.permission === 'default'
    ? await Notification.requestPermission() : Notification.permission;
  if (!stillCurrent()) throw new Error('La sesión cambió. Volvé a abrir tus avisos.');
  const response = await api.get<{ data: { publicKey: string | null } }>('/push/vapid-key');
  const key = response.data.data.publicKey;
  if (!key) return 'channel-off';
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'ask';
  const scope = scopeForPage();
  const registrations = await navigator.serviceWorker.getRegistrations();
  const registration = registrations.find(item => {
    const url = new URL(item.scope);
    return url.origin === window.location.origin && url.pathname === scope;
  });
  if (!registration?.active) return 'worker-pending';
  if (!stillCurrent()) throw new Error('La sesión cambió. Volvé a abrir tus avisos.');
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: applicationKey(key) as unknown as ArrayBuffer,
  });
  if (!stillCurrent()) throw new Error('La sesión cambió. Volvé a abrir tus avisos.');
  await api.post('/push/subscribe', subscription.toJSON());
  return 'enabled';
}

export function usePushNotifications() {
  useEffect(() => {
    let active = true;
    if ('Notification' in window && Notification.permission === 'granted') void registerDevicePush(false, () => active).catch(() => {});
    return () => { active = false; };
  }, []);
}

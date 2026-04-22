import { useEffect, useRef } from 'react';
import api from '../services/api';

const SW_SCOPE_PWA  = '/app/';
const SW_SCOPE_WEB  = '/';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await api.get<{ data: { publicKey: string } }>('/push/vapid-key');
    return res.data.data.publicKey;
  } catch {
    return null;
  }
}

async function suscribir(registration: ServiceWorkerRegistration, vapidKey: string) {
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
  });
  await api.post('/push/subscribe', sub.toJSON());
}

export function usePushNotifications() {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      const vapidKey = await getVapidKey();
      if (!vapidKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Buscar registration del SW activo (PWA o SPA)
      const registrations = await navigator.serviceWorker.getRegistrations();
      const isPwa = window.location.pathname.startsWith('/app');
      const scope  = isPwa ? SW_SCOPE_PWA : SW_SCOPE_WEB;
      const reg = registrations.find((r) => r.scope.includes(scope)) ?? registrations[0];
      if (!reg) return;

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Renovar en backend por si expiró
        await api.post('/push/subscribe', existing.toJSON()).catch(() => {});
        return;
      }

      await suscribir(reg, vapidKey);
    })().catch(() => {});
  }, []);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

const SW_SCOPE_PWA = '/app/';
const SW_SCOPE_WEB = '/';

export type PushNotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'unavailable'
  | 'prompt'
  | 'denied'
  | 'subscribed'
  | 'error';

export type PushBusyAction = 'activate' | 'deactivate' | 'test' | null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function targetScope(): string {
  return window.location.pathname.startsWith('/app') ? SW_SCOPE_PWA : SW_SCOPE_WEB;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  const scope = targetScope();
  const registrations = await navigator.serviceWorker.getRegistrations();
  const exact = registrations.find((registration) => {
    try {
      return new URL(registration.scope).pathname === scope;
    } catch {
      return false;
    }
  });
  if (exact) return exact;
  return (await navigator.serviceWorker.getRegistration(scope)) ?? null;
}

async function getVapidKey(): Promise<string> {
  const response = await api.get<{ data: { publicKey: string } }>('/push/vapid-key');
  const publicKey = response.data.data?.publicKey;
  if (!publicKey) throw new Error('El servidor no tiene configurada la clave de notificaciones.');
  return publicKey;
}

async function registerSubscription(subscription: PushSubscription): Promise<void> {
  await api.post('/push/subscribe', subscription.toJSON());
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function usePushNotifications() {
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<PushNotificationStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<PushBusyAction>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!isPushSupported()) {
      if (mountedRef.current) {
        setStatus('unsupported');
        setError(null);
      }
      return;
    }

    try {
      if (Notification.permission === 'denied') {
        if (mountedRef.current) {
          setStatus('denied');
          setError(null);
        }
        return;
      }
      if (Notification.permission !== 'granted') {
        if (mountedRef.current) {
          setStatus('prompt');
          setError(null);
        }
        return;
      }

      const registration = await getRegistration();
      if (!registration) {
        if (mountedRef.current) {
          setStatus('unavailable');
          setError('La aplicación todavía no terminó de instalar su servicio de notificaciones. Recargá la página.');
        }
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        if (mountedRef.current) {
          setStatus('prompt');
          setError(null);
        }
        return;
      }

      // A browser subscription can survive logout or impersonation. Rebind it
      // to the currently authenticated principal without prompting the user.
      await registerSubscription(subscription);
      if (mountedRef.current) {
        setStatus('subscribed');
        setError(null);
      }
    } catch (refreshError) {
      if (mountedRef.current) {
        setStatus('error');
        setError(errorMessage(refreshError, 'No se pudo consultar el estado de las notificaciones.'));
      }
    }
  }, []);

  const activate = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return false;
    }

    setBusyAction('activate');
    setError(null);
    try {
      // This must be the first awaited browser action so iOS preserves the
      // user gesture that called activate().
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'prompt');
        return false;
      }

      const [registration, vapidKey] = await Promise.all([getRegistration(), getVapidKey()]);
      if (!registration) {
        setStatus('unavailable');
        setError('No se encontró el servicio de notificaciones. Recargá la aplicación e intentá nuevamente.');
        return false;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });
      await registerSubscription(subscription);
      setStatus('subscribed');
      return true;
    } catch (activationError) {
      setStatus('error');
      setError(errorMessage(activationError, 'No se pudieron activar las notificaciones.'));
      return false;
    } finally {
      setBusyAction(null);
    }
  }, []);

  const deactivate = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setBusyAction('deactivate');
    setError(null);
    try {
      const registration = await getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus(Notification.permission === 'denied' ? 'denied' : 'prompt');
      return true;
    } catch (deactivationError) {
      setStatus('error');
      setError(errorMessage(deactivationError, 'No se pudieron desactivar las notificaciones.'));
      return false;
    } finally {
      setBusyAction(null);
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setBusyAction('test');
    setError(null);
    try {
      const registration = await getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setStatus('prompt');
        setError('Activá las notificaciones antes de enviar la prueba.');
        return false;
      }
      await api.post('/push/test', { endpoint: subscription.endpoint });
      setStatus('subscribed');
      return true;
    } catch (testError) {
      setStatus('error');
      setError(errorMessage(testError, 'No se pudo entregar la notificación de prueba.'));
      return false;
    } finally {
      setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') void refresh();
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      mountedRef.current = false;
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [refresh]);

  return { status, error, busyAction, activate, deactivate, sendTest, refresh };
}

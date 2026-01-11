/**
 * usePushNotifications - Hook for Web Push Notifications
 * Handles permission requests, subscription management, and backend registration
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  checkSubscription: () => Promise<void>;
}

// Convert base64 VAPID key to Uint8Array for Web Push
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
        await checkExistingSubscription();
      }
    };

    checkSupport();
  }, []);

  // Check if already subscribed
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.warn('[Push] Error checking subscription:', e);
    }
  };

  // Get VAPID public key from backend
  const getVapidKey = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/push/vapid-key`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.publicKey || data.vapidPublicKey;
    } catch (e) {
      console.error('[Push] Error getting VAPID key:', e);
      return null;
    }
  };

  // Register subscription with backend
  const registerSubscription = async (subscription: PushSubscription): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
          }
        })
      });

      return response.ok;
    } catch (e) {
      console.error('[Push] Error registering subscription:', e);
      return false;
    }
  };

  // Unregister subscription from backend
  const unregisterSubscription = async (endpoint: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: JSON.stringify({ endpoint })
      });

      return response.ok;
    } catch (e) {
      console.error('[Push] Error unregistering subscription:', e);
      return false;
    }
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications no soportadas en este navegador');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Permisos de notificación denegados');
        setLoading(false);
        return false;
      }

      // 2. Get VAPID public key from backend
      const vapidPublicKey = await getVapidKey();
      if (!vapidPublicKey) {
        setError('No se pudo obtener la clave del servidor');
        setLoading(false);
        return false;
      }

      // 3. Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 4. Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // 5. Create new subscription if needed
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // 6. Register with backend
      const registered = await registerSubscription(subscription);

      if (registered) {
        setIsSubscribed(true);
        console.log('[Push] Successfully subscribed to push notifications');
        setLoading(false);
        return true;
      } else {
        setError('Error registrando en el servidor');
        setLoading(false);
        return false;
      }

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      setError(`Error al suscribirse: ${errorMessage}`);
      console.error('[Push] Subscribe error:', e);
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unregister from backend first
        await unregisterSubscription(subscription.endpoint);

        // Then unsubscribe locally
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      console.log('[Push] Successfully unsubscribed from push notifications');
      setLoading(false);
      return true;

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      setError(`Error al desuscribirse: ${errorMessage}`);
      console.error('[Push] Unsubscribe error:', e);
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  // Force check subscription status
  const checkSubscription = useCallback(async () => {
    await checkExistingSubscription();
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    checkSubscription
  };
}

export default usePushNotifications;

/**
 * Push Notifications Service para SITREP
 * Maneja la suscripción y recepción de notificaciones push en web/móvil
 */

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Verificar si el navegador soporta notificaciones push
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Solicitar permiso de notificaciones
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications no soportadas en este navegador');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permiso de notificaciones:', permission);
  return permission;
}

/**
 * Obtener la clave pública VAPID del servidor
 */
async function getVapidPublicKey(): Promise<string> {
  const response = await fetch(`${API_URL}/push/vapid-key`);
  const data = await response.json();
  return data.data.publicKey;
}

/**
 * Convertir base64 a Uint8Array (para VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Suscribirse a notificaciones push
 */
export async function subscribeToPush(token: string): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    // 1. Verificar permiso
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Permiso denegado');
      return false;
    }

    // 2. Registrar Service Worker si no existe
    const registration = await navigator.serviceWorker.ready;

    // 3. Obtener VAPID key
    const vapidKey = await getVapidPublicKey();

    // 4. Crear suscripción
    const vapidKeyArray = urlBase64ToUint8Array(vapidKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyArray.buffer as ArrayBuffer,
    });

    // 5. Enviar suscripción al servidor
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    
    if (!p256dhKey || !authKey) {
      throw new Error('No se pudieron obtener las claves de suscripción');
    }

    const response = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey)))),
          auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey)))),
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Error al registrar suscripción en el servidor');
    }

    console.log('[Push] Suscripción exitosa');
    return true;
  } catch (error) {
    console.error('[Push] Error en suscripción:', error);
    return false;
  }
}

/**
 * Cancelar suscripción a notificaciones push
 */
export async function unsubscribeFromPush(token: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Notificar al servidor
      await fetch(`${API_URL}/push/unsubscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }

    return true;
  } catch (error) {
    console.error('[Push] Error al cancelar suscripción:', error);
    return false;
  }
}

/**
 * Enviar notificación de prueba
 */
export async function sendTestNotification(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Error enviando prueba:', error);
    return false;
  }
}

/**
 * Verificar si ya está suscrito
 */
export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

export default {
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
  isSubscribedToPush,
};

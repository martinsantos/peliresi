/**
 * Push Notification Service
 * 
 * Servicio para manejar notificaciones push en el navegador.
 * Utiliza Web Push API con VAPID para autenticación.
 */

// VAPID Public Key - debe coincidir con la del backend
// Generada con: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

class PushNotificationService {
    private swRegistration: ServiceWorkerRegistration | null = null;
    private subscription: PushSubscription | null = null;

    /**
     * Verifica si las notificaciones push están soportadas
     */
    isSupported(): boolean {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    /**
     * Verifica el estado actual del permiso de notificaciones
     */
    getPermissionStatus(): NotificationPermission {
        return Notification.permission;
    }

    /**
     * Solicita permiso para mostrar notificaciones
     */
    async requestPermission(): Promise<NotificationPermission> {
        const permission = await Notification.requestPermission();
        console.log('🔔 Push permission:', permission);
        return permission;
    }

    /**
     * Inicializa el Service Worker y prepara para push
     */
    async initialize(): Promise<boolean> {
        if (!this.isSupported()) {
            console.warn('⚠️ Push notifications no soportadas');
            return false;
        }

        try {
            // Registrar o obtener el Service Worker
            this.swRegistration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker listo para push');

            // Verificar suscripción existente
            this.subscription = await this.swRegistration.pushManager.getSubscription();
            if (this.subscription) {
                console.log('📬 Suscripción push existente encontrada');
            }

            return true;
        } catch (error) {
            console.error('❌ Error inicializando push:', error);
            return false;
        }
    }

    /**
     * Convierte la VAPID key de base64 a Uint8Array
     */
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Suscribe al usuario para recibir notificaciones push
     */
    async subscribe(): Promise<PushSubscriptionData | null> {
        if (!this.swRegistration) {
            console.error('❌ Service Worker no registrado');
            return null;
        }

        const permission = await this.requestPermission();
        if (permission !== 'granted') {
            console.warn('⚠️ Permiso de notificaciones denegado');
            return null;
        }

        try {
            const applicationServerKey = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            
            this.subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey.buffer as ArrayBuffer
            });

            console.log('✅ Suscripción push creada');

            // Extraer datos de la suscripción
            const subscriptionData: PushSubscriptionData = {
                endpoint: this.subscription.endpoint,
                keys: {
                    p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')),
                    auth: this.arrayBufferToBase64(this.subscription.getKey('auth'))
                }
            };

            // Enviar al backend para guardar
            await this.sendSubscriptionToServer(subscriptionData);

            return subscriptionData;
        } catch (error) {
            console.error('❌ Error creando suscripción push:', error);
            return null;
        }
    }

    /**
     * Cancela la suscripción de push
     */
    async unsubscribe(): Promise<boolean> {
        if (!this.subscription) {
            return true;
        }

        try {
            await this.subscription.unsubscribe();
            this.subscription = null;
            console.log('✅ Suscripción push cancelada');
            return true;
        } catch (error) {
            console.error('❌ Error cancelando suscripción:', error);
            return false;
        }
    }

    /**
     * Verifica si el usuario está suscrito
     */
    isSubscribed(): boolean {
        return this.subscription !== null;
    }

    /**
     * Convierte ArrayBuffer a base64
     */
    private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
        if (!buffer) return '';
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Envía la suscripción al servidor backend
     */
    private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
        try {
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                },
                body: JSON.stringify(subscription)
            });

            if (!response.ok) {
                throw new Error('Error guardando suscripción');
            }

            console.log('✅ Suscripción guardada en servidor');
        } catch (error) {
            console.error('⚠️ No se pudo guardar suscripción en servidor:', error);
            // No lanzamos error porque la suscripción local funciona igual
        }
    }

    /**
     * Muestra una notificación local (para testing)
     */
    async showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (!this.swRegistration) {
            console.error('❌ Service Worker no registrado');
            return;
        }

        const defaultOptions: NotificationOptions = {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: 'sitrep-notification',
            ...options
        };

        await this.swRegistration.showNotification(title, defaultOptions);
    }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();

// Hook para usar en componentes React
import { useState, useEffect } from 'react';

export const usePushNotifications = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const supported = pushNotificationService.isSupported();
            setIsSupported(supported);

            if (supported) {
                setPermission(pushNotificationService.getPermissionStatus());
                await pushNotificationService.initialize();
                setIsSubscribed(pushNotificationService.isSubscribed());
            }

            setLoading(false);
        };

        init();
    }, []);

    const subscribe = async () => {
        setLoading(true);
        const result = await pushNotificationService.subscribe();
        setIsSubscribed(result !== null);
        setPermission(pushNotificationService.getPermissionStatus());
        setLoading(false);
        return result;
    };

    const unsubscribe = async () => {
        setLoading(true);
        const result = await pushNotificationService.unsubscribe();
        setIsSubscribed(!result);
        setLoading(false);
        return result;
    };

    const showNotification = (title: string, options?: NotificationOptions) => {
        return pushNotificationService.showLocalNotification(title, options);
    };

    return {
        isSupported,
        isSubscribed,
        permission,
        loading,
        subscribe,
        unsubscribe,
        showNotification
    };
};

export default pushNotificationService;

/**
 * usePushNotifications - Hook for managing Web Push Notifications
 * Provides easy integration with app flows and automatic subscription
 *
 * Features:
 * - Auto-prompt on first login
 * - Permission status tracking
 * - Subscribe/unsubscribe handling
 * - Notification event handling
 */

import { useState, useEffect, useCallback } from 'react';
import pushNotifications from '../services/pushNotifications';

// Storage keys
const PUSH_PROMPT_SHOWN_KEY = 'sitrep_push_prompt_shown';
const PUSH_PERMISSION_KEY = 'sitrep_push_permission';

interface UsePushNotificationsOptions {
    /** Auth token for API calls */
    token?: string | null;
    /** Callback when permission is granted */
    onPermissionGranted?: () => void;
    /** Callback when permission is denied */
    onPermissionDenied?: () => void;
    /** Callback when a notification is received */
    onNotificationReceived?: (data: any) => void;
    /** Auto-prompt on first use */
    autoPrompt?: boolean;
}

interface UsePushNotificationsReturn {
    /** Whether push is supported by the browser */
    isSupported: boolean;
    /** Current permission state */
    permission: NotificationPermission | 'unknown';
    /** Whether user is subscribed to push */
    isSubscribed: boolean;
    /** Whether subscription is in progress */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Whether the permission prompt has been shown before */
    hasPrompted: boolean;

    /** Request permission and subscribe */
    subscribe: () => Promise<boolean>;
    /** Unsubscribe from push notifications */
    unsubscribe: () => Promise<boolean>;
    /** Send a test notification */
    sendTest: () => Promise<boolean>;
    /** Show permission prompt (if not shown before) */
    promptForPermission: () => Promise<boolean>;
    /** Dismiss the prompt (mark as shown) */
    dismissPrompt: () => void;
}

export function usePushNotifications({
    token,
    onPermissionGranted,
    onPermissionDenied,
    onNotificationReceived,
    autoPrompt = false
}: UsePushNotificationsOptions = {}): UsePushNotificationsReturn {
    const [isSupported] = useState(() => pushNotifications.isPushSupported());
    const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasPrompted, setHasPrompted] = useState(false);

    // Check initial state on mount
    useEffect(() => {
        if (!isSupported) return;

        // Check current permission
        const currentPermission = Notification.permission;
        setPermission(currentPermission);
        localStorage.setItem(PUSH_PERMISSION_KEY, currentPermission);

        // Check if prompt was shown before
        const prompted = localStorage.getItem(PUSH_PROMPT_SHOWN_KEY) === 'true';
        setHasPrompted(prompted);

        // Check subscription status
        pushNotifications.isSubscribedToPush().then(setIsSubscribed);
    }, [isSupported]);

    // Set up notification event listener
    useEffect(() => {
        if (!isSupported || !onNotificationReceived) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'PUSH_RECEIVED') {
                onNotificationReceived(event.data.payload);
            }
        };

        navigator.serviceWorker?.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
    }, [isSupported, onNotificationReceived]);

    // Auto-prompt logic
    useEffect(() => {
        if (
            autoPrompt &&
            isSupported &&
            token &&
            !hasPrompted &&
            permission === 'default'
        ) {
            // Small delay to not overwhelm user immediately after login
            const timeout = setTimeout(() => {
                // Don't auto-subscribe, just mark that we could prompt
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [autoPrompt, isSupported, token, hasPrompted, permission]);

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !token) {
            setError('Push notifications no soportadas o sin autenticacion');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            const success = await pushNotifications.subscribeToPush(token);

            if (success) {
                setIsSubscribed(true);
                setPermission('granted');
                localStorage.setItem(PUSH_PERMISSION_KEY, 'granted');
                onPermissionGranted?.();
            } else {
                setPermission(Notification.permission);
                if (Notification.permission === 'denied') {
                    onPermissionDenied?.();
                }
            }

            // Mark prompt as shown
            setHasPrompted(true);
            localStorage.setItem(PUSH_PROMPT_SHOWN_KEY, 'true');

            return success;
        } catch (err) {
            setError((err as Error).message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, token, onPermissionGranted, onPermissionDenied]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !token) return false;

        setIsLoading(true);
        setError(null);

        try {
            const success = await pushNotifications.unsubscribeFromPush(token);
            if (success) {
                setIsSubscribed(false);
            }
            return success;
        } catch (err) {
            setError((err as Error).message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, token]);

    const sendTest = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !token) return false;

        try {
            return await pushNotifications.sendTestNotification(token);
        } catch (err) {
            setError((err as Error).message);
            return false;
        }
    }, [isSupported, token]);

    const promptForPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        const result = await pushNotifications.requestNotificationPermission();
        setPermission(result);
        localStorage.setItem(PUSH_PERMISSION_KEY, result);
        setHasPrompted(true);
        localStorage.setItem(PUSH_PROMPT_SHOWN_KEY, 'true');

        if (result === 'granted') {
            onPermissionGranted?.();
            // Auto-subscribe after permission granted
            if (token) {
                return subscribe();
            }
        } else if (result === 'denied') {
            onPermissionDenied?.();
        }

        return result === 'granted';
    }, [isSupported, token, subscribe, onPermissionGranted, onPermissionDenied]);

    const dismissPrompt = useCallback(() => {
        setHasPrompted(true);
        localStorage.setItem(PUSH_PROMPT_SHOWN_KEY, 'true');
    }, []);

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        error,
        hasPrompted,
        subscribe,
        unsubscribe,
        sendTest,
        promptForPermission,
        dismissPrompt
    };
}

// Component for showing push notification prompt
export interface PushPromptProps {
    onAccept: () => void;
    onDecline: () => void;
}

export default usePushNotifications;

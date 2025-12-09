import { useState, useEffect } from 'react';

interface ConnectivityState {
    isOnline: boolean;
    wasOffline: boolean;
    lastOnlineAt: Date | null;
    syncPending: boolean;
}

export const useConnectivity = () => {
    const [state, setState] = useState<ConnectivityState>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        lastOnlineAt: null,
        syncPending: false
    });

    useEffect(() => {
        const handleOnline = () => {
            setState(prev => ({
                ...prev,
                isOnline: true,
                wasOffline: true,
                lastOnlineAt: new Date(),
                syncPending: true
            }));

            // Simulate sync completion after 2 seconds
            setTimeout(() => {
                setState(prev => ({ ...prev, syncPending: false }));
            }, 2000);
        };

        const handleOffline = () => {
            setState(prev => ({
                ...prev,
                isOnline: false,
                wasOffline: true
            }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial state
        if (navigator.onLine) {
            setState(prev => ({ ...prev, isOnline: true, lastOnlineAt: new Date() }));
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return state;
};

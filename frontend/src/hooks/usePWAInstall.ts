import { useState, useEffect } from 'react';

interface PWAInstallState {
    canInstall: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    promptInstall: () => Promise<boolean>;
}

export const usePWAInstall = (): PWAInstallState => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
            console.log('[PWA] Install prompt ready');
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
            console.log('[PWA] App installed successfully');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Returns true if native prompt was used, false otherwise
    const promptInstall = async (): Promise<boolean> => {
        if (!deferredPrompt) {
            // No native prompt available
            return false;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setCanInstall(false);
            }
            setDeferredPrompt(null);
            return true;
        } catch (error) {
            console.error('Error al instalar PWA:', error);
            return false;
        }
    };

    return {
        canInstall,
        isInstalled,
        isIOS,
        promptInstall
    };
};


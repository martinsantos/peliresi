import { useState, useEffect } from 'react';

interface PWAInstallState {
    canInstall: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    promptInstall: () => Promise<void>;
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
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) {
            // For iOS, show instructions
            if (isIOS) {
                alert('Para instalar en iOS:\n\n1. Toca el botón "Compartir" (□↑)\n2. Selecciona "Agregar a pantalla de inicio"\n3. Confirma tocando "Agregar"');
            } else {
                // Show Chrome manual install instructions
                alert('Para instalar en Chrome:\n\n1. Abre el menú ⋮ (tres puntos verticales)\n2. Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio"\n\nSi no ves esta opción:\n• Navega un poco por la app primero\n• Chrome requiere cierta interacción antes de ofrecer la instalación');
            }
            return;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setCanInstall(false);
            }
            setDeferredPrompt(null);
        } catch (error) {
            console.error('Error al instalar PWA:', error);
        }
    };

    return {
        canInstall,
        isInstalled,
        isIOS,
        promptInstall
    };
};

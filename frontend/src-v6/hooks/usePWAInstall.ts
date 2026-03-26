/**
 * SITREP v6 - PWA Install Hook
 * =============================
 * Detecta instalabilidad PWA, gestiona el prompt nativo
 * y detecta iOS Safari (que no dispara beforeinstallprompt).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UsePWAInstallReturn {
  /** True when the native install prompt is available (Android/Desktop) */
  canInstall: boolean;
  /** True when the app is already running as standalone/installed */
  isInstalled: boolean;
  /** True when on iOS Safari (manual install instructions needed) */
  isIOS: boolean;
  /** Trigger the native install prompt; resolves after user choice */
  promptInstall: () => Promise<void>;
}

export function usePWAInstall(): UsePWAInstallReturn {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // --- Detect iOS Safari ---
  // MSStream exists only on IE; standalone is iOS-specific
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !('MSStream' in window);

  // --- Detect standalone (already installed) ---
  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const check = () => setIsInstalled(mql.matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true));
    check();
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  // --- Listen for beforeinstallprompt ---
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If app gets installed while open, clear the prompt
    const installedHandler = () => {
      setCanInstall(false);
      setIsInstalled(true);
      deferredPrompt.current = null;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // --- Trigger native prompt ---
  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      setCanInstall(false);
      setIsInstalled(true);
    }
    deferredPrompt.current = null;
  }, []);

  return { canInstall, isInstalled, isIOS, promptInstall };
}

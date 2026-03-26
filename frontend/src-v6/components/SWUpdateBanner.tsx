/**
 * SITREP v6 - Service Worker Update Banner
 * ==========================================
 * Shows a non-intrusive banner when a new SW version is available.
 * User can tap to reload and activate the update.
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export const SWUpdateBanner: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;

    const handleControllerChange = () => {
      setShowUpdate(true);
    };

    const handleStateChange = () => {
      if (installingWorker?.state === 'installed' && navigator.serviceWorker.controller) {
        setShowUpdate(true);
      }
    };

    const handleUpdateFound = () => {
      installingWorker = registration?.installing ?? null;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', handleStateChange);
    };

    // Detect when a new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Also check if there's a waiting worker already
    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      if (reg.waiting) {
        setShowUpdate(true);
      }
      reg.addEventListener('updatefound', handleUpdateFound);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      registration?.removeEventListener('updatefound', handleUpdateFound);
      installingWorker?.removeEventListener('statechange', handleStateChange);
    };
  }, []);

  const handleUpdate = () => {
    // Tell the waiting SW to skip waiting
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    // Reload to activate
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in-up">
      <button
        onClick={handleUpdate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white text-sm font-medium shadow-lg active:scale-[0.98] transition-transform"
      >
        <RefreshCw size={16} />
        Nueva versión disponible — Toca para actualizar
      </button>
    </div>
  );
};

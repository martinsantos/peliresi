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
    <div className="relative z-30 border-b border-primary-800 bg-primary-700 px-3 py-2" role="status" aria-live="polite">
      <button
        onClick={handleUpdate}
        className="mx-auto flex min-h-10 w-full max-w-xl items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700"
      >
        <RefreshCw size={16} />
        Nueva versión disponible — Toca para actualizar
      </button>
    </div>
  );
};

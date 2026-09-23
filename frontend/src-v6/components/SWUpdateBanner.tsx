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
  const [updating, setUpdating] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;
    let mounted = true;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      if (hadController) setShowUpdate(true);
      hadController = true;
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
      if (!mounted) return;
      registration = reg;
      if (reg.waiting) {
        setShowUpdate(true);
      }
      reg.addEventListener('updatefound', handleUpdateFound);
    });

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      registration?.removeEventListener('updatefound', handleUpdateFound);
      installingWorker?.removeEventListener('statechange', handleStateChange);
    };
  }, []);

  const handleUpdate = async () => {
    const beforeUpdate = new CustomEvent<{ reason?: string }>('sitrep:before-app-update', { cancelable: true, detail: {} });
    window.dispatchEvent(beforeUpdate);
    if (beforeUpdate.defaultPrevented) {
      setBlockedReason(beforeUpdate.detail.reason || 'Guardá o resolvé el trabajo pendiente antes de actualizar.');
      return;
    }
    setBlockedReason('');
    setUpdating(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        await new Promise<void>((resolve) => {
          let timer = 0;
          const activated = () => { window.clearTimeout(timer); resolve(); };
          navigator.serviceWorker.addEventListener('controllerchange', activated, { once: true });
          timer = window.setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', activated); resolve(); }, 3000);
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
      }
      window.location.reload();
    } catch {
      setBlockedReason('No se pudo preparar la actualización. Seguí trabajando y volvé a intentar.');
      setUpdating(false);
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="relative z-30 border-b border-primary-800 bg-primary-700 px-3 py-2" role="status" aria-live="polite">
      <button
        onClick={() => void handleUpdate()}
        disabled={updating}
        className="mx-auto flex min-h-10 w-full max-w-xl items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700"
      >
        <RefreshCw size={16} />
        {updating ? 'Preparando actualización…' : 'Nueva versión disponible — Actualizar cuando termines'}
      </button>
      {blockedReason && <p role="alert" className="mx-auto mt-2 max-w-xl text-sm font-semibold text-white">{blockedReason}</p>}
    </div>
  );
};

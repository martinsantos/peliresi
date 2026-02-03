/**
 * SITREP v6 - ConnectivityIndicator
 * ==================================
 * Barra visual que aparece cuando se pierde la conexion y muestra un
 * mensaje breve de "Conexion restaurada" al volver.
 * Usa Tailwind con la paleta warning-* / success-* del proyecto.
 */

import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity';

export const ConnectivityIndicator: React.FC = () => {
  const { isOnline } = useConnectivity({ enablePing: false });

  // Track whether we've ever been offline so we can show "restored" message
  const hasBeenOffline = useRef(false);
  const [showRestored, setShowRestored] = useState(false);
  const restoredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      hasBeenOffline.current = true;
      setShowRestored(false);
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
    } else if (hasBeenOffline.current) {
      // Just came back online
      setShowRestored(true);
      restoredTimer.current = setTimeout(() => {
        setShowRestored(false);
        hasBeenOffline.current = false;
      }, 3_000);
    }

    return () => {
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
    };
  }, [isOnline]);

  // Nothing to render when online and no restored message
  if (isOnline && !showRestored) return null;

  const isOffline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
        transition-all duration-500 ease-out
        ${isOffline
          ? 'bg-warning-100 text-warning-700 border-b border-warning-200'
          : 'bg-success-100 text-success-700 border-b border-success-200'
        }
        animate-fade-in-down
      `}
    >
      {isOffline ? (
        <>
          <WifiOff size={16} className="shrink-0" />
          <span>Sin conexion - Los cambios se guardaran localmente</span>
        </>
      ) : (
        <>
          <Wifi size={16} className="shrink-0" />
          <span>Conexion restaurada</span>
        </>
      )}
    </div>
  );
};

export default ConnectivityIndicator;

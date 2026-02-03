/**
 * SITREP v6 - useConnectivity Hook
 * =================================
 * Monitorea el estado de conectividad del navegador y opcionalmente
 * verifica la accesibilidad real del API con un ping al health endpoint.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue } from '../services/indexeddb';

export interface ConnectivityState {
  /** true si navigator.onLine reporta conectividad */
  isOnline: boolean;
  /** true si el API respondió al último health check */
  isApiReachable: boolean;
  /** Última vez que se detectó conexión activa */
  lastOnline: Date | null;
}

interface UseConnectivityOptions {
  /** URL del health endpoint (relativo al origin). Default: '/api/health' */
  healthEndpoint?: string;
  /** Intervalo en ms para verificar el API cuando hay red. Default: 30000 (30s) */
  pingInterval?: number;
  /** Delay en ms para debounce de cambios de estado. Default: 1000 */
  debounceMs?: number;
  /** Habilitar ping al API. Default: true */
  enablePing?: boolean;
}

export function useConnectivity(options: UseConnectivityOptions = {}): ConnectivityState {
  const {
    healthEndpoint = '/api/health',
    pingInterval = 30_000,
    debounceMs = 1_000,
    enablePing = true,
  } = options;

  const [state, setState] = useState<ConnectivityState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isApiReachable: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastOnline: typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null,
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(!navigator.onLine);

  // Debounced state update to avoid flickering
  const updateState = useCallback(
    (partial: Partial<ConnectivityState>) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setState((prev) => {
          const next = { ...prev, ...partial };
          // Update lastOnline when coming back online
          if (next.isOnline && !prev.isOnline) {
            next.lastOnline = new Date();
          }
          return next;
        });
      }, debounceMs);
    },
    [debounceMs],
  );

  // Ping the API health endpoint
  const checkApi = useCallback(async () => {
    if (!enablePing || !navigator.onLine) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const url = healthEndpoint.startsWith('http')
        ? healthEndpoint
        : `${baseUrl}${healthEndpoint.replace(/^\/api/, '')}`;
      const res = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      updateState({ isApiReachable: res.ok });
    } catch {
      updateState({ isApiReachable: false });
    }
  }, [enablePing, healthEndpoint, updateState]);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      updateState({ isOnline: true, lastOnline: new Date() });
      // When coming back online, check API and process sync queue
      if (wasOffline.current) {
        wasOffline.current = false;
        checkApi();
        processSyncQueue().then((count) => {
          if (count > 0) {
            console.log(`[Connectivity] ${count} acciones sincronizadas`);
          }
        }).catch(() => {
          // Silently handle sync errors
        });
      }
    };

    const handleOffline = () => {
      wasOffline.current = true;
      updateState({ isOnline: false, isApiReachable: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [updateState, checkApi]);

  // Periodic API ping
  useEffect(() => {
    if (!enablePing) return;

    checkApi(); // initial check
    const id = setInterval(checkApi, pingInterval);
    return () => clearInterval(id);
  }, [enablePing, pingInterval, checkApi]);

  return state;
}

export default useConnectivity;

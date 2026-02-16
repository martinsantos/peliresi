/**
 * SITREP v6 - Offline Sync Hook
 * ==============================
 * Auto-syncs data to IndexedDB when online. Mount in MobileLayout.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from './useConnectivity';
import { syncOfflineData } from '../services/offline-sync';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useOfflineSync(): void {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity({ enablePing: false });
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || !isOnline) return;

    const doSync = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await syncOfflineData(currentUser.id);
      } catch {
        // Silent fail — offline sync is best-effort
      } finally {
        syncingRef.current = false;
      }
    };

    // Sync immediately on mount (login)
    doSync();

    // Re-sync every 5 minutes while online
    const interval = setInterval(doSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentUser?.id, isOnline]);
}

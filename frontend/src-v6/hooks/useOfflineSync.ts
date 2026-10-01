/**
 * SITREP v6 - Offline Sync Hook
 * ==============================
 * Auto-syncs data to IndexedDB when online. Mount in MobileLayout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from './useConnectivity';
import { syncOfflineData } from '../services/offline-sync';
import { processSyncQueue, type SyncQueueResult } from '../services/indexeddb';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface OfflineSyncStatus extends SyncQueueResult {
  syncing: boolean;
  retry: () => Promise<void>;
}

const EMPTY_RESULT: SyncQueueResult = { processed: 0, pending: 0, retryable: 0, terminal: 0, auth: 0, skipped: 0 };

export function useOfflineSync({ downloadManifests = true }: { downloadManifests?: boolean } = {}): OfflineSyncStatus {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity({ enablePing: false });
  const syncingRef = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncQueueResult>(EMPTY_RESULT);

  const doSync = useCallback(async (manual = false) => {
    if (!currentUser?.id || !isOnline) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        setResult(await processSyncQueue(currentUser.id, manual));
        if (downloadManifests && document.visibilityState !== 'hidden') await syncOfflineData(currentUser.id);
      } catch (error) {
        setResult((current) => ({ ...current, lastError: error instanceof Error ? error.message : 'No se pudo leer la cola local.' }));
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
  }, [currentUser?.id, isOnline, downloadManifests]);

  useEffect(() => {
    if (!currentUser?.id || !isOnline) return;

    // Sync immediately on mount (login)
    void doSync();

    // Re-sync every 5 minutes while online
    const interval = setInterval(() => void doSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentUser?.id, isOnline, doSync]);

  return { ...result, syncing, retry: async () => { await doSync(true); } };
}

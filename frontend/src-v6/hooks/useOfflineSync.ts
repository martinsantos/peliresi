import { useQueryOwner } from './useQueryOwner';
import { supportRequestContext } from '../utils/supportSession';
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
import { getAccessToken } from '../services/api';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface OfflineSyncStatus extends SyncQueueResult {
  syncing: boolean;
  retry: () => Promise<void>;
}

const EMPTY_RESULT: SyncQueueResult = { processed: 0, pending: 0, retryable: 0, terminal: 0, auth: 0, skipped: 0 };

export function useOfflineSync({ downloadManifests = true, enabled = true }: { downloadManifests?: boolean; enabled?: boolean } = {}): OfflineSyncStatus {
  const { currentUser, isRestricted } = useAuth();
  const { isOnline } = useConnectivity({ enablePing: false });
  const owner = useQueryOwner();
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const syncingRef = useRef(false);
  const resyncRequested = useRef(false);
  const [syncRequest, setSyncRequest] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncQueueResult>(EMPTY_RESULT);
  const resultOwner = useRef(owner);

  useEffect(() => {
    if (!enabled || resultOwner.current !== owner) {
      resultOwner.current = owner;
      setResult(EMPTY_RESULT);
    }
  }, [enabled, owner]);

  const doSync = useCallback(async (manual = false) => {
    if (!enabled || !currentUser?.id || !owner || !isOnline || isRestricted) return;
      if (syncingRef.current) { resyncRequested.current = true; return; }
      syncingRef.current = true;
      setSyncing(true);
      const context = supportRequestContext();
      let token: string | null = null;
      try { token = getAccessToken(); } catch { /* Storage may be unavailable. */ }
      if (!token) {
        syncingRef.current = false;
        setSyncing(false);
        setResult({ ...EMPTY_RESULT, auth:1, lastError:'No se pudo verificar la sesión. Volvé a ingresar antes de sincronizar.' });
        return;
      }
      const matches = () => {
        try { return activeOwner.current === owner && context === supportRequestContext() && getAccessToken() === token; }
        catch { return false; }
      };
      try {
        const next = await processSyncQueue(currentUser.id, manual, matches);
        if (!matches()) return;
        setResult(next);
        if (downloadManifests && document.visibilityState !== 'hidden') await syncOfflineData(currentUser.id, owner);
      } catch (error) {
        if (!matches()) return;
        setResult((current) => ({ ...current, lastError: error instanceof Error ? error.message : 'No se pudo leer la cola local.' }));
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        if (!matches()) resyncRequested.current = true;
        if (resyncRequested.current) {
          resyncRequested.current = false;
          setSyncRequest(value => value + 1);
        }
      }
  }, [currentUser?.id, owner, isOnline, isRestricted, downloadManifests, enabled]);

  useEffect(() => {
    if (!enabled || !currentUser?.id || !owner || !isOnline || isRestricted) return;

    // Sync immediately on mount (login)
    void doSync();

    // Re-sync every 5 minutes while online
    const interval = setInterval(() => void doSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentUser?.id, owner, isOnline, isRestricted, doSync, enabled, syncRequest]);

  return { ...result, syncing, retry: async () => { await doSync(true); } };
}

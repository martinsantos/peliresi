/**
 * SITREP v6 - Offline Sync Service
 * =================================
 * Downloads and caches data to IndexedDB for offline use.
 * Data is scoped per user (key: `user_{userId}`) for multi-user isolation.
 */

import { saveOffline, getOffline, removeOffline } from './indexeddb';
import { manifiestoService } from './manifiesto.service';
import type { Manifiesto } from '../types/models';

interface CachedManifiestos {
  id: string;
  items: Manifiesto[];
  syncedAt: number;
}

/**
 * Download manifiestos from API and cache in IndexedDB, scoped by userId.
 */
export async function syncOfflineData(userId: string | number): Promise<void> {
  // Fetch manifiestos (the list endpoint already filters by role server-side)
  const response = await manifiestoService.list({ limit: 200 });
  const items = response?.items || [];

  await saveOffline('manifiestos', {
    id: `user_${userId}`,
    items: Array.isArray(items) ? items : [],
    syncedAt: Date.now(),
  } satisfies CachedManifiestos);
}

/**
 * Get cached manifiestos for a specific user.
 */
export async function getCachedManifiestos(userId: string | number): Promise<Manifiesto[]> {
  try {
    const cached: CachedManifiestos | null = await getOffline('manifiestos', `user_${userId}`);
    return cached?.items || [];
  } catch {
    return [];
  }
}

/**
 * Get the timestamp of the last sync for a user.
 */
export async function getLastSyncTime(userId: string | number): Promise<number | null> {
  try {
    const cached: CachedManifiestos | null = await getOffline('manifiestos', `user_${userId}`);
    return cached?.syncedAt || null;
  } catch {
    return null;
  }
}

/**
 * Clear all offline data for a specific user (called on logout).
 */
export async function clearUserOfflineData(userId: string | number): Promise<void> {
  await removeOffline('manifiestos', `user_${userId}`).catch(() => {});
  await removeOffline('catalogos', `user_${userId}`).catch(() => {});
}

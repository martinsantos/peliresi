/** Downloadable copies are isolated by the server-verified UI context. */
import { updateOffline, getOffline, getAllOffline, removeOffline } from './indexeddb';
import { manifiestoService } from './manifiesto.service';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import type { Manifiesto } from '../types/models';

const accountCacheKey = (userId: string | number, owner: string) =>
  userId && owner ? 'context-v2:' + JSON.stringify([String(userId), owner]) : '';

interface CachedManifiestos {
  id: string;
  owner: string;
  items: Manifiesto[];
  syncedAt: number;
}

export async function syncOfflineData(userId: string | number, owner: string): Promise<void> {
  const key = accountCacheKey(userId, owner);
  const context = supportRequestContext();
  const assertContext = () => {
    if (!key || !context || !supportSessionMatches(String(userId)) || supportRequestContext() !== context) {
      throw new Error('Cambió el contexto de la cuenta. Volvé a descargar los manifiestos.');
    }
  };
  assertContext();
  const response = await manifiestoService.list({ limit: 200 });
  assertContext();
  if (!Array.isArray(response?.items)) throw new Error('No se recibió una lista válida de manifiestos.');
  await updateOffline<CachedManifiestos>('manifiestos', key, () => {
    assertContext();
    return { id: key, owner, items: response.items, syncedAt: Date.now() };
  });
}

async function readCopy(userId: string | number, owner: string): Promise<CachedManifiestos | null> {
  const key = accountCacheKey(userId, owner);
  if (!key) return null;
  const cached = await getOffline<CachedManifiestos>('manifiestos', key);
  return cached?.owner === owner && Array.isArray(cached.items) ? cached : null;
}

export async function getCachedManifiestos(userId: string | number, owner: string): Promise<Manifiesto[]> {
  return (await readCopy(userId, owner))?.items || [];
}

export async function getLastSyncTime(userId: string | number, owner: string): Promise<number | null> {
  return (await readCopy(userId, owner))?.syncedAt || null;
}

/**
 * Remove re-downloadable local copies on logout. Unsent inspection drafts and
 * evidence remain user-scoped for recovery after the same person signs in again;
 * silently deleting unpublished field work would be unsafe.
 */
export async function clearUserOfflineData(userId: string | number): Promise<void> {
  for (const store of ['manifiestos', 'catalogos'] as const) {
    const snapshots = await getAllOffline<{ id: string; owner?: string }>(store).catch(() => []);
    for (const row of snapshots) {
      let belongs = row.id.startsWith('user_' + userId + ':');
      try {
        const identity = JSON.parse(row.owner || 'null');
        belongs ||= row.id.startsWith('context-v2:') && Array.isArray(identity) && String(identity[0]) === String(userId);
      } catch { /* Unknown copies are never adopted by another context. */ }
      if (belongs) await removeOffline(store, row.id).catch(() => {});
    }
    await removeOffline(store, 'user_' + userId).catch(() => {});
  }
  const prefix = `${userId}:`;
  const cases = await getAllOffline<{ id: string }>('inspection_cases').catch(() => []);
  await Promise.all(cases.filter((entry) => entry.id.startsWith(prefix)).map((entry) => removeOffline('inspection_cases', entry.id).catch(() => {})));
}

/// <reference lib="webworker" />
/**
 * SITREP Custom Service Worker
 * Implements Background Sync + Workbox Precaching
 *
 * v7.0.0 - Background Sync Handler
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { openDB } from 'idb';

declare const self: ServiceWorkerGlobalScope;

// Type declarations for Background Sync API
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

declare global {
  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }
}

// Database constants (must match offlineStorage.ts)
const DB_NAME = 'sitrep-db-v4';
const DB_VERSION = 4;

// ============================================================
// WORKBOX PRECACHING
// ============================================================

// Clean up old caches
cleanupOutdatedCaches();

// Precache all assets from the manifest
precacheAndRoute(self.__WB_MANIFEST);

// Runtime caching for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      })
    ],
    networkTimeoutSeconds: 10
  })
);

// Cache OpenStreetMap tiles
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// ============================================================
// BACKGROUND SYNC HANDLER
// ============================================================

// @ts-ignore - Background Sync API types not in standard lib
self.addEventListener('sync', (event: any) => {
  const syncEvent = event as SyncEvent;
  console.log('[SW] Sync event received:', syncEvent.tag);

  if (syncEvent.tag === 'sitrep-sync') {
    syncEvent.waitUntil(syncPendingOperations());
  }
});

/**
 * Sincroniza todas las operaciones pendientes en IndexedDB
 */
async function syncPendingOperations(): Promise<void> {
  console.log('[SW] Starting background sync...');

  try {
    const db = await openDB(DB_NAME, DB_VERSION);

    // Get auth token from IndexedDB
    const authData = await db.get('authData', 'current');
    if (!authData || Date.now() > authData.expiresAt) {
      console.warn('[SW] No valid auth token for background sync');
      return;
    }

    const accessToken = authData.accessToken;

    // Get pending operations
    const operations = await db.getAll('operacionesPendientes');
    console.log(`[SW] Found ${operations.length} pending operations`);

    const MAX_RETRIES = 5;
    let synced = 0;
    let failed = 0;

    for (const op of operations) {
      // Skip if max retries exceeded
      if (op.retries >= MAX_RETRIES) {
        console.warn(`[SW] Skipping op ${op.id} - max retries exceeded`);
        failed++;
        continue;
      }

      // Exponential backoff check
      if (op.retries > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, op.retries - 1), 30000);
        const nextRetryAt = op.timestamp + backoffMs * op.retries;
        if (Date.now() < nextRetryAt) {
          console.log(`[SW] Skipping op ${op.id}, waiting for backoff`);
          continue;
        }
      }

      try {
        const response = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: op.method !== 'DELETE' ? JSON.stringify(op.datos) : undefined
        });

        if (response.ok) {
          // Success - remove from queue
          await db.delete('operacionesPendientes', op.id);
          synced++;
          console.log(`[SW] Synced operation ${op.id}`);
        } else if (response.status >= 500) {
          // Server error - retry with backoff
          op.retries++;
          await db.put('operacionesPendientes', op);
          failed++;
          console.warn(`[SW] Server error for op ${op.id}, retry ${op.retries}`);
        } else {
          // Client error (4xx) - don't retry
          failed++;
          console.error(`[SW] Client error for op ${op.id}: ${response.status}`);
        }
      } catch (error) {
        // Network error - retry with backoff
        op.retries++;
        await db.put('operacionesPendientes', op);
        console.warn(`[SW] Network error for op ${op.id}:`, error);
      }
    }

    // Sync GPS points
    await syncGPSPoints(db, accessToken);

    console.log(`[SW] Background sync complete. Synced: ${synced}, Failed: ${failed}`);

    // Notify the app about sync completion
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        synced,
        failed,
        timestamp: Date.now()
      });
    });

  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    throw error;
  }
}

/**
 * Sincroniza puntos GPS pendientes
 */
async function syncGPSPoints(db: any, accessToken: string): Promise<void> {
  const allPoints = await db.getAll('gpsPoints');
  const unsyncedPoints = allPoints.filter((p: any) => !p.sincronizado);

  if (unsyncedPoints.length === 0) return;

  console.log(`[SW] Syncing ${unsyncedPoints.length} GPS points...`);

  // Group by manifiestoId
  const grouped = unsyncedPoints.reduce((acc: any, point: any) => {
    if (!acc[point.manifiestoId]) acc[point.manifiestoId] = [];
    acc[point.manifiestoId].push(point);
    return acc;
  }, {});

  for (const [manifiestoId, points] of Object.entries(grouped)) {
    try {
      const response = await fetch(`/api/manifiestos/${manifiestoId}/ubicacion-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ puntos: points })
      });

      if (response.ok) {
        // Mark all points as synced
        const tx = db.transaction('gpsPoints', 'readwrite');
        for (const point of points as any[]) {
          const existing = await tx.store.get(point.id);
          if (existing) {
            existing.sincronizado = true;
            await tx.store.put(existing);
          }
        }
        await tx.done;
        console.log(`[SW] Synced ${(points as any[]).length} GPS points for manifiesto ${manifiestoId}`);
      }
    } catch (error) {
      console.warn(`[SW] Failed to sync GPS points for ${manifiestoId}:`, error);
    }
  }
}

// ============================================================
// PUSH NOTIFICATION HANDLER
// ============================================================

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {
    title: 'SITREP',
    body: 'Nueva notificación',
    icon: '/pwa-192x192.png'
  };

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: data.data
  };

  // Add vibrate if supported (experimental)
  if ('vibrate' in navigator) {
    (options as any).vibrate = [200, 100, 200];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ============================================================
// MESSAGE HANDLER
// ============================================================

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'TRIGGER_SYNC') {
    syncPendingOperations().catch(console.error);
  }
});

// Claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

console.log('[SW] SITREP Custom Service Worker v7.0.0 loaded');

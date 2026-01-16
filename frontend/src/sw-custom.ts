/// <reference lib="webworker" />
/**
 * SITREP Custom Service Worker
 * Implements Background Sync + Workbox Precaching
 * v7.2.0
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { openDB, type IDBPDatabase } from 'idb';

declare const self: ServiceWorkerGlobalScope;

// ===== Type Declarations =====
interface SyncEvent extends ExtendableEvent {
    tag: string;
}

interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
}

interface PendingOperation {
    id: string;
    endpoint: string;
    method: string;
    datos?: unknown;
    retries: number;
    timestamp: number;
}

interface GPSPoint {
    id: string;
    manifiestoId: string;
    sincronizado: boolean;
    [key: string]: unknown;
}

declare global {
    interface ServiceWorkerRegistration {
        sync: SyncManager;
    }
}

// ===== Constants =====
const DB_NAME = 'sitrep-db-v4';
const DB_VERSION = 4;
const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 30000;
const SYNC_TAG = 'sitrep-sync';

// ===== Workbox Configuration =====
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// API caching - Network First with fallback
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60
            })
        ],
        networkTimeoutSeconds: 15,
        fetchOptions: { credentials: 'include' }
    }),
    'GET'
);

// Non-GET API requests - Network only with offline fallback
registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api/') && request.method !== 'GET',
    async ({ request }) => {
        try {
            return await fetch(request);
        } catch (error) {
            console.warn('[SW] API request failed:', error);
            return new Response(
                JSON.stringify({ success: false, error: 'Offline' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
);

// OpenStreetMap tiles - Cache First
registerRoute(
    ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
    new CacheFirst({
        cacheName: 'osm-tiles',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60
            })
        ]
    })
);

// ===== Background Sync =====
// @ts-expect-error Background Sync API types not in standard lib
self.addEventListener('sync', (event: SyncEvent) => {
    console.log('[SW] Sync event received:', event.tag);
    if (event.tag === SYNC_TAG) {
        event.waitUntil(syncPendingOperations());
    }
});

function calculateBackoff(retries: number): number {
    return Math.min(1000 * Math.pow(2, retries - 1), MAX_BACKOFF_MS);
}

function shouldRetryOperation(op: PendingOperation): boolean {
    if (op.retries >= MAX_RETRIES) {
        return false;
    }
    if (op.retries > 0) {
        const backoffMs = calculateBackoff(op.retries);
        const nextRetryAt = op.timestamp + backoffMs * op.retries;
        return Date.now() >= nextRetryAt;
    }
    return true;
}

async function syncPendingOperations(): Promise<void> {
    console.log('[SW] Starting background sync...');

    const db = await openDB(DB_NAME, DB_VERSION);
    const authData = await db.get('authData', 'current');

    if (!authData || Date.now() > authData.expiresAt) {
        console.warn('[SW] No valid auth token for background sync');
        return;
    }

    const operations: PendingOperation[] = await db.getAll('operacionesPendientes');
    console.log(`[SW] Found ${operations.length} pending operations`);

    let synced = 0;
    let failed = 0;

    for (const op of operations) {
        if (!shouldRetryOperation(op)) {
            console.warn(`[SW] Skipping op ${op.id} - max retries exceeded`);
            failed++;
            continue;
        }

        const result = await syncOperation(db, op, authData.accessToken);
        if (result) {
            synced++;
        } else {
            failed++;
        }
    }

    await syncGPSPoints(db, authData.accessToken);

    console.log(`[SW] Background sync complete. Synced: ${synced}, Failed: ${failed}`);
    await notifyClients({ type: 'SYNC_COMPLETE', synced, failed, timestamp: Date.now() });
}

async function syncOperation(
    db: IDBPDatabase,
    op: PendingOperation,
    accessToken: string
): Promise<boolean> {
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
            await db.delete('operacionesPendientes', op.id);
            console.log(`[SW] Synced operation ${op.id}`);
            return true;
        }

        if (response.status >= 500) {
            op.retries++;
            await db.put('operacionesPendientes', op);
            console.warn(`[SW] Server error for op ${op.id}, retry ${op.retries}`);
        } else {
            console.error(`[SW] Client error for op ${op.id}: ${response.status}`);
        }
    } catch (error) {
        op.retries++;
        await db.put('operacionesPendientes', op);
        console.warn(`[SW] Network error for op ${op.id}:`, error);
    }

    return false;
}

async function syncGPSPoints(db: IDBPDatabase, accessToken: string): Promise<void> {
    const allPoints: GPSPoint[] = await db.getAll('gpsPoints');
    const unsyncedPoints = allPoints.filter(p => !p.sincronizado);

    if (unsyncedPoints.length === 0) return;

    console.log(`[SW] Syncing ${unsyncedPoints.length} GPS points...`);

    const grouped = groupBy(unsyncedPoints, 'manifiestoId');

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
                await markPointsAsSynced(db, points);
                console.log(`[SW] Synced ${points.length} GPS points for manifiesto ${manifiestoId}`);
            }
        } catch (error) {
            console.warn(`[SW] Failed to sync GPS points for ${manifiestoId}:`, error);
        }
    }
}

function groupBy<T extends Record<string, unknown>>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((acc, item) => {
        const groupKey = String(item[key]);
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(item);
        return acc;
    }, {} as Record<string, T[]>);
}

async function markPointsAsSynced(db: IDBPDatabase, points: GPSPoint[]): Promise<void> {
    const tx = db.transaction('gpsPoints', 'readwrite');
    for (const point of points) {
        const existing = await tx.store.get(point.id);
        if (existing) {
            existing.sincronizado = true;
            await tx.store.put(existing);
        }
    }
    await tx.done;
}

async function notifyClients(message: unknown): Promise<void> {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage(message));
}

// ===== Push Notifications =====
self.addEventListener('push', (event: PushEvent) => {
    const data = event.data?.json() ?? {
        title: 'SITREP',
        body: 'Nueva notificacion',
        icon: '/pwa-192x192.png'
    };

    const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: data.data
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/app';

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            const existingClient = clients.find(client => client.url.includes('/app'));
            if (existingClient && 'focus' in existingClient) {
                return existingClient.focus();
            }
            return self.clients.openWindow(urlToOpen);
        })
    );
});

// ===== Message Handler =====
self.addEventListener('message', (event: ExtendableMessageEvent) => {
    switch (event.data?.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'TRIGGER_SYNC':
            syncPendingOperations().catch(console.error);
            break;
    }
});

// Claim clients immediately on activation
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

console.log('[SW] SITREP Custom Service Worker v7.2.0 loaded');

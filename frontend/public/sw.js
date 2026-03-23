// Service Worker para modo Offline-First (CU-T09)
// Scope: / (main site)
const CACHE_NAME = 'trazabilidad-rrpp-v18';
const RUNTIME_CACHE = 'runtime-cache-v18';

// Recursos críticos para cachear en instalación
const PRECACHE_URLS = [
    '/',
    '/index.html'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v13...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                return Promise.all(
                    PRECACHE_URLS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] Failed to cache:', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker v13...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map((name) => {
                        console.log('[SW] Eliminando caché antigua:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de caché: Network First con fallback a Cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo cachear requests GET
    if (request.method !== 'GET') {
        return;
    }

    // No cachear requests a la API (solo datos estáticos)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Navigation requests (HTML pages): network-first, never cache HTML to avoid stale asset references
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(request).then((cached) => cached || caches.match('/offline.html'));
            })
        );
        return;
    }

    // Static assets: network-first with cache fallback
    event.respondWith(
        caches.open(RUNTIME_CACHE).then((cache) => {
            return fetch(request)
                .then((response) => {
                    if (response.status === 200) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => {
                    return cache.match(request);
                });
        })
    );
});

// Background Sync para sincronización cuando vuelve la conexión (CU-T01)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background Sync:', event.tag);

    if (event.tag === 'sync-manifiestos') {
        event.waitUntil(syncManifiestos());
    }
});

async function syncManifiestos() {
    console.log('[SW] Sincronizando manifiestos pendientes...');

    // Aquí se implementaría la lógica de sincronización
    // Por ahora, solo notificamos al cliente
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
        client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: new Date().toISOString()
        });
    });
}

// Notificaciones Push (para futuro)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Trazabilidad RRPP';
    const options = {
        body: data.body || 'Nueva notificación',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

console.log('[SW] Service Worker v13 cargado');

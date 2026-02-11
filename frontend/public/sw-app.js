// Service Worker para PWA Mobile (/app/)
// Scope: /app/
const CACHE_NAME = 'sitrep-app-v9';
const RUNTIME_CACHE = 'sitrep-app-runtime-v9';

const PRECACHE_URLS = [
    '/app/',
    '/app/index.html'
];

// Instalación
self.addEventListener('install', (event) => {
    console.log('[SW-App] Installing v9...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return Promise.all(
                    PRECACHE_URLS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW-App] Failed to cache:', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activación — limpiar TODOS los caches viejos
self.addEventListener('activate', (event) => {
    console.log('[SW-App] Activating v8...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map((name) => {
                        console.log('[SW-App] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network First
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // No cachear API calls
    if (url.pathname.startsWith('/api/')) return;

    // Navigation: network-first, fallback to offline page
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(request)
                    .then((cached) => cached || caches.match('/app/offline.html'));
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
                .catch(() => cache.match(request));
        })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-manifiestos') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SYNC_COMPLETE', timestamp: new Date().toISOString() });
                });
            })
        );
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'SITREP', {
            body: data.body || 'Nueva notificación',
            icon: '/app/icon-192.png',
            badge: '/app/icon-192.png',
            data
        })
    );
});

console.log('[SW-App] Service Worker v8 loaded');

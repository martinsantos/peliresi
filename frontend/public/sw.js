// Service Worker para modo Offline-First (CU-T09)
const CACHE_NAME = 'trazabilidad-rrpp-v4';
const RUNTIME_CACHE = 'runtime-cache-v4';

// Recursos críticos para cachear en instalación
// Paths relativos al scope del SW
const PRECACHE_URLS = [
    '/demoambiente/',
    '/demoambiente/index.html'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                // Use addAll with catch for individual failures
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
    console.log('[SW] Activando Service Worker...');
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

    event.respondWith(
        caches.open(RUNTIME_CACHE).then((cache) => {
            return fetch(request)
                .then((response) => {
                    // Cachear respuesta exitosa
                    if (response.status === 200) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => {
                    // Si falla la red, intentar desde caché
                    return cache.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Si no hay caché, mostrar página offline
                        if (request.mode === 'navigate') {
                            return cache.match('/offline.html');
                        }
                    });
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
        icon: '/demoambiente/icon-192.png',
        badge: '/demoambiente/icon-192.png',
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

console.log('[SW] Service Worker cargado');

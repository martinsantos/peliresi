// Service Worker para modo Offline-First (CU-T09)
// Scope: / (main site)
const CACHE_NAME = 'trazabilidad-rrpp-v26';
const RUNTIME_CACHE = 'runtime-cache-v26';

// Recursos críticos para cachear en instalación
const PRECACHE_URLS = [
    '/',
    '/index.html'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v26...');
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
    console.log('[SW] Activando Service Worker v26...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
            return Promise.all(
                cacheNames
                    .filter((name) => !currentCaches.includes(name))
                    .map((name) => {
                        console.log('[SW] Eliminando cache antigua:', name);
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

    // Navigation requests (HTML pages): network-first with safe fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => response)
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    const offline = await caches.match('/offline.html');
                    if (offline) return offline;
                    // Last resort: return a minimal HTML response to avoid SW error
                    return new Response('<html><body><h1>Offline</h1><p>Sin conexion. Intente de nuevo.</p></body></html>', {
                        headers: { 'Content-Type': 'text/html' }
                    });
                })
        );
        return;
    }

    // Static assets: network-first with cache fallback
    event.respondWith(
        caches.open(RUNTIME_CACHE).then(async (cache) => {
            try {
                const response = await fetch(request);
                if (response && response.status === 200) {
                    cache.put(request, response.clone());
                }
                return response;
            } catch {
                const cached = await cache.match(request);
                // Always return a Response — never undefined
                return cached || new Response('', { status: 408, statusText: 'Offline' });
            }
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

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const prioridad = data.prioridad || 'NORMAL';
    const esCritica = prioridad === 'CRITICA';
    const esAlta    = prioridad === 'ALTA' || esCritica;

    const options = {
        body:              data.body  || 'Nueva notificación',
        icon:              data.icon  || '/app/icon-192.png',
        badge:             data.badge || '/app/icon-192.png',
        tag:               data.tag   || 'sitrep-default',
        renotify:          !!data.tag,
        requireInteraction: esCritica,
        vibrate:           esCritica ? [300, 100, 300, 100, 300]
                         : esAlta    ? [200, 100, 200]
                         :             [100],
        data,
    };

    event.waitUntil(self.registration.showNotification(data.title || 'SITREP', options));
});

console.log('[SW] Service Worker v26 cargado');

// ========================================
// NOTIFICATION CLICK — abrir/enfocar la web
// ========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Service Worker para modo Offline-First (CU-T09)
// Scope: / (main site)
const CACHE_NAME = 'trazabilidad-rrpp-v58';
const RUNTIME_CACHE = 'runtime-cache-v58';

// Recursos críticos para cachear en instalación
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/offline.html'
];

function isSpaNavigation(pathname) {
    return !/^\/(manual|public)(\/|$)/.test(pathname)
        && (pathname === '/index.html' || !/\.(html?|pdf|json|xml|txt|csv|zip|png|jpe?g|svg|webp|ico|js|css)$/i.test(pathname));
}

function isCacheableAsset(request, response) {
    if (!response || response.status !== 200 || response.redirected) return false;
    const pathname = new URL(request.url).pathname;
    const contentType = response.headers.get('Content-Type') || '';
    if (/\.m?js$/i.test(pathname)) return /(?:java|ecma)script/i.test(contentType);
    if (/\.css$/i.test(pathname)) return /text\/css/i.test(contentType);
    return !pathname.startsWith('/assets/') || !/text\/html/i.test(contentType);
}

const offlineResponse = () => new Response('<html><body><h1>Offline</h1><p>Sin conexion. Intente de nuevo.</p></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
});

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing', CACHE_NAME);
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
    console.log('[SW] Activando', CACHE_NAME);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
            return Promise.all(
                cacheNames
                    .filter((name) => (name.startsWith('trazabilidad-rrpp-') || name.startsWith('runtime-cache-')) && !currentCaches.includes(name))
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

    // The root worker must not own /app/, external resources or their caches.
    if (url.origin !== self.location.origin || /^\/app(\/|$)/.test(url.pathname)) return;

    // No cachear requests a la API (solo datos estáticos)
    if (/^\/api(\/|$)/.test(url.pathname)) {
        return;
    }

    // Navigation requests (HTML pages): network-first with safe fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => response)
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    const runtime = await caches.open(RUNTIME_CACHE);
                    const cached = await cache.match(request) || await runtime.match(request);
                    if (cached) return cached;
                    // Deep SPA URLs are not precached individually. Their shell
                    // can load the same user's bounded IndexedDB snapshot.
                    if (isSpaNavigation(url.pathname)) {
                        const shell = await cache.match('/index.html');
                        if (shell?.ok && /text\/html/i.test(shell.headers.get('Content-Type') || '')) return shell;
                    }
                    const offline = await cache.match('/offline.html');
                    if (offline) return offline;
                    return offlineResponse();
                })
        );
        return;
    }

    // Static assets: network-first with cache fallback
    event.respondWith(
        caches.open(RUNTIME_CACHE).then(async (cache) => {
            try {
                const response = await fetch(request);
                if (isCacheableAsset(request, response)) {
                    await cache.put(request, response.clone()).catch(() => {});
                }
                return response;
            } catch {
                const cached = await cache.match(request);
                // Always return a Response — never undefined
                return (isCacheableAsset(request, cached) && cached) || new Response('', { status: 408, statusText: 'Offline' });
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

    event.waitUntil(self.registration.showNotification(data.title || 'RP Trazar', options));
});

console.log('[SW] Service Worker cargado', CACHE_NAME);

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

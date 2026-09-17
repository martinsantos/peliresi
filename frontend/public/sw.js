// Service Worker para modo Offline-First (CU-T09)
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const IS_DEMO_SCOPE = SCOPE_PATH.startsWith('/demoambiente/');
const CACHE_PREFIX = IS_DEMO_SCOPE ? 'trazabilidad-demo-' : 'trazabilidad-rrpp-';
const RUNTIME_PREFIX = IS_DEMO_SCOPE ? 'runtime-demo-' : 'runtime-cache-';
const CACHE_NAME = `${CACHE_PREFIX}v47`;
const RUNTIME_CACHE = `${RUNTIME_PREFIX}v47`;
const scoped = (path) => `${SCOPE_PATH}${path.replace(/^\//, '')}`;

// Recursos críticos para cachear en instalación
const PRECACHE_URLS = [
    scoped(''),
    scoped('index.html'),
    scoped('mendoza-marca-horizontal-transparente.png'),
    scoped('mendoza-marca-secundaria-transparente.png'),
    // Local OCR assets: no external domain is needed when the document
    // scanner is opened after connectivity is lost.
    scoped('ocr/worker.min.js'),
    scoped('ocr/tesseract-core.wasm.js'),
    scoped('ocr/tesseract-core.wasm'),
    scoped('ocr/spa.traineddata')
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v45...');
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
    console.log('[SW] Activando Service Worker v45...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
            return Promise.all(
                cacheNames
                    // Never delete the PWA's /app/ caches. This root worker
                    // shares the origin with sw-app.js and must only rotate
                    // caches that it owns.
                    .filter((name) =>
                        (name.startsWith(CACHE_PREFIX) || name.startsWith(RUNTIME_PREFIX)) &&
                        !currentCaches.includes(name)
                    )
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

    // Cross-origin resources (map tiles, verification providers, etc.) must be
    // handled by the browser. Intercepting them here turns a remote outage into
    // a misleading same-origin 408 response and can pollute the runtime cache.
    if (url.origin !== self.location.origin) {
        return;
    }

    // No cachear requests a la API (solo datos estáticos)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/demoambiente/api/')) {
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
                    const offline = await caches.match(scoped('offline.html'));
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
            type: 'SYNC_REQUEST',
            timestamp: new Date().toISOString()
        });
    });
}

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const prioridad = data.prioridad || 'NORMAL';
    const esCritica = prioridad === 'CRITICA' || prioridad === 'URGENTE';
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

console.log('[SW] Service Worker v45 cargado');

function notificationTarget(rawTarget, fallback) {
  try {
    const target = new URL(typeof rawTarget === 'string' ? rawTarget : fallback, self.location.origin);
    if (target.origin !== self.location.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

// ========================================
// NOTIFICATION CLICK — abrir/enfocar la web
// ========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = notificationTarget(event.notification.data?.url, '/');
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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    })
  );
});

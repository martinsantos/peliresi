// Service Worker para PWA Mobile (/app/)
// Scope: /app/
// Version injected at build time or fallback
const SW_VERSION = '__SW_VERSION__'.startsWith('__') ? 'dev-' + Date.now() : '__SW_VERSION__';
const CACHE_NAME = `sitrep-app-${SW_VERSION}`;
const RUNTIME_CACHE = `sitrep-app-runtime-${SW_VERSION}`;

// Try to load build-time precache manifest, fallback to minimal list
let PRECACHE_URLS = ['/app/', '/app/index.html', '/app/offline.html', '/app/manifest-app.json'];
try {
  importScripts('./sw-precache-manifest.js');
  if (self.__PRECACHE_MANIFEST && self.__PRECACHE_MANIFEST.length > 0) {
    PRECACHE_URLS = PRECACHE_URLS.concat(self.__PRECACHE_MANIFEST);
  }
} catch (e) {
  // No manifest available (dev mode) - use minimal list
}

// ========================================
// INSTALL — precache app shell
// ========================================
self.addEventListener('install', (event) => {
  console.log(`[SW-App] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW-App] Failed to precache:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ========================================
// ACTIVATE — clean old caches
// ========================================
self.addEventListener('activate', (event) => {
  console.log(`[SW-App] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('sitrep-app-') && name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW-App] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ========================================
// FETCH — smart caching strategies
// ========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never cache API calls — let the app handle offline via IndexedDB
  if (url.pathname.startsWith('/api/')) return;

  // --- Navigation requests (SPA) ---
  // Network-first, fallback to cached index.html (React SPA shell), then offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the index.html on successful navigation
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/app/index.html', clone);
          });
          return response;
        })
        .catch(() => {
          // Offline: serve the cached SPA shell so React can render with offline data
          return caches.match('/app/index.html')
            .then((cached) => cached || caches.match('/app/offline.html'));
        })
    );
    return;
  }

  // --- Hashed assets (vendor-CYrAbLGl.js, main-BpK6mu12.css) ---
  // Cache-first: content-hashed files never change
  if (url.pathname.match(/\/assets\/.*-[a-zA-Z0-9]{8}\./)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // --- Non-hashed static assets (icons, manifest, fonts, images) ---
  // Network-first with runtime cache fallback
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

// ========================================
// BACKGROUND SYNC
// ========================================
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

// ========================================
// PUSH NOTIFICATIONS
// ========================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SITREP', {
      body: data.body || 'Nueva notificacion',
      icon: '/app/icon-192.png',
      badge: '/app/icon-192.png',
      data
    })
  );
});

// ========================================
// MESSAGE HANDLER — for SW update signaling
// ========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log(`[SW-App] Service Worker ${SW_VERSION} loaded`);

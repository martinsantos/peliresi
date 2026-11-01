// Service Worker para PWA Mobile (/app/)
// Scope: /app/
// Version injected at build time or fallback
const SW_VERSION = '__SW_VERSION__'.startsWith('__') ? 'dev-' + Date.now() : '__SW_VERSION__';
const CACHE_NAME = `sitrep-app-${SW_VERSION}`;
const RUNTIME_CACHE = `sitrep-app-runtime-${SW_VERSION}`;

function isSpaNavigation(pathname) {
  return !/^\/app\/(manual|public)(\/|$)/.test(pathname)
    && (pathname === '/app/index.html' || pathname === '/app/app.html' || !/\.(html?|pdf|json|xml|txt|csv|zip|png|jpe?g|svg|webp|ico|js|css)$/i.test(pathname));
}

function isCacheableAsset(request, response) {
  if (!response || response.status !== 200 || response.redirected) return false;
  const pathname = new URL(request.url).pathname;
  const contentType = response.headers.get('Content-Type') || '';
  if (/\.m?js$/i.test(pathname)) return /(?:java|ecma)script/i.test(contentType);
  if (/\.css$/i.test(pathname)) return /text\/css/i.test(contentType);
  return !pathname.startsWith('/app/assets/') || !/text\/html/i.test(contentType);
}

async function matchOwnCache(request) {
  const precache = await caches.open(CACHE_NAME);
  const runtime = await caches.open(RUNTIME_CACHE);
  return await precache.match(request) || await runtime.match(request);
}

// An older tab may still request its exact content-hashed chunk after another
// tab activates an update. Never search other scopes or substitute a new hash.
async function matchReleaseAsset(request) {
  const own = await matchOwnCache(request);
  if (isCacheableAsset(request, own)) return own;
  for (const name of await caches.keys()) {
    if (!name.startsWith('sitrep-app-') || name === CACHE_NAME || name === RUNTIME_CACHE) continue;
    const previous = await (await caches.open(name)).match(request);
    if (isCacheableAsset(request, previous)) return previous;
  }
}

async function offlineNavigation(request, pathname) {
  const exact = await matchOwnCache(request);
  if (exact) return exact;
  if (isSpaNavigation(pathname)) {
    const shell = await matchOwnCache('/app/index.html');
    if (shell?.ok && /text\/html/i.test(shell.headers.get('Content-Type') || '')) return shell;
  }
  return await matchOwnCache('/app/offline.html') || new Response('<h1>Sin conexión</h1><p>Abra esta pantalla con conexión antes de usarla sin red.</p>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

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
// INSTALL — precache app shell as one release. If a required file is missing,
// do not activate an incomplete worker; the current worker remains in control.
// ========================================
self.addEventListener('install', (event) => {
  console.log(`[SW-App] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ========================================
// ACTIVATE — old clients can still be running a previous application build.
// Retire its caches only when no app window remains; otherwise exact hashed
// resources must stay available to the already-open tabs.
// ========================================
self.addEventListener('activate', (event) => {
  console.log(`[SW-App] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const hasAppClient = clients.some((client) => {
        try {
          const url = new URL(client.url);
          return url.origin === self.location.origin && (url.pathname === '/app' || url.pathname.startsWith('/app/'));
        } catch { return true; }
      });
      if (hasAppClient) return [];
      return caches.keys();
    }).catch(() => []).then((cacheNames) => {
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

  // Only handle http/https schemes (filter chrome-extension://, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Scope controls navigations, not subresource requests made by a controlled page.
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;

  // Never cache API calls — let the app handle offline via IndexedDB
  if (/^\/(?:app\/)?api(\/|$)/.test(url.pathname)) return;

  // --- Navigation requests (SPA) ---
  // Keep the shell paired with this worker until the waiting version is
  // explicitly activated. Do not overwrite it with a later release's HTML.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const spa = isSpaNavigation(url.pathname);
        const cached = spa ? await matchOwnCache('/app/index.html') : null;
        const shell = cached?.ok && /text\/html/i.test(cached.headers.get('Content-Type') || '') ? cached : null;
        try {
          const response = await fetch(request);
          const spaHtml = response.ok && !response.redirected
            && /text\/html/i.test(response.headers.get('Content-Type') || '');
          if (spa && shell && (spaHtml || response.status === 404)) return shell;
          return response;
        } catch {
          return shell || offlineNavigation(request, url.pathname);
        }
      })()
    );
    return;
  }

  // --- Hashed assets (vendor-CYrAbLGl.js, main-BpK6mu12.css) ---
  // Cache-first: content-hashed files never change
  if (url.pathname.match(/\/assets\/.*-[a-zA-Z0-9_-]{8}\./)) {
    event.respondWith(
      matchReleaseAsset(request).then((cached) => {
        if (isCacheableAsset(request, cached)) return cached;
        return fetch(request).then(async (response) => {
          if (isCacheableAsset(request, response)) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        }).catch(() => new Response('', { status: 408, statusText: 'Offline' }));
      })
    );
    return;
  }

  // --- Non-hashed static assets (icons, manifest, fonts, images) ---
  // Network-first with runtime cache fallback
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) => {
      return fetch(request)
        .then(async (response) => {
          if (isCacheableAsset(request, response)) {
            await cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          // Installation already saves the brand icons in the release cache.
          // For the mutable app manifest, prefer a successful later download;
          // an initial offline request can still use the installed copy.
          const latestManifest = url.pathname === '/app/manifest-app.json' ? await cache.match(request) : null;
          const cached = isCacheableAsset(request, latestManifest) ? latestManifest : await matchOwnCache(request);
          return (isCacheableAsset(request, cached) && cached) || new Response('', { status: 408, statusText: 'Offline' });
        });
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
  const prioridad = data.prioridad || 'NORMAL';
  const esCritica = prioridad === 'CRITICA';
  const esAlta    = prioridad === 'ALTA' || esCritica;

  const options = {
    body:               data.body  || 'Nueva notificacion',
    icon:               data.icon  || '/app/icon-192.png',
    badge:              data.badge || '/app/icon-192.png',
    tag:                data.tag   || 'sitrep-default',
    renotify:           !!data.tag,
    requireInteraction: esCritica,
    vibrate:            esCritica ? [300, 100, 300, 100, 300]
                      : esAlta    ? [200, 100, 200]
                      :             [100],
    data,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'SITREP', options));
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

// ========================================
// NOTIFICATION CLICK — abrir/enfocar la app
// ========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedPath = event.notification.data?.url || '/';
  const appPath = requestedPath.startsWith('/app/')
    ? requestedPath
    : requestedPath.startsWith('/')
      ? `/app${requestedPath}`
      : '/app/';
  const url = new URL(appPath, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).pathname.startsWith('/app/') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

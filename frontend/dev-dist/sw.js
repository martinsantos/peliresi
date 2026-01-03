/**
 * Service Worker para SITREP con soporte Push Notifications
 * Este archivo se incluye en el build por vite-plugin-pwa
 */

// Manejar eventos de push
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    
    const options = {
      body: payload.body || 'Nueva notificación',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      tag: payload.tag || 'sitrep-notification',
      data: payload.data || {},
      vibrate: [100, 50, 100],
      actions: payload.actions || [],
      requireInteraction: payload.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(payload.title || 'SITREP', options)
    );
  } catch (error) {
    console.error('[SW] Error procesando push:', error);
  }
});

// Manejar click en notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si hay una pestaña abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Si no hay pestaña, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Manejar cierre de notificación
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notificación cerrada:', event.notification.tag);
});

// Cache para funcionamiento offline
const CACHE_NAME = 'sitrep-v1';
const urlsToCache = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activar Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// Fetch con estrategia Network First
self.addEventListener('fetch', function(event) {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar peticiones a la API (siempre network)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cachear respuesta exitosa
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Si falla, intentar desde cache
        return caches.match(event.request);
      })
  );
});

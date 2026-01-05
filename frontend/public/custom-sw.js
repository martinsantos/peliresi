/**
 * SITREP Custom Service Worker
 * Handles Push Notifications and Background Sync
 */

// Push notification handler
self.addEventListener('push', function(event) {
  console.log('[SW] Push notification received');
  
  let data = { title: 'SITREP', body: 'Nueva notificación' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Nueva actualización en SITREP',
    icon: '/pwa-192x192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'sitrep-notification',
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SITREP', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Si no, abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background Sync handler
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sitrep-sync') {
    event.waitUntil(syncPendingOperations());
  } else if (event.tag === 'sitrep-gps-sync') {
    event.waitUntil(syncGPSData());
  }
});

// Sync pending operations from IndexedDB
async function syncPendingOperations() {
  console.log('[SW] Syncing pending operations...');
  
  try {
    const db = await openDB();
    const tx = db.transaction('operacionesPendientes', 'readonly');
    const store = tx.objectStore('operacionesPendientes');
    const operations = await store.getAll();
    
    const token = await getStoredToken();
    if (!token) {
      console.warn('[SW] No auth token available for sync');
      return;
    }

    for (const op of operations) {
      try {
        const response = await fetch(op.endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: op.method !== 'DELETE' ? JSON.stringify(op.datos) : undefined
        });

        if (response.ok) {
          // Remove synced operation
          const delTx = db.transaction('operacionesPendientes', 'readwrite');
          await delTx.objectStore('operacionesPendientes').delete(op.id);
          console.log('[SW] Synced operation:', op.id);
        }
      } catch (e) {
        console.error('[SW] Failed to sync operation:', op.id, e);
      }
    }
  } catch (e) {
    console.error('[SW] Sync error:', e);
  }
}

// Sync GPS data
async function syncGPSData() {
  console.log('[SW] Syncing GPS data...');
  // GPS sync implementation - reads from localStorage/IndexedDB
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sitrep-db-v2', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get stored auth token
async function getStoredToken() {
  // Try to get token from clients
  const allClients = await clients.matchAll();
  for (const client of allClients) {
    try {
      const response = await client.postMessage({ type: 'GET_TOKEN' });
      if (response) return response;
    } catch (e) {}
  }
  return null;
}

// Message handler for communication with main thread
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'TOKEN_RESPONSE') {
    // Handle token response from client
  }
});

console.log('[SW] Custom Service Worker loaded for SITREP');

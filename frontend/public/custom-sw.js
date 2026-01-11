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

// Sync GPS data from IndexedDB to backend
async function syncGPSData() {
  console.log('[SW] Syncing GPS data...');

  try {
    const db = await openDB();

    // Check if gpsPoints store exists
    if (!db.objectStoreNames.contains('gpsPoints')) {
      console.warn('[SW] gpsPoints store not found, skipping GPS sync');
      return;
    }

    const tx = db.transaction('gpsPoints', 'readonly');
    const store = tx.objectStore('gpsPoints');
    const allPoints = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Filter unsynced points
    const unsyncedPoints = allPoints.filter(p => !p.sincronizado);

    if (unsyncedPoints.length === 0) {
      console.log('[SW] No GPS points to sync');
      return;
    }

    console.log(`[SW] Found ${unsyncedPoints.length} GPS points to sync`);

    const token = await getStoredToken();
    if (!token) {
      console.warn('[SW] No auth token available for GPS sync');
      return;
    }

    // Group points by manifiestoId
    const pointsByManifiesto = {};
    for (const point of unsyncedPoints) {
      if (!pointsByManifiesto[point.manifiestoId]) {
        pointsByManifiesto[point.manifiestoId] = [];
      }
      pointsByManifiesto[point.manifiestoId].push(point);
    }

    const syncedIds = [];

    // Sync each manifiesto's points
    for (const [manifiestoId, points] of Object.entries(pointsByManifiesto)) {
      try {
        // Send batch of points for this manifiesto
        const response = await fetch(`/api/manifiestos/${manifiestoId}/ubicacion/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            puntos: points.map(p => ({
              latitud: p.latitud,
              longitud: p.longitud,
              velocidad: p.velocidad,
              precision: p.precision,
              timestamp: p.timestamp
            }))
          })
        });

        if (response.ok) {
          // Mark all points for this manifiesto as synced
          syncedIds.push(...points.map(p => p.id));
          console.log(`[SW] Synced ${points.length} GPS points for manifiesto ${manifiestoId}`);
        } else if (response.status === 404) {
          // Manifiesto not found - delete these points to avoid retry loop
          syncedIds.push(...points.map(p => p.id));
          console.warn(`[SW] Manifiesto ${manifiestoId} not found, discarding ${points.length} GPS points`);
        } else {
          console.error(`[SW] Failed to sync GPS for manifiesto ${manifiestoId}: HTTP ${response.status}`);
        }
      } catch (e) {
        console.error(`[SW] Network error syncing GPS for manifiesto ${manifiestoId}:`, e);
      }
    }

    // Mark synced points in IndexedDB
    if (syncedIds.length > 0) {
      const writeTx = db.transaction('gpsPoints', 'readwrite');
      const writeStore = writeTx.objectStore('gpsPoints');

      for (const id of syncedIds) {
        try {
          // Delete synced points to save space
          writeStore.delete(id);
        } catch (e) {
          console.error(`[SW] Error deleting GPS point ${id}:`, e);
        }
      }

      console.log(`[SW] Cleaned up ${syncedIds.length} synced GPS points`);
    }

  } catch (e) {
    console.error('[SW] GPS sync error:', e);
  }
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sitrep-db-v3', 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    // Handle upgrade if needed (main app handles migrations)
    request.onupgradeneeded = (event) => {
      console.log('[SW] DB upgrade needed, deferring to main app');
    };
  });
}

// Get stored auth token - multiple methods for reliability
async function getStoredToken() {
  // Method 1: Try to read from IndexedDB directly (most reliable)
  try {
    const db = await openDB();
    if (db.objectStoreNames.contains('auth')) {
      const tx = db.transaction('auth', 'readonly');
      const store = tx.objectStore('auth');
      const authData = await new Promise((resolve, reject) => {
        const request = store.get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (authData?.token) {
        console.log('[SW] Got token from IndexedDB');
        return authData.token;
      }
    }
  } catch (e) {
    console.warn('[SW] Could not read token from IndexedDB:', e);
  }

  // Method 2: Try to get token via MessageChannel from active clients
  try {
    const allClients = await clients.matchAll({ type: 'window' });
    if (allClients.length > 0) {
      const token = await getTokenViaMessageChannel(allClients[0]);
      if (token) {
        console.log('[SW] Got token via MessageChannel');
        return token;
      }
    }
  } catch (e) {
    console.warn('[SW] Could not get token via MessageChannel:', e);
  }

  // Method 3: Check if we have a cached token in SW memory
  if (self.cachedToken) {
    console.log('[SW] Using cached token');
    return self.cachedToken;
  }

  console.warn('[SW] No token available from any source');
  return null;
}

// Get token via MessageChannel for proper two-way communication
function getTokenViaMessageChannel(client) {
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      resolve(null);
    }, 2000);

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data?.token || null);
    };

    client.postMessage({ type: 'GET_TOKEN' }, [messageChannel.port2]);
  });
}

// Message handler for communication with main thread
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data?.type);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle SET_TOKEN from main app (cache token in SW memory)
  if (event.data.type === 'SET_TOKEN') {
    self.cachedToken = event.data.token;
    console.log('[SW] Token cached in memory');
  }

  // Handle GET_TOKEN via MessageChannel
  if (event.data.type === 'GET_TOKEN' && event.ports && event.ports[0]) {
    // Get token from localStorage (available in SW context via IndexedDB)
    // But since localStorage isn't available in SW, use our methods
    getStoredToken().then(token => {
      event.ports[0].postMessage({ token });
    }).catch(() => {
      event.ports[0].postMessage({ token: null });
    });
    return;
  }

  // Handle CLEAR_TOKEN (on logout)
  if (event.data.type === 'CLEAR_TOKEN') {
    self.cachedToken = null;
    console.log('[SW] Token cleared from memory');
  }
});

console.log('[SW] Custom Service Worker loaded for SITREP');

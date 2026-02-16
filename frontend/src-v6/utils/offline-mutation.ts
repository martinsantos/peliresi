/**
 * SITREP v6 - Offline Mutation Wrapper
 * =====================================
 * Wraps critical mutations to queue them in IndexedDB when offline.
 */

import { addToSyncQueue } from '../services/indexeddb';

interface QueueConfig {
  type: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
  userId?: string | number;
}

/**
 * Execute an API call. If it fails and the device is offline,
 * queue it in IndexedDB for later sync.
 * Returns the API result or 'QUEUED' if queued for offline.
 */
export async function offlineSafeMutation<T>(
  apiCall: () => Promise<T>,
  queueConfig: QueueConfig
): Promise<T | 'QUEUED'> {
  try {
    return await apiCall();
  } catch (err) {
    if (!navigator.onLine) {
      await addToSyncQueue({
        type: queueConfig.type,
        endpoint: queueConfig.endpoint,
        data: queueConfig.data,
        userId: queueConfig.userId,
      });
      return 'QUEUED';
    }
    throw err;
  }
}

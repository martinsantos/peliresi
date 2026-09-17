/**
 * SITREP v6 - Offline Mutation Wrapper
 * =====================================
 * Wraps critical mutations to queue them in IndexedDB when offline.
 */

import {
  addToSyncQueue,
  createEncryptedMultipartPayload,
} from '../services/indexeddb';
import { isNetworkError } from './api-error';

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
    const networkFailure = isNetworkError(err);
    if (!navigator.onLine || networkFailure) {
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

interface MultipartQueueConfig {
  endpoint: string;
  fields: Record<string, string>;
  file: File;
  userId: string | number;
}

/**
 * Queue a document upload when the API/VPN is unreachable. File bytes are
 * AES-GCM encrypted before entering IndexedDB and remain scoped to the user.
 */
export async function offlineSafeMultipartMutation<T>(
  apiCall: () => Promise<T>,
  queueConfig: MultipartQueueConfig,
): Promise<T | 'QUEUED'> {
  try {
    return await apiCall();
  } catch (err) {
    const networkFailure = isNetworkError(err);
    if (!navigator.onLine || networkFailure) {
      const data = await createEncryptedMultipartPayload(
        queueConfig.fields,
        queueConfig.file,
        queueConfig.userId,
      );
      await addToSyncQueue({
        type: 'POST',
        endpoint: queueConfig.endpoint,
        data,
        userId: queueConfig.userId,
      });
      return 'QUEUED';
    }
    throw err;
  }
}

export async function queueOfflineMutation(queueConfig: QueueConfig): Promise<void> {
  await addToSyncQueue({
    type: queueConfig.type,
    endpoint: queueConfig.endpoint,
    data: queueConfig.data,
    userId: queueConfig.userId,
  });
}

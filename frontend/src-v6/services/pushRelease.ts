import axios from 'axios';

/**
 * On logout, tell the server this device's push endpoint no longer belongs to the
 * person leaving, so a shared phone stops receiving their notices. Best effort:
 * never throws and never delays local logout beyond a short timeout.
 */
export async function releasePushSubscription(endingToken: string, baseURL?: string): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const endpoints = new Set<string>();
    for (const registration of registrations) {
      const subscription = await registration.pushManager?.getSubscription();
      if (subscription?.endpoint) endpoints.add(subscription.endpoint);
    }
    await Promise.all([...endpoints].map(endpoint => axios.post('/push/unsubscribe', { endpoint }, {
      baseURL, timeout: 5000, headers: { Authorization: `Bearer ${endingToken}` },
    })));
  } catch {
    // The server-side reassignment on the next login still protects a shared device.
  }
}

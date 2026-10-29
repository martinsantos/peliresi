export const SYNC_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type SyncMethod = (typeof SYNC_METHODS)[number];

export function isSupportedSyncMethod(value: string): value is SyncMethod {
  return SYNC_METHODS.includes(value as SyncMethod);
}

export function isSyncActionOwnedBy(
  actionUserId: string | number | undefined,
  currentUserId: string | number,
): boolean {
  return actionUserId != null && String(actionUserId) === String(currentUserId);
}

export function queuedDeliveryManifestId(endpoint: string): string | null {
  const match = endpoint.match(/^\/manifiestos\/([^/]+)\/confirmar-entrega$/);
  return match?.[1] ?? null;
}

/** Offline actions created by the transport trip screen. */
export function isTransportQueueAction(action: {type: string; endpoint: string}): boolean {
  return action.type === 'POST' && /^\/manifiestos\/[^/]+\/confirmar-(?:retiro|entrega)$/.test(action.endpoint);
}

export function hasQueuedDelivery(actions: Array<{ type: string; endpoint: string; userId?: string | number }>, owner: string | number, manifestId: string): boolean {
  return actions.some(action => action.type === 'POST' && isSyncActionOwnedBy(action.userId, owner)
    && queuedDeliveryManifestId(action.endpoint) === manifestId);
}

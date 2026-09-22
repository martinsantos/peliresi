import { describe, expect, it } from 'vitest';
import { isSupportedSyncMethod, isSyncActionOwnedBy, queuedDeliveryManifestId } from '../../services/syncQueuePolicy';

describe('offline sync queue policy', () => {
  it('matches equivalent string and numeric user identifiers', () => {
    expect(isSyncActionOwnedBy('42', 42)).toBe(true);
    expect(isSyncActionOwnedBy(42, '42')).toBe(true);
  });

  it('never replays unowned or legacy unscoped actions', () => {
    expect(isSyncActionOwnedBy(undefined, 'user-a')).toBe(false);
    expect(isSyncActionOwnedBy('user-b', 'user-a')).toBe(false);
  });

  it('only accepts explicitly supported HTTP mutation methods', () => {
    expect(isSupportedSyncMethod('POST')).toBe(true);
    expect(isSupportedSyncMethod('PATCH')).toBe(true);
    expect(isSupportedSyncMethod('GET')).toBe(false);
    expect(isSupportedSyncMethod('UNKNOWN')).toBe(false);
  });

  it('recognizes only queued delivery endpoints that require GPS ordering', () => {
    expect(queuedDeliveryManifestId('/manifiestos/m-1/confirmar-entrega')).toBe('m-1');
    expect(queuedDeliveryManifestId('/manifiestos/m-1/confirmar-retiro')).toBeNull();
    expect(queuedDeliveryManifestId('/otro/m-1/confirmar-entrega')).toBeNull();
  });
});

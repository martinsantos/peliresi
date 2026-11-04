import { describe, expect, it } from 'vitest';
import { queuedDeliveryContext, isSupportedSyncMethod, isSyncActionOwnedBy, queuedDeliveryManifestId } from '../../services/syncQueuePolicy';

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

  it('blocks tracking for a delivery saved by another account or activity on this device', () => {
    const queue = [{ type:'POST', endpoint:'/manifiestos/m-1/confirmar-entrega', userId:'42', contextOwner:'company-a' }];
    expect(queuedDeliveryContext(queue, 42, 'company-a', 'm-1')).toBe('pending');
    expect(queuedDeliveryContext(queue, 'other', 'company-a', 'm-1')).toBe('other');
    expect(queuedDeliveryContext(queue, '42', 'company-b', 'm-1')).toBe('other');
    expect(queuedDeliveryContext([{ ...queue[0], userId:undefined }], '42', 'company-a', 'm-1')).toBe('other');
    expect(queuedDeliveryContext(queue, '42', 'company-a', 'm-2')).toBe('none');
    expect(queuedDeliveryContext([{ ...queue[0], type:'GET' }], '42', 'company-a', 'm-1')).toBe('none');
  });
});

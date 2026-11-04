import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notifyDeliveryConfirmed, notifyOfflineQueueChanged, subscribeDeliveryConfirmed, subscribeOfflineQueueChanged } from '../../services/offlineSyncEvents';

let instances: Array<{ onmessage?: (event: {data: unknown}) => void; postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>;
beforeEach(() => {
  instances = [];
  vi.stubGlobal('BroadcastChannel', class {
    onmessage?: (event: {data: unknown}) => void;
    postMessage = vi.fn(); close = vi.fn();
    constructor() { instances.push(this); }
  });
});
afterEach(() => vi.unstubAllGlobals());

it('signals local and other-tab queue changes without including queue data', () => {
  const handler=vi.fn(),unsubscribe=subscribeOfflineQueueChanged(handler);
  notifyOfflineQueueChanged(); expect(handler).toHaveBeenCalledTimes(1);
  expect(instances[1].postMessage).toHaveBeenCalledWith(expect.objectContaining({kind:'queue'}));
  instances[0].onmessage?.({data:{origin:'other-tab',kind:'queue'}});expect(handler).toHaveBeenCalledTimes(2);
  unsubscribe();expect(instances[0].close).toHaveBeenCalledOnce();
});

it('delivers valid confirmation hints and ignores malformed cross-tab messages', () => {
  const handler=vi.fn(),unsubscribe=subscribeDeliveryConfirmed(handler);
  notifyDeliveryConfirmed('trip','owner');expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({id:'trip',owner:'owner'});
  instances[0].onmessage?.({data:{origin:'other-tab',kind:'delivered',id:'trip'}});expect(handler).toHaveBeenCalledTimes(1);
  instances[0].onmessage?.({data:{origin:'other-tab',kind:'delivered',id:'trip',owner:'owner'}});
  expect((handler.mock.calls[1][0] as CustomEvent).detail).toEqual({id:'trip',owner:'owner'});
  unsubscribe();expect(instances[0].close).toHaveBeenCalledOnce();
});

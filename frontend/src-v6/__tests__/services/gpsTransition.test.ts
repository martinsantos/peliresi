import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gpsContextScope,gpsQueueKey } from '../../services/gpsQueue';
import { saveFleetGpsPoint } from '../../services/fleetGpsStorage';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

const mocks = vi.hoisted(() => ({ post: vi.fn(), owner: 'carrier-a', context: 'carrier-a:transportista' }));
vi.mock('../../services/api', () => ({ default: { post: mocks.post } }));
vi.mock('../../utils/supportSession', () => ({
  supportRequestContext: () => mocks.context,
  supportSessionMatches: (owner: string) => owner === mocks.owner,
}));
import { withStoredGpsBeforeTransition } from '../../services/gpsTransition';

const id = 'trip-a';
const point = { lat: -33.1, lng: -68.9, speed: null, heading: null, puntoId: '2d65f4f5-6892-42e1-958d-bd23b6d54a76' };
const ownKey = gpsQueueKey('carrier-a', id);
let restoreLocks: () => void;
beforeEach(() => {
  restoreLocks = installMockGpsLocks();
  localStorage.clear(); vi.clearAllMocks(); mocks.owner = 'carrier-a'; mocks.context = 'carrier-a:transportista';
  mocks.post.mockResolvedValue({ data: { success: true, data: { idempotencia: { version: 1, puntoId: point.puntoId } } } });
});
afterEach(() => { localStorage.clear(); restoreLocks(); });

describe('GPS safety before a trip transition', () => {
  it.each(['entrega', 'relevo'])('does not perform %s when the local queue is an empty corrupt string', async () => {
    const scope = gpsContextScope('company-a', mocks.context), key = gpsQueueKey('carrier-a', id, scope);
    localStorage.setItem(key, '');
    const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action, scope)).rejects.toThrow('No se pudieron leer');
    expect(action).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe('');
  });

  it('blocks a transition from another screen when this browser has a fleet point pending', async () => {
    const item={targetKey:JSON.stringify(['other-account:transportista','MANIFIESTO:'+id]),puntoId:point.puntoId,
      observedAt:Date.now(),point:{latitud:-33,longitud:-69,precision:10}};
    saveFleetGpsPoint(item); const action=vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a',id,action)).rejects.toThrow('GPS de varias cargas sin confirmar');
    expect(action).not.toHaveBeenCalled();expect(mocks.post).not.toHaveBeenCalled();
  });

  it('checks fleet points again after synchronizing the individual queue', async () => {
    localStorage.setItem(ownKey,JSON.stringify([point]));
    mocks.post.mockImplementationOnce(async()=>{saveFleetGpsPoint({targetKey:JSON.stringify(['carrier-a','MANIFIESTO:'+id]),puntoId:point.puntoId,
      observedAt:Date.now(),point:{latitud:-33,longitud:-69,precision:10}});
      return {data:{success:true,data:{idempotencia:{version:1,puntoId:point.puntoId}}}};});
    const action=vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a',id,action)).rejects.toThrow('GPS de varias cargas sin confirmar');
    expect(action).not.toHaveBeenCalled();
  });

  it('retains pending points and blocks delivery when GPS cannot be sent, then retries before the action', async () => {
    localStorage.setItem(ownKey, JSON.stringify([point]));
    const action = vi.fn().mockResolvedValue('delivered');
    mocks.post.mockRejectedValueOnce(new Error('offline'));
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).rejects.toThrow('Ubicaciones pendientes');
    expect(action).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(ownKey)!)).toEqual([point]);
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).resolves.toBe('delivered');
    expect(localStorage.getItem(ownKey)).toBeNull(); expect(action).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenLastCalledWith(`/manifiestos/${id}/ubicacion-idempotente`, expect.objectContaining({ puntoId: point.puntoId }));
  });

  it('blocks a different account without uploading, deleting or adopting its pending points', async () => {
    const otherKey = gpsQueueKey('other-carrier', id);
    localStorage.setItem(otherKey, JSON.stringify([point]));
    const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).rejects.toThrow('otra cuenta');
    expect(mocks.post).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(otherKey)!)).toEqual([point]);
  });

  it('blocks a handoff from another activity of the same account without moving the points', async () => {
    const scopeA = gpsContextScope('company-a',mocks.context),scopeB=gpsContextScope('company-b',mocks.context);
    const keyA = gpsQueueKey('carrier-a', id, scopeA);
    localStorage.setItem(keyA, JSON.stringify([point]));
    const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action, scopeB)).rejects.toThrow('otra actividad');
    expect(mocks.post).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(keyA)!)).toEqual([point]);
    await withStoredGpsBeforeTransition('carrier-a', id, action, scopeA);
    expect(mocks.post).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce();
  });

  it('does not assign a legacy account-only queue to the active activity', async () => {
    localStorage.setItem(ownKey, JSON.stringify([point])); const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action, gpsContextScope('company-a',mocks.context))).rejects.toThrow('sin actividad identificada');
    expect(mocks.post).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(ownKey)!)).toEqual([point]);
  });

  it('rejects a stale activity scope before sending points or registering a handoff', async () => {
    const oldScope=gpsContextScope('company-a','previous-session'),keyA=gpsQueueKey('carrier-a',id,oldScope);
    localStorage.setItem(keyA,JSON.stringify([point])); const action=vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a',id,action,oldScope)).rejects.toThrow('cuenta o actividad cambió');
    expect(mocks.post).not.toHaveBeenCalled();expect(action).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(keyA)!)).toEqual([point]);
  });

  it('can synchronize the current account first while preserving the other account’s pending work', async () => {
    const otherKey = gpsQueueKey('other-carrier', id);
    localStorage.setItem(ownKey, JSON.stringify([point]));
    localStorage.setItem(otherKey, JSON.stringify([point]));
    const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).rejects.toThrow('otra cuenta');
    expect(mocks.post).toHaveBeenCalledOnce(); expect(localStorage.getItem(ownKey)).toBeNull();
    expect(action).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(otherKey)!)).toEqual([point]);
  });

  it('keeps the point for its owner if the activity changes while its response is in flight', async () => {
    localStorage.setItem(ownKey, JSON.stringify([point]));
    mocks.post.mockImplementationOnce(async () => { mocks.context = 'carrier-a:otra-actividad';
      return { data: { success: true, data: { idempotencia: { version: 1, puntoId: point.puntoId } } } }; });
    const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).rejects.toThrow('cuenta o actividad cambió');
    expect(action).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(ownKey)!)).toEqual([point]);
  });

  it('does not proceed without the original authenticated account context', async () => {
    mocks.owner = 'other'; const action = vi.fn();
    await expect(withStoredGpsBeforeTransition('carrier-a', id, action)).rejects.toThrow('cuenta o actividad cambió');
    expect(mocks.post).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
  });
});

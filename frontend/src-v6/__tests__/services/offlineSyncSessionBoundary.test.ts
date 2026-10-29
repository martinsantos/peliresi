import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gpsQueueKey } from '../../services/gpsQueue';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

const mock = vi.hoisted(() => ({ post:vi.fn() }));
vi.mock('../../services/api', () => ({ default:{ post:mock.post } }));

const transportContext = { owner:'transport-context', role:'TRANSPORTISTA', companyScoped:false };
let restoreLocks: () => void;
beforeEach(() => { restoreLocks = installMockGpsLocks(); vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); restoreLocks(); });

it('stops a queued delivery before sending another point under a different session', async () => {
  const actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  const writes = vi.fn();
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { writes(); queueMicrotask(() => transaction.oncomplete?.()); },
        put:() => { writes(); queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const first = { lat:-33.1, lng:-68.1, speed:null, heading:null }, second = { lat:-33.2, lng:-68.2, speed:null, heading:null };
  const key = gpsQueueKey('account-a', 'trip');
  localStorage.setItem(key, JSON.stringify([first, second]));
  let acknowledge!: (value: unknown) => void;
  mock.post.mockImplementationOnce(() => new Promise<unknown>(resolve => { acknowledge = resolve; }));
  let current = true;
  const { processSyncQueue } = await import('../../services/indexeddb');
  const processing = processSyncQueue('account-a', transportContext, false, () => current);
  await vi.waitFor(() => expect(mock.post).toHaveBeenCalledOnce());
  current = false;
  const reference = mock.post.mock.calls[0][1].puntoId;
  acknowledge({ data: { success: true, data: { idempotencia: { version: 1, puntoId: reference } } } });
  const result = await processing;
  expect(result.pending).toBe(1);
  expect(mock.post).toHaveBeenCalledExactlyOnceWith('/manifiestos/trip/ubicacion-idempotente', { latitud:-33.1, longitud:-68.1, puntoId: expect.any(String) });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ ...second, puntoId: expect.any(String) }]);
  expect(writes).not.toHaveBeenCalled();
});

it('retains a queued delivery when another account has pending GPS on this device', async () => {
  const actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  const writes: unknown[] = [];
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { throw new Error('A pending delivery must not be removed'); },
        put:(value:unknown) => { writes.push(value); queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const foreignKey = gpsQueueKey('account-b', 'trip');
  const points = [{ lat:-33.2, lng:-68.2, speed:null, heading:null }];
  localStorage.setItem(foreignKey, JSON.stringify(points));
  const { processSyncQueue } = await import('../../services/indexeddb');
  const result = await processSyncQueue('account-a', transportContext, false, () => true);
  expect(result.pending).toBe(1); expect(result.retryable).toBe(1); expect(result.lastError).toMatch(/otra cuenta/i);
  expect(mock.post).not.toHaveBeenCalled(); expect(writes).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(foreignKey)!)).toEqual(points);
});

it('keeps an offline delivery pending while another page has this trip GPS, then retries', async () => {
  let actions = [{ id:1, type:'POST', endpoint:'/manifiestos/trip/confirmar-entrega', data:{}, userId:'account-a', createdAt:'2026-10-28T00:00:00Z' }];
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:() => { actions = []; queueMicrotask(() => transaction.oncomplete?.()); },
        put:(value:typeof actions[number]) => { actions = [value]; queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  const { startGpsLease } = await import('../../services/gpsCoordination');
  const { processSyncQueue } = await import('../../services/indexeddb');
  const tracker = startGpsLease('trip', () => {}, () => { throw new Error('expected tracker lease'); });
  const blocked = await processSyncQueue('account-a', transportContext, true, () => true);
  expect(blocked.pending).toBe(1); expect(blocked.lastError).toMatch(/otra pestaña/i);
  expect(mock.post).not.toHaveBeenCalled();
  await tracker.release();
  mock.post.mockResolvedValue({});
  const retried = await processSyncQueue('account-a', transportContext, true, () => true);
  expect(retried.processed).toBe(1); expect(retried.pending).toBe(0);
  expect(mock.post).toHaveBeenCalledExactlyOnceWith('/manifiestos/trip/confirmar-entrega', {});
});

function mockQueue(initial: Array<{id:number;type:string;endpoint:string;data:unknown;userId:string;createdAt:string;contextOwner?:string;failureKind?:'retryable'|'terminal'|'auth'}>) {
  let actions = [...initial];
  const reads = vi.fn();
  vi.stubGlobal('indexedDB', { open:vi.fn(() => {
    const request: { result:unknown; onsuccess?:()=>void } = { result:{ transaction:() => {
      const transaction: { oncomplete?:()=>void; objectStore:()=>unknown } = { objectStore:() => ({
        getAll:() => { reads(); const read: { result:unknown; onsuccess?:()=>void } = { result:[...actions] }; queueMicrotask(() => read.onsuccess?.()); return read; },
        delete:(id:number) => { actions = actions.filter(action=>action.id!==id); queueMicrotask(() => transaction.oncomplete?.()); },
        put:(value:typeof actions[number]) => { actions = [...actions.filter(action=>action.id!==value.id),value]; queueMicrotask(() => transaction.oncomplete?.()); },
      }) };
      return transaction;
    } } };
    queueMicrotask(() => request.onsuccess?.()); return request;
  }) });
  return { reads, remaining:()=>actions };
}

it('waits for the first tab to remove its action before the second reads the queue', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]); let acknowledge!:()=>void;
  mock.post.mockImplementationOnce(()=>new Promise<void>(resolve=>{acknowledge=resolve;}));
  const {processSyncQueue}=await import('../../services/indexeddb');
  const first=processSyncQueue('account-a',transportContext);
  await vi.waitFor(()=>expect(mock.post).toHaveBeenCalledOnce());
  const second=processSyncQueue('account-a',transportContext);
  await Promise.resolve();expect(store.reads).toHaveBeenCalledOnce();
  acknowledge(); const [firstResult,secondResult]=await Promise.all([first,second]);
  expect(firstResult.processed).toBe(1);expect(secondResult.pending).toBe(0);
  expect(mock.post).toHaveBeenCalledOnce();expect(store.remaining()).toEqual([]);
});

it('does not requeue an acknowledged delivery when clearing its local snapshot fails', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]);mock.post.mockResolvedValue({});
  const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('storage denied');});
  try{
    const {processSyncQueue}=await import('../../services/indexeddb');
    const result=await processSyncQueue('account-a',transportContext);
    expect(result).toMatchObject({processed:1,pending:0,cleanupError:true});
    expect(result.lastError).toMatch(/entrega se confirmó.*copia local/i);
    expect(mock.post).toHaveBeenCalledOnce();expect(store.remaining()).toEqual([]);
  }finally{remove.mockRestore();}
});

it('does not inspect or send a waiting account after its active context changes', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]);let acknowledge!:()=>void,current=true;
  mock.post.mockImplementationOnce(()=>new Promise<void>(resolve=>{acknowledge=resolve;}));
  const {processSyncQueue}=await import('../../services/indexeddb');
  const first=processSyncQueue('account-a',transportContext);await vi.waitFor(()=>expect(mock.post).toHaveBeenCalledOnce());
  const second=processSyncQueue('account-a',transportContext,false,()=>current);current=false;acknowledge();
  await Promise.all([first,second]);
  expect(store.reads).toHaveBeenCalledOnce();expect(mock.post).toHaveBeenCalledOnce();
});

it('keeps a scoped delivery under its original activity until that activity returns', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z',contextOwner:'transport-context'};
  const store=mockQueue([action]);
  const {processSyncQueue}=await import('../../services/indexeddb');
  const different=await processSyncQueue('account-a',{owner:'generator-context',role:'GENERADOR',companyScoped:false},true);
  expect(different).toMatchObject({pending:1,retryable:1,skipped:1,auth:0,terminal:0});
  expect(different.lastError).toMatch(/volvé a transporte/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
  mock.post.mockResolvedValue({});
  expect((await processSyncQueue('account-a',transportContext)).processed).toBe(1);
  expect(mock.post).toHaveBeenCalledOnce();expect(store.remaining()).toEqual([]);
});

it('does not replay a scoped delivery for another company with the same role', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z',contextOwner:'company-a'};
  const store=mockQueue([action]);
  const {processSyncQueue}=await import('../../services/indexeddb');
  expect((await processSyncQueue('account-a',{owner:'company-b',role:'TRANSPORTISTA',companyScoped:true},true)).pending).toBe(1);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
  mock.post.mockResolvedValue({});
  expect((await processSyncQueue('account-a',{owner:'company-a',role:'TRANSPORTISTA',companyScoped:true})).processed).toBe(1);
});

it('holds legacy transport actions under a different role and permits the original personal role', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]);
  const {processSyncQueue}=await import('../../services/indexeddb');
  const wrong=await processSyncQueue('account-a',{owner:'generator-context',role:'GENERADOR',companyScoped:false},true);
  expect(wrong).toMatchObject({pending:1,retryable:1,auth:0,terminal:0});expect(wrong.lastError).toMatch(/volvé a transporte/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
  mock.post.mockResolvedValue({});
  expect((await processSyncQueue('account-a',transportContext)).processed).toBe(1);
});

it('offers an explicit retry for a legacy transport action previously rejected for authorization', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z',failureKind:'auth' as const};
  const store=mockQueue([action]);
  const {processSyncQueue}=await import('../../services/indexeddb');
  const pending=await processSyncQueue('account-a',transportContext);
  expect(pending).toMatchObject({pending:1,retryable:1,auth:0,skipped:1});
  expect(pending.lastError).toMatch(/no se pudo autorizar.*Reintentar/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
  mock.post.mockResolvedValue({});
  expect((await processSyncQueue('account-a',transportContext,true)).processed).toBe(1);
});

it('retains a legacy action with ambiguous company or unknown type for review', async () => {
  const common={type:'POST',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([{...common,id:1,endpoint:'/manifiestos/trip/confirmar-entrega'}, {...common,id:2,endpoint:'/other-action'}]);
  const {processSyncQueue}=await import('../../services/indexeddb');
  const result=await processSyncQueue('account-a',{owner:'company-a',role:'TRANSPORTISTA',companyScoped:true},true);
  expect(result).toMatchObject({pending:2,retryable:2,skipped:2});expect(result.lastError).toMatch(/consultá a soporte/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toHaveLength(2);
});

it('lets distinct accounts synchronize their own actions independently', async () => {
  const store=mockQueue([
    {id:1,type:'POST',endpoint:'/manifiestos/trip-a/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'},
    {id:2,type:'POST',endpoint:'/manifiestos/trip-b/confirmar-entrega',data:{},userId:'account-b',createdAt:'2026-10-28T00:00:00Z'},
  ]);
  let finishA!:()=>void;
  mock.post.mockImplementation((url:string)=>url.includes('trip-a')?new Promise<void>(resolve=>{finishA=resolve;}):Promise.resolve());
  const {processSyncQueue}=await import('../../services/indexeddb');
  const first=processSyncQueue('account-a',transportContext);await vi.waitFor(()=>expect(mock.post).toHaveBeenCalledOnce());
  const second=await processSyncQueue('account-b',transportContext);
  expect(second.processed).toBe(1);expect(store.remaining().map(action=>action.id)).toEqual([1]);
  finishA();expect((await first).processed).toBe(1);expect(store.remaining()).toEqual([]);
  expect(mock.post.mock.calls.map(call=>call[0])).toEqual(['/manifiestos/trip-a/confirmar-entrega','/manifiestos/trip-b/confirmar-entrega']);
});

it('preserves queued work and explains when the browser cannot coordinate synchronization', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]);Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
  const {processSyncQueue}=await import('../../services/indexeddb');
  const result=await processSyncQueue('account-a',transportContext);
  expect(result).toMatchObject({processed:0,pending:1,retryable:1,skipped:1});
  expect(result.lastError).toMatch(/navegador.*coordinar/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
});

it('preserves existing failure categories when synchronization cannot be coordinated', async () => {
  const common={type:'POST',data:{},createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([
    {...common,id:1,endpoint:'/one',userId:'account-a',failureKind:'terminal'},
    {...common,id:2,endpoint:'/two',userId:'account-a',failureKind:'auth'},
    {...common,id:3,endpoint:'/three',userId:'account-a'},
    {...common,id:4,endpoint:'/other',userId:'account-b',failureKind:'terminal'},
  ]);
  Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
  const {processSyncQueue}=await import('../../services/indexeddb');
  const result=await processSyncQueue('account-a',transportContext);
  expect(result).toMatchObject({processed:0,pending:3,retryable:1,terminal:1,auth:1,skipped:3});
  expect(result.lastError).toMatch(/navegador.*coordinar/i);
  expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toHaveLength(4);
});

it('offers a retry instead of waiting indefinitely for another page', async () => {
  const action={id:1,type:'POST',endpoint:'/manifiestos/trip/confirmar-entrega',data:{},userId:'account-a',createdAt:'2026-10-28T00:00:00Z'};
  const store=mockQueue([action]);let release!:()=>void;
  const held=navigator.locks.request('sitrep:offline-sync:account-a',{mode:'exclusive'},async()=>new Promise<void>(resolve=>{release=resolve;}));
  const {processSyncQueue}=await import('../../services/indexeddb');
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  try {
    const pending=processSyncQueue('account-a',transportContext);
    await vi.advanceTimersByTimeAsync(10_000);
    const result=await pending;
    expect(result).toMatchObject({processed:0,pending:1,retryable:1,skipped:1});
    expect(result.lastError).toMatch(/otra ventana.*reintentá/i);
    expect(mock.post).not.toHaveBeenCalled();expect(store.remaining()).toEqual([action]);
  } finally {release();await held;vi.useRealTimers();}
});

import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
 get: vi.fn(), update: vi.fn(), all: vi.fn(), remove: vi.fn(), list: vi.fn(), context:'same', matches:true,
}));
vi.mock('../../services/indexeddb', () => ({getOffline:m.get,updateOffline:m.update,getAllOffline:m.all,removeOffline:m.remove}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{list:m.list}}));
vi.mock('../../utils/supportSession',()=>({supportRequestContext:()=>m.context,supportSessionMatches:()=>m.matches}));
import {syncOfflineData,getCachedManifiestos,getLastSyncTime,clearUserOfflineData} from '../../services/offline-sync';
beforeEach(()=>{vi.clearAllMocks();m.context='same';m.matches=true;m.get.mockResolvedValue(null);m.list.mockResolvedValue({items:[{id:'owned'}]});m.update.mockImplementation(async(_s,_k,fn)=>fn(null));m.remove.mockResolvedValue(undefined);m.all.mockResolvedValue([]);});
it('separates role, site, grant and revision without inheriting legacy copies',async()=>{
 for(const owner of ['actor','role-2','site-2','grant-2','revision-2']){
  await syncOfflineData('same-account',owner);const key=m.update.mock.calls.at(-1)![1];
  expect(key).toContain('context-v2:');
  const copy=m.update.mock.results.at(-1)!.value;const value=await copy;m.get.mockResolvedValue(value);
  expect(await getCachedManifiestos('same-account',owner)).toEqual([{id:'owned'}]);
  expect(await getLastSyncTime('same-account',owner)).toEqual(expect.any(Number));
  expect(await getCachedManifiestos('same-account','different')).toEqual([]);
 }
 expect(new Set(m.update.mock.calls.map(c=>c[1])).size).toBe(5);
 expect(m.get.mock.calls.every(c=>c[1].startsWith('context-v2:'))).toBe(true);
});
it('does not read or fetch without verified owner',async()=>{
 expect(await getCachedManifiestos('one','')).toEqual([]);
 await expect(syncOfflineData('one','')).rejects.toThrow('contexto');
 expect(m.get).not.toHaveBeenCalled();expect(m.list).not.toHaveBeenCalled();
});
it('does not cache a response completed after a context switch',async()=>{
 m.list.mockImplementation(async()=>{m.context='new';return {items:[]};});
 await expect(syncOfflineData('one','owner')).rejects.toThrow('contexto');expect(m.update).not.toHaveBeenCalled();
});
it('rechecks session inside the storage transaction',async()=>{
 m.update.mockImplementation(async(_s,_k,fn)=>{m.context='new';return fn(null);});
 await expect(syncOfflineData('one','owner')).rejects.toThrow('contexto');
});
it('rejects mismatched account and malformed server lists',async()=>{
 m.matches=false;await expect(syncOfflineData('one','owner')).rejects.toThrow('contexto');expect(m.list).not.toHaveBeenCalled();
 m.matches=true;m.list.mockResolvedValue({});await expect(syncOfflineData('one','owner')).rejects.toThrow('lista válida');expect(m.update).not.toHaveBeenCalled();
});
it('surfaces a storage failure instead of showing an empty list',async()=>{
 m.get.mockRejectedValue(new Error('Cannot read'));await expect(getCachedManifiestos('one','owner')).rejects.toThrow('Cannot read');
});
it('logout removes own downloadable copies but preserves other users and unsent work',async()=>{
 m.all.mockImplementation(async(store)=>store==='inspection_cases'?[]:[
  {id:'context-v2:own',owner:JSON.stringify(['one','OPERADOR'])},
  {id:'context-v2:other',owner:JSON.stringify(['two','OPERADOR'])},
  {id:'user_one:activity:OPERADOR'}
 ]);
 await clearUserOfflineData('one');
 for(const store of ['manifiestos','catalogos']){
  expect(m.remove).toHaveBeenCalledWith(store,'context-v2:own');
  expect(m.remove).toHaveBeenCalledWith(store,'user_one:activity:OPERADOR');
  expect(m.remove).not.toHaveBeenCalledWith(store,'context-v2:other');
 }
 expect(m.all.mock.calls.map(c=>c[0])).not.toContain('inspection_exchange_drafts');
});

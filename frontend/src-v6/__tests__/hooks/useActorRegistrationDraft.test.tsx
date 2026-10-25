import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActorRegistrationDraft } from '../../hooks/useActorRegistrationDraft';
import { readRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';
const mock = vi.hoisted(() => ({ get: vi.fn(), token: '', canWrite: vi.fn(), server:null as any, read:vi.fn(), save:vi.fn(), remove:vi.fn(),download:vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: mock.get }, getAccessToken: () => mock.token }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite: mock.canWrite, retry: vi.fn() }) }));
vi.mock('../../services/actorFormDraft.service',()=>({actorFormDraftService:{read:mock.read,save:mock.save,remove:mock.remove,download:mock.download}}));
const session = (id: string) => `qa.${btoa(JSON.stringify({ id }))}.qa`;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.token = session('admin'); mock.canWrite.mockReturnValue(true);mock.server=null;mock.read.mockImplementation(async()=>mock.server);mock.save.mockImplementation(async(_scope,version,data)=>{if(version!==(mock.server?.version||0))throw {response:{status:409}};return mock.server={version:version+1,data,savedAt:new Date().toISOString(),files:[]};});mock.remove.mockResolvedValue(undefined);
  mock.get.mockResolvedValue({ data: { data: { user: { id: 'admin' } } } }); });
describe('all administrative actor drafts use a verified account and actual saved documents', () => {
  it('remains checking until both the session and the remote draft are known', async () => {
    let finish!: (value: unknown) => void;
    mock.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHook(() => useActorRegistrationDraft('GENERADOR', 'qa-actor', {}, vi.fn(), false));
    expect(view.result.current.checking).toBe(true);
    await waitFor(() => expect(mock.read).toHaveBeenCalledOnce());
    expect(view.result.current.checking).toBe(true);
    await act(async () => finish(null));
    await waitFor(() => expect(view.result.current.checking).toBe(false));
    expect(view.result.current.error).toBeNull();
  });
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('%s persists and recovers without a password or actor creation', async type => {
    const restore = vi.fn(), data = { form: { razonSocial: 'QA', cuit: '30-12345678-9', password: 'DO-NOT-STORE' }, step: 2 };
    const first = renderHook(() => useActorRegistrationDraft(type, undefined, data, restore, true));
    await waitFor(() => expect(first.result.current.saved).toBe(true));
    expect(readRegistrationDraft('admin', `admin:${type}:new`)?.data.form).toEqual({ razonSocial: 'QA', cuit: '30-12345678-9' });
    first.unmount(); const second = renderHook(() => useActorRegistrationDraft(type, undefined, {}, restore, false));
    await waitFor(() => expect(second.result.current.available).not.toBeNull());
    await act(async () => second.result.current.restore());
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ form: { razonSocial: 'QA', cuit: '30-12345678-9' } }),{});
  });
  it('keeps a partial registration on the server and reads confirmed documents rather than trusting local saved labels', async () => {
    writeRegistrationDraft('admin', 'admin:GENERADOR:new', { form: { cuit: '30-12345678-9' }, savedActorId: 'created', uploadedDocs: { FAKE: 'not-uploaded.pdf' } });
    mock.get.mockImplementation(async url => ({ data: { data: url === '/auth/profile' ? { user: { id: 'admin' } }
      : url.endsWith('/documentos') ? { documentos: [{ id: 'doc', tipo: 'MEMORIA_TECNICA', nombre: 'real.pdf' }] }
      : { generador: { id: 'created', cuit: '30-12345678-9' } } } }));
    const restore = vi.fn(); const { result } = renderHook(() => useActorRegistrationDraft('GENERADOR', undefined, {}, restore, false));
    await waitFor(() => expect(result.current.available).not.toBeNull()); await act(async () => result.current.restore());
    expect(restore.mock.calls[0][0].uploadedDocs).toEqual({ MEMORIA_TECNICA: 'real.pdf' });
    expect(mock.get).toHaveBeenCalledWith('/actores/generadores/created/documentos');
  });
  it('does not adopt a fabricated saved actor belonging to another CUIT', async () => {
    writeRegistrationDraft('admin', 'admin:GENERADOR:new', { form: { cuit: '30-12345678-9' }, savedActorId: 'foreign' });
    mock.get.mockImplementation(async url => ({ data: { data: url === '/auth/profile' ? { user: { id: 'admin' } } : { generador: { cuit: '30-99999999-9' } } } }));
    const restore = vi.fn(); const { result } = renderHook(() => useActorRegistrationDraft('GENERADOR', undefined, {}, restore, false));
    await waitFor(() => expect(result.current.available).not.toBeNull()); await act(async () => result.current.restore());
    expect(restore).not.toHaveBeenCalled(); expect(result.current.error).toContain('no coincide');
  });
  it('blocks saving after an account switch and leaves the first account draft intact', async () => {
    const { result } = renderHook(() => useActorRegistrationDraft('OPERADOR', undefined, { form: { razonSocial: 'PRIVATE-QA' } }, vi.fn(), true));
    await waitFor(() => expect(result.current.saved).toBe(true)); mock.token = session('other');
    await act(async () => { expect(await result.current.checkpoint()).toBe(false); });
    expect(readRegistrationDraft('other', 'admin:OPERADOR:new')).toBeNull(); expect(readRegistrationDraft('admin', 'admin:OPERADOR:new')).not.toBeNull();
  });
  it('clears the visible form on an account boundary without copying the previous private draft into the new account', async () => {
    const { result, rerender } = renderHook(() => {
      const [data, restore] = useState<Record<string, unknown>>({ form: { razonSocial: 'PRIVATE-OLD-ACCOUNT' } });
      return useActorRegistrationDraft('GENERADOR', undefined, data, restore, Boolean(data.form));
    });
    await waitFor(() => expect(result.current.saved).toBe(true));
    mock.token = session('other'); mock.get.mockResolvedValue({ data: { data: { user: { id: 'other' } } } }); rerender();
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
    expect(readRegistrationDraft('other', 'admin:GENERADOR:new')).toBeNull();
    expect(readRegistrationDraft('admin', 'admin:GENERADOR:new')?.data.form).toEqual({ razonSocial: 'PRIVATE-OLD-ACCOUNT' });
  });
});

it('continues in a clean browser with the same account and no local storage',async()=>{
 const first=renderHook(()=>useActorRegistrationDraft('GENERADOR',undefined,{form:{razonSocial:'CROSS-DEVICE',password:'PRIVATE'}},vi.fn(),true));
 await waitFor(()=>expect(first.result.current.saved).toBe(true));await act(async()=>{expect(await first.result.current.checkpoint()).toBe(true);});
 expect(mock.server.data.form).toEqual({razonSocial:'CROSS-DEVICE'});first.unmount();localStorage.clear();
 const restore=vi.fn(),second=renderHook(()=>useActorRegistrationDraft('GENERADOR',undefined,{},restore,false));
 await waitFor(()=>expect(second.result.current.available).not.toBeNull());await act(async()=>second.result.current.restore());
 expect(restore).toHaveBeenCalledWith(expect.objectContaining({form:{razonSocial:'CROSS-DEVICE'}}),{});
});
it('keeps edits visible and refuses to overwrite a newer server revision',async()=>{
 const data={form:{razonSocial:'LOCAL'}};const view=renderHook(()=>useActorRegistrationDraft('OPERADOR',undefined,data,vi.fn(),true));
 await waitFor(()=>expect(view.result.current.saved).toBe(true));mock.server={version:8,data:{form:{razonSocial:'OTHER DEVICE'}},savedAt:new Date().toISOString(),files:[]};
 await act(async()=>{expect(await view.result.current.checkpoint()).toBe(false);});
 expect(view.result.current.conflict).toBe(true);expect(mock.server.data.form.razonSocial).toBe('OTHER DEVICE');expect(readRegistrationDraft('admin','admin:OPERADOR:new')?.data.form).toEqual(data.form);
});

it('checks the revision even when this device has not changed fields since its last save',async()=>{
 const data={form:{razonSocial:'ORIGINAL'}};const view=renderHook(()=>useActorRegistrationDraft('GENERADOR',undefined,data,vi.fn(),true));
 await waitFor(()=>expect(view.result.current.saved).toBe(true));await act(async()=>{expect(await view.result.current.checkpoint()).toBe(true);});
 mock.server={...mock.server,version:mock.server.version+1,data:{form:{razonSocial:'NEWER DEVICE'}}};
 await act(async()=>{expect(await view.result.current.checkpoint()).toBe(false);});
 expect(view.result.current.conflict).toBe(true);expect(mock.server.data.form.razonSocial).toBe('NEWER DEVICE');
});
it('retries an unacknowledged write with its original request identity',async()=>{
 let previous:any,fail=true;mock.save.mockImplementation(async(_scope,version,data,requestId)=>{
  if(previous?.requestId===requestId)return mock.server;
  expect(version).toBe(mock.server?.version||0);previous={requestId};mock.server={version:version+1,data,savedAt:new Date().toISOString(),files:[]};
  if(fail){fail=false;throw new Error('Connection lost after commit');}return mock.server;
 });
 const view=renderHook(()=>useActorRegistrationDraft('OPERADOR',undefined,{form:{razonSocial:'RETRY'}},vi.fn(),true));await waitFor(()=>expect(view.result.current.saved).toBe(true));
 await act(async()=>{expect(await view.result.current.checkpoint()).toBe(false);});expect(view.result.current.cloudSaved).toBe(false);
 await act(async()=>{expect(await view.result.current.checkpoint()).toBe(true);});
 expect(mock.save.mock.calls[0][3]).toBe(mock.save.mock.calls[1][3]);expect(mock.server.data.form.razonSocial).toBe('RETRY');expect(view.result.current.error).toBeNull();
});

it('does not mistake an older server file with the same name for an unsaved replacement',async()=>{
 mock.server={version:2,data:{form:{razonSocial:'QA'}},savedAt:'2020-01-01T00:00:00Z',files:[{kind:'ATM',name:'receipt.pdf'}]};
 writeRegistrationDraft('admin','admin:GENERADOR:new',{form:{razonSocial:'LOCAL'},files:['receipt.pdf'],_draftPendingFiles:['ATM']});
 const restore=vi.fn(),view=renderHook(()=>useActorRegistrationDraft('GENERADOR',undefined,{},restore,false));await waitFor(()=>expect(view.result.current.available).not.toBeNull());
 await act(async()=>view.result.current.restore());expect(mock.download).not.toHaveBeenCalled();expect(restore).toHaveBeenCalledWith(expect.objectContaining({files:['receipt.pdf']}),{});
});

it('does not restore a late attachment response into another actor form',async()=>{
 const original={version:2,data:{form:{razonSocial:'FIRST ACTOR'}},savedAt:new Date().toISOString(),files:[{kind:'ATM',name:'receipt.pdf'}]};
 const next={version:9,data:{form:{razonSocial:'SECOND ACTOR'}},savedAt:new Date().toISOString(),files:[]};
 mock.read.mockImplementation(async scope=>scope.endsWith(':first')?original:next);
 let finish!:(file:unknown)=>void;mock.download.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const restore=vi.fn(),view=renderHook(({id})=>useActorRegistrationDraft('GENERADOR',id,{},restore,false),{initialProps:{id:'first'}});
 await waitFor(()=>expect(view.result.current.available?.scope).toBe('admin:GENERADOR:first'));
 let pending!:Promise<void>;act(()=>{pending=view.result.current.restore();});
 await waitFor(()=>expect(mock.download).toHaveBeenCalledOnce());
 view.rerender({id:'second'});await waitFor(()=>expect(view.result.current.available?.scope).toBe('admin:GENERADOR:second'));
 await act(async()=>{finish({file:new File(['QA'],'receipt.pdf',{type:'application/pdf'})});await pending;});
 expect(restore).not.toHaveBeenCalled();expect(view.result.current.available?.scope).toBe('admin:GENERADOR:second');
 expect(view.result.current.error).toBeNull();
});

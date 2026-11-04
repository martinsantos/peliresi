import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReporteManifiestos, useReporteTratados, useReporteTransporte, useExportarReporte } from '../../hooks/useReportes';
import { useCentroControl } from '../../hooks/useCentroControl';

const state = vi.hoisted(() => ({ user: { id: 'a', rol: 'GENERADOR', actorId: 'g' } as any, restricted: false, get: vi.fn(), export: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user, isRestricted: state.restricted }) }));
vi.mock('../../services/reporte.service', () => ({ reporteService: { manifiestos: state.get, tratados: state.get, transporte: state.get, exportar: state.export } }));
vi.mock('../../services/api', () => ({ default: { get: async () => ({data:{data:await state.get()}}) } }));
beforeEach(()=>{state.user={id:'a',rol:'GENERADOR',actorId:'g'};state.restricted=false;state.get.mockReset();state.export.mockReset();});
afterEach(cleanup);
const hooks=[useReporteManifiestos,useReporteTratados,useReporteTransporte,()=>useCentroControl({},false)];
it.each(hooks.map((hook,index)=>({hook,index})))('isolates report $index during an activity change and a late response',async({hook})=>{
 let resolveOld!:(value:any)=>void;
 state.get.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValue({owner:'new'});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=renderHook(()=>hook({page:1}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 await waitFor(()=>expect(state.get).toHaveBeenCalledOnce());
 state.user={id:'a',rol:'OPERADOR',actorId:'o'};view.rerender();
 expect(view.result.current.data).toBeUndefined();
 await act(async()=>resolveOld({owner:'old'}));
 await waitFor(()=>expect(view.result.current.data).toEqual({owner:'new'}));
 view.unmount();client.clear();
});
it.each([null,'restricted'])('does not fetch reports without full access: %s', mode=>{
 if(mode===null)state.user=null;else state.restricted=true;
 const client=new QueryClient();
 const view=renderHook(()=>hooks.map(hook=>hook({page:1})),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 expect(state.get).not.toHaveBeenCalled();view.unmount();client.clear();
});

it.each(['context','unmount'])('does not download a late CSV after %s',async(mode)=>{
 let finish!:(value:Blob)=>void;
 state.export.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const download=vi.fn();const OriginalURL=URL;
 vi.stubGlobal('URL',class extends OriginalURL {static createObjectURL=download;static revokeObjectURL=vi.fn();});
 const client=new QueryClient();
 const view=renderHook(()=>useExportarReporte(),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 act(()=>view.result.current.mutate({tipo:'manifiestos',formato:'csv'}));
 await waitFor(()=>expect(state.export).toHaveBeenCalledOnce());
 if(mode==='context'){state.user={id:'b',rol:'OPERADOR',actorId:'o'};view.rerender();}else view.unmount();
 await act(async()=>finish(new Blob(['private old data'])));
 if(mode==='context')await waitFor(()=>expect(view.result.current.isSuccess).toBe(true));
 expect(download).not.toHaveBeenCalled();view.unmount();client.clear();vi.unstubAllGlobals();
});

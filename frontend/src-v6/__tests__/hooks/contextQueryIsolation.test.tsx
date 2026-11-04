import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const m=vi.hoisted(()=>({user:{id:'one',rol:'OPERADOR',actorId:'actor',empresaContexto:{empresaId:'company',actividadId:'activity',establecimientoId:'site',autorizacionId:'grant',revision:1,todasSedes:false}} as any,restricted:false,defer:false,reject:null as any,fetch:vi.fn(),get:vi.fn(),save:vi.fn(),context:'same'}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:m.user,isRestricted:m.restricted})}));
vi.mock('../../utils/supportSession',()=>({supportRequestContext:()=>m.context,supportSessionMatches:()=>true}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{list:m.fetch,getById:m.fetch,dashboard:m.fetch}}));
vi.mock('../../services/actores.service',()=>({actoresService:{listGeneradores:m.fetch,getGenerador:m.fetch,listOperadores:m.fetch,getOperador:m.fetch,listTransportistas:m.fetch,getTransportista:m.fetch,listVehiculos:m.fetch,listChoferes:m.fetch,getHistorialActor:m.fetch}}));
vi.mock('../../services/analytics.service',()=>({analyticsService:{getDashboardStats:m.fetch,getManifiestosPorMes:m.fetch,getResiduosPorTipo:m.fetch,getManifiestosPorEstado:m.fetch,getTiempoPromedioPorEtapa:m.fetch}}));
vi.mock('../../services/catalogo.service',()=>({catalogoService:{tiposResiduo:m.fetch,generadores:m.fetch,transportistas:m.fetch,operadores:m.fetch,vehiculos:m.fetch,choferes:m.fetch,allTratamientos:m.fetch}}));
vi.mock('../../services/indexeddb',()=>({getOffline:m.get,saveOffline:m.save,updateOffline:m.save}));
vi.mock('../../services/offline-sync',()=>({getCachedManifiestos:vi.fn().mockResolvedValue([])}));
import {useManifiestos,useManifiesto,useManifiestoDashboard} from '../../hooks/useManifiestos';
import {useGeneradores,useGenerador} from '../../hooks/useGeneradores';
import {useTransportistas,useTransportista,useVehiculos,useChoferes} from '../../hooks/useTransportistas';
import {useOperadores,useOperador} from '../../hooks/useOperadores';
import {useHistorialActor} from '../../hooks/useActores';
import {useDashboardStats,useManifiestosPorMes,useResiduosPorTipo,useManifiestosPorEstado,useTiempoPromedioPorEtapa} from '../../hooks/useDashboard';
import {useCatalogoGeneradores,useCatalogoTransportistas,useCatalogoOperadores,useCatalogoVehiculos,useCatalogoChoferes,useTiposResiduo,useTiposResiduoEnriched,useAllTratamientos} from '../../hooks/useCatalogos';
const readers:[string,()=>any][]=[
 ['manifests',()=>useManifiestos()],['manifest detail',()=>useManifiesto('same-id')],['manifest dashboard',()=>useManifiestoDashboard()],
 ['generators',()=>useGeneradores()],['generator detail',()=>useGenerador('same-id')],['operators',()=>useOperadores()],['operator detail',()=>useOperador('same-id')],
 ['carriers',()=>useTransportistas()],['carrier detail',()=>useTransportista('same-id')],['vehicles',()=>useVehiculos('same-id')],['drivers',()=>useChoferes('same-id')],['history',()=>useHistorialActor('OPERADOR','same-id')],
 ['dashboard stats',()=>useDashboardStats()],['monthly graph',()=>useManifiestosPorMes()],['waste graph',()=>useResiduosPorTipo()],['states graph',()=>useManifiestosPorEstado()],['timing graph',()=>useTiempoPromedioPorEtapa()],
 ['generator catalog',()=>useCatalogoGeneradores()],['carrier catalog',()=>useCatalogoTransportistas()],['operator catalog',()=>useCatalogoOperadores()],['vehicle catalog',()=>useCatalogoVehiculos()],['driver catalog',()=>useCatalogoChoferes()],['waste catalog',()=>useTiposResiduo()],['enriched waste',()=>useTiposResiduoEnriched()],['treatments',()=>useAllTratamientos()]
];
let clients:QueryClient[]=[];
beforeEach(()=>{
 m.user={id:'one',rol:'OPERADOR',actorId:'actor',empresaContexto:{empresaId:'company',actividadId:'activity',establecimientoId:'site',autorizacionId:'grant',revision:1,todasSedes:false}};
 m.restricted=false;m.defer=false;m.reject=null;m.context='same';m.get.mockReset().mockResolvedValue(null);m.save.mockReset().mockImplementation(async(_store,key,update)=>typeof update==='function'?update(null):undefined);
 m.fetch.mockReset().mockImplementation(()=>m.reject?Promise.reject(m.reject):m.defer?new Promise(()=>{}):Promise.resolve({mark:'first-secret',tiposResiduos:[{id:'first-secret'}]}));
 vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
});
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients=[];vi.restoreAllMocks();});
function show(read:()=>any){const c=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:60000}}});clients.push(c);return renderHook(read,{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={c}>{children}</QueryClientProvider>});}
it.each(readers)('%s never reuses prior activity/site data when the shared query client survives',async(_,read)=>{
 const h=show(read);await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));expect(JSON.stringify(h.result.current.data)).toContain('first-secret');
 m.defer=true;m.user={...m.user,empresaContexto:{...m.user.empresaContexto,establecimientoId:'other-site'}};h.rerender();
 expect(h.result.current.data).toBeUndefined();
});
it.each(readers)('%s does not issue a request for a restricted session',async(_,read)=>{
 m.restricted=true;const h=show(read);await act(async()=>{await Promise.resolve();});expect(m.fetch).not.toHaveBeenCalled();expect(h.result.current.data).toBeUndefined();
});
it.each([401,403,429,500,503])('catalog HTTP %s is not disguised by an old offline copy',async status=>{
 m.reject={response:{status},message:'Denied'};m.get.mockResolvedValue({data:[{id:'previous-reader'}]});
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(h.result.current.data).toBeUndefined();expect(m.get).not.toHaveBeenCalled();
});
it('catalog does not persist a response after its request context changed',async()=>{
 let resolve!:(v:any)=>void;m.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(m.fetch).toHaveBeenCalled());
 m.context='changed';await act(async()=>{resolve([{id:'old-context'}]);});expect(m.save).not.toHaveBeenCalled();
});

it.each([
 ['account',(u:any)=>({...u,id:'other'})],
 ['role',(u:any)=>({...u,rol:'GENERADOR'})],
 ['actor',(u:any)=>({...u,actorId:'other'})],
 ['company',(u:any)=>({...u,empresaContexto:{...u.empresaContexto,empresaId:'other'}})],
 ['activity',(u:any)=>({...u,empresaContexto:{...u.empresaContexto,actividadId:'other'}})],
 ['grant',(u:any)=>({...u,empresaContexto:{...u.empresaContexto,autorizacionId:'other'}})],
 ['revision',(u:any)=>({...u,empresaContexto:{...u.empresaContexto,revision:2}})],
 ['CAP',(u:any)=>({...u,training:true})],
] as const)('catalog separates a changed %s',async(_name,change)=>{
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));
 m.defer=true;m.user=change(m.user);h.rerender();expect(h.result.current.data).toBeUndefined();
});
it('restricted transition removes previously visible data',async()=>{
 const h=show(()=>useGeneradores());await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));
 m.fetch.mockClear();m.restricted=true;h.rerender();expect(h.result.current.data).toBeUndefined();expect(m.fetch).not.toHaveBeenCalled();
});
it('offline catalogue can read only its exact owner copy',async()=>{
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));
 const [_store,key,update]=m.save.mock.calls[0];const copy=update(null);
 cleanup();m.fetch.mockClear();vi.spyOn(navigator,'onLine','get').mockReturnValue(false);m.get.mockResolvedValue(copy);
 const same=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(same.result.current.isSuccess).toBe(true));
 expect(m.get).toHaveBeenCalledWith('catalogos',key);expect(m.fetch).not.toHaveBeenCalled();
 m.user={...m.user,empresaContexto:{...m.user.empresaContexto,revision:2}};same.rerender();
 await waitFor(()=>expect(same.result.current.isError).toBe(true));expect(same.result.current.data).toBeUndefined();
});
it('catalog rechecks context inside the download transaction',async()=>{
 m.save.mockImplementationOnce(async(_store,key,update)=>{m.context='new';return update(null);});
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(h.result.current.data).toBeUndefined();
});
it('catalog storage failure does not discard the server result',async()=>{
 m.save.mockRejectedValue(new Error('Quota'));const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));
});
it('catalog read failure remains an error offline',async()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);m.get.mockRejectedValue(new Error('Cannot read'));
 const h=show(()=>useCatalogoGeneradores());await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(m.fetch).not.toHaveBeenCalled();
});

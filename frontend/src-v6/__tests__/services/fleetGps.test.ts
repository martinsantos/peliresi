import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({post:vi.fn(),get:vi.fn(),manifest:vi.fn(),relay:vi.fn(),receipt:vi.fn()}));
vi.mock('../../services/api',()=>({api:{post:mocks.post,get:mocks.get},default:{get:mocks.get}}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{actualizarUbicacion:mocks.manifest}}));
vi.mock('../../services/limited-transport-gps',()=>({limitedLegRequest:mocks.relay,limitedLegReceipt:mocks.receipt,
  relayCapabilityVersion:(value:string)=>JSON.parse(atob(value.split('.')[1])).jti}));
import {fleetGpsService,type FleetGpsLoad} from '../../services/fleet-gps.service';
const point={latitud:-33,longitud:-69,precision:10,velocidad:2,direccion:90};
const reference='1949916e-22df-4dc1-9d1e-98f98a3eab26';
const token=(jti:string)=>`header.${btoa(JSON.stringify({jti}))}.signature`;
const base={key:'a',id:'manifest',numero:'QA',origen:'QA',destino:'QA',fechaInicio:null,referenciaTiempo:'',patente:null,puedeEntregar:true,gpsDisponible:true} satisfies Omit<FleetGpsLoad,'kind'>;
beforeEach(()=>{vi.resetAllMocks();mocks.manifest.mockResolvedValue(undefined);mocks.relay.mockResolvedValue({});});
it('passes the retry reference to the versioned manifest GPS contract',async()=>{
  await fleetGpsService.send({...base,kind:'MANIFIESTO'},point,new Map(),reference);
  expect(mocks.manifest).toHaveBeenCalledWith('manifest',-33,-69,2,90,reference);expect(mocks.relay).not.toHaveBeenCalled();
});
it('passes the same reference to the authorised replacement GPS contract',async()=>{
  mocks.post.mockResolvedValue({data:{data:{acceso:token('1949916e-22df-4dc1-9d1e-98f98a3eab26')}}});
  const credentials=new Map<string,string>();
  await fleetGpsService.send({...base,kind:'RELEVO'},point,credentials,reference);
  expect(mocks.relay).toHaveBeenCalledWith('manifest',token('1949916e-22df-4dc1-9d1e-98f98a3eab26'),point,reference);
  expect(credentials.get('a')).toBe(token('1949916e-22df-4dc1-9d1e-98f98a3eab26'));
});
it('does not use a relay capability if the account or activity changes while it is requested',async()=>{
  let resolve!:(value:unknown)=>void,current=true;
  mocks.post.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const credentials=new Map<string,string>();
  const sending=fleetGpsService.send({...base,kind:'RELEVO'},point,credentials,reference,()=>current);
  current=false;resolve({data:{data:{acceso:token('qa-version')}}});
  await expect(sending).rejects.toThrow('cuenta o actividad cambió');
  expect(credentials.size).toBe(0);expect(mocks.relay).not.toHaveBeenCalled();
});
it('checks freshness again after requesting relay access and before sending coordinates',async()=>{
  let resolve!:(value:unknown)=>void,fresh=true;
  mocks.post.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const guard=()=>{if(!fresh)throw new Error('ubicación antigua');};
  const sending=fleetGpsService.send({...base,kind:'RELEVO'},point,new Map(),reference,()=>true,undefined,guard);
  fresh=false;resolve({data:{data:{acceso:token(reference)}}});
  await expect(sending).rejects.toThrow('ubicación antigua');
  expect(mocks.relay).not.toHaveBeenCalled();
});
it('does not retry an uncertain relay point under a rotated capability version',async()=>{
  const id='3a999c28-2e6a-4fd0-9127-777a7db7af3e',credentials=new Map<string,string>();
  mocks.post.mockResolvedValueOnce({data:{data:{acceso:token('qa-version-1')}}}).mockResolvedValueOnce({data:{data:{acceso:token('qa-version-2')}}});
  mocks.relay.mockRejectedValueOnce(Object.assign(new Error('expired'),{status:401}));
  await expect(fleetGpsService.send({...base,kind:'RELEVO'},point,credentials,id)).rejects.toThrow('expired');
  await expect(fleetGpsService.send({...base,kind:'RELEVO'},point,credentials,id)).rejects.toThrow('autorización del relevo cambió');
  expect(mocks.relay).toHaveBeenCalledOnce();
});
it('checks a saved relay receipt under the current activity and capability, including an earlier version',async()=>{
  const version='1949916e-22df-4dc1-9d1e-98f98a3eab26',load={...base,kind:'RELEVO'} as FleetGpsLoad;
  const credentials=new Map<string,string>([['a',token(version)]]);mocks.receipt.mockResolvedValue(true);
  expect(await fleetGpsService.verifyRelay(load,point,reference,version,credentials,()=>true)).toBe(true);
  expect(mocks.receipt).toHaveBeenCalledWith('manifest',token(version),point,reference,version);
  const old='3a999c28-2e6a-4fd0-9127-777a7db7af3e';
  expect(await fleetGpsService.verifyRelay(load,point,reference,old,credentials,()=>true)).toBe(true);
  expect(mocks.receipt).toHaveBeenLastCalledWith('manifest',token(version),point,reference,old);
  await expect(fleetGpsService.verifyRelay(load,point,reference,version,credentials,()=>false)).rejects.toThrow(/cuenta o actividad cambió/i);
  expect(mocks.receipt).toHaveBeenCalledTimes(2);
});
it('does not treat a missing relay authorization version as a negative receipt',async()=>{
  const load={...base,kind:'RELEVO'} as FleetGpsLoad;
  for (const missing of [null,undefined,'']) {
    await expect(fleetGpsService.verifyRelay(load,point,reference,missing,new Map(),()=>true)).rejects.toThrow(/autorización anterior/i);
  }
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.receipt).not.toHaveBeenCalled();
});
it('accepts a durably rebound version while still rejecting an unexpected version',async()=>{
  const old='1949916e-22df-4dc1-9d1e-98f98a3eab26',current='3a999c28-2e6a-4fd0-9127-777a7db7af3e';
  const id='491d2c6e-803c-48d3-a021-23eac2d75a62',load={...base,kind:'RELEVO'} as FleetGpsLoad,credentials=new Map<string,string>([['a',token(old)]]);
  mocks.relay.mockRejectedValueOnce(Object.assign(new Error('expired'),{status:401}));
  await expect(fleetGpsService.send(load,point,credentials,id,()=>true)).rejects.toThrow('expired');
  credentials.set('a',token(current));
  await expect(fleetGpsService.send(load,point,credentials,id,()=>true,old)).rejects.toThrow(/autorización.*cambió/i);
  await expect(fleetGpsService.send(load,point,credentials,id,()=>true,current)).resolves.toEqual({});
  expect(mocks.relay).toHaveBeenCalledTimes(2);
});
it('does not mark a manifest point received under a changed activity',async()=>{
  let resolve!:()=>void,current=true;
  mocks.manifest.mockImplementationOnce(()=>new Promise<void>(done=>{resolve=done;}));
  const sending=fleetGpsService.send({...base,kind:'MANIFIESTO'},point,new Map(),reference,()=>current);
  current=false;resolve();
  await expect(sending).rejects.toThrow('cuenta o actividad cambió');
});
it('accepts an old receipt only when the reference and exact coordinates match',async()=>{
  mocks.get.mockResolvedValueOnce({data:{success:true,data:{idempotencia:{version:1,puntoId:reference,confirmado:true},tracking:{latitud:-33,longitud:-69,velocidad:2,direccion:90}}}});
  expect(await fleetGpsService.verify({...base,kind:'MANIFIESTO'},point,reference,()=>true)).toBe(true);
  mocks.get.mockResolvedValueOnce({data:{success:true,data:{idempotencia:{version:1,puntoId:reference,confirmado:true},tracking:{latitud:-34,longitud:-69,velocidad:2,direccion:90}}}});
  await expect(fleetGpsService.verify({...base,kind:'MANIFIESTO'},point,reference,()=>true)).rejects.toThrow(/no coincide/i);
});
it('accepts only an explicit negative receipt for the same reference',async()=>{
  mocks.get.mockResolvedValueOnce({data:{success:true,data:{idempotencia:{version:1,puntoId:reference,confirmado:false},tracking:null}}});
  expect(await fleetGpsService.verify({...base,kind:'MANIFIESTO'},point,reference,()=>true)).toBe(false);
  mocks.get.mockResolvedValueOnce({data:{success:true,data:{idempotencia:{version:1,puntoId:'other',confirmado:false},tracking:null}}});
  await expect(fleetGpsService.verify({...base,kind:'MANIFIESTO'},point,reference,()=>true)).rejects.toThrow(/no se pudo verificar/i);
  mocks.get.mockResolvedValueOnce({data:{success:true,data:{idempotencia:{version:1,puntoId:reference,confirmado:false},tracking:{}}}});
  await expect(fleetGpsService.verify({...base,kind:'MANIFIESTO'},point,reference,()=>true)).rejects.toThrow(/no es válida/i);
});

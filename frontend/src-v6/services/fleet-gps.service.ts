import {api} from './api';
import {manifiestoService} from './manifiesto.service';
import {limitedLegReceipt,limitedLegRequest,relayCapabilityVersion,type TransportGpsPoint,type LimitedTransportUpload} from './limited-transport-gps';
import {parseGpsReceipt} from './gpsReceipts';
export interface FleetGpsLoad {
  key:string;kind:'MANIFIESTO'|'RELEVO';id:string;numero:string;origen:string;destino:string;
  fechaInicio:string|null;referenciaTiempo:string;patente:string|null;puedeEntregar:boolean;gpsDisponible:boolean;
}
export interface FleetGpsLoads {targets:FleetGpsLoad[];total:number;limit:number}
// Additional in-page protection for clients with no durable record.
const relayPointVersions=new Map<string,string>();
async function relayAccess(load:FleetGpsLoad,credentials:Map<string,string>,isCurrent:()=>boolean) {
  const ensure=()=>{if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');};
  ensure();let token=credentials.get(load.key);
  if(!token){token=(await api.post<{data:{acceso:string}}>(`/manifiestos/relevos-asignados/${load.id}/acceso`,{})).data.data.acceso;ensure();credentials.set(load.key,token);}
  ensure();return {token,version:relayCapabilityVersion(token)};
}
const changedRelay=()=>Object.assign(new Error('La autorización del relevo cambió con una ubicación sin confirmar. Conservá este dispositivo y consultá a soporte.'),{status:409});
export const fleetGpsService={
  list:async(search=''):Promise<FleetGpsLoads>=>(await api.get<{data:FleetGpsLoads}>('/manifiestos/cargas-en-curso',{params:search?{search}:undefined})).data.data,
  async verify(load:FleetGpsLoad,point:TransportGpsPoint,puntoId:string,isCurrent:()=>boolean):Promise<boolean> {
    if(load.kind!=='MANIFIESTO'||!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');
    let response:unknown;
    try{response=await api.get(`/manifiestos/${encodeURIComponent(load.id)}/ubicaciones/${encodeURIComponent(puntoId)}/confirmacion`);}
    catch(error){if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');throw error;}
    if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');
    return parseGpsReceipt(response,{lat:point.latitud,lng:point.longitud,speed:point.velocidad??null,heading:point.direccion??null,puntoId});
  },
  async prepareRelay(load:FleetGpsLoad,credentials:Map<string,string>,isCurrent:()=>boolean):Promise<string>{
    if(load.kind!=='RELEVO')throw new Error('No se pudo identificar el relevo.');
    return (await relayAccess(load,credentials,isCurrent)).version;
  },
  async verifyRelay(load:FleetGpsLoad,point:TransportGpsPoint,puntoId:string,expectedVersion:string|null|undefined,credentials:Map<string,string>,isCurrent:()=>boolean):Promise<boolean>{
    if(load.kind!=='RELEVO')throw new Error('No se pudo identificar el relevo.');
    if(!expectedVersion)throw new Error('No se pudo verificar la autorización anterior del relevo. Conservá este dispositivo y consultá a soporte.');
    const {token}=await relayAccess(load,credentials,isCurrent);
    try{const result=await limitedLegReceipt(load.id,token,point,puntoId,expectedVersion);if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');return result;}
    catch(error){if(error&&typeof error==='object'&&'status'in error&&[401,403].includes(Number(error.status)))credentials.delete(load.key);throw error;}
  },
  async send(load:FleetGpsLoad,point:TransportGpsPoint,credentials:Map<string,string>,puntoId:string,isCurrent:()=>boolean=()=>true,expectedVersion?:string,assertFresh?:()=>void) {
    const ensureSession=()=>{if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');};
    ensureSession();
    if(load.kind==='MANIFIESTO'){assertFresh?.();await manifiestoService.actualizarUbicacion(load.id,point.latitud,point.longitud,point.velocidad,point.direccion,puntoId);ensureSession();return;}
    const {token,version}=await relayAccess(load,credentials,isCurrent);
    try{
      ensureSession();
      const pointKey=JSON.stringify([load.id,puntoId]),previous=relayPointVersions.get(pointKey);
      // With a durable point, the caller has bound this version in storage;
      // changing it is allowed only after an exact negative server receipt.
      // Keep the in-memory guard for older callers without that proof.
      if(expectedVersion?expectedVersion!==version:previous&&previous!==version)throw changedRelay();
      if(!expectedVersion)relayPointVersions.set(pointKey,version);
      assertFresh?.();
      const result=await limitedLegRequest<LimitedTransportUpload>(load.id,token,point,puntoId);
      ensureSession();relayPointVersions.delete(pointKey);return result;
    }
    catch(error){if(error&&typeof error==='object'&&'status'in error&&[401,403].includes(Number(error.status)))credentials.delete(load.key);throw error;}
  },
};

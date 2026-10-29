import {api} from './api';
import {manifiestoService} from './manifiesto.service';
import {limitedLegRequest,type TransportGpsPoint,type LimitedTransportUpload} from './limited-transport-gps';
import {matchesGpsReceipt} from './gpsReceipts';
export interface FleetGpsLoad {
  key:string;kind:'MANIFIESTO'|'RELEVO';id:string;numero:string;origen:string;destino:string;
  fechaInicio:string|null;referenciaTiempo:string;patente:string|null;puedeEntregar:boolean;gpsDisponible:boolean;
}
export interface FleetGpsLoads {targets:FleetGpsLoad[];total:number;limit:number}
// Idempotence for a relay is scoped by the capability version on the server.
// Keep the non-secret version in memory with an uncertain point; a rotated
// capability must not silently turn a retry into a second location.
const relayPointVersions=new Map<string,string>();
function relayVersion(token:string):string {
  try{
    const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const claim=JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,'='))) as {jti?:unknown};
    if(typeof claim.jti==='string'&&claim.jti.length>0)return claim.jti;
  }catch{/* A capability whose version cannot be read must not be retried. */}
  throw new Error('No se pudo verificar la autorización del relevo. Pedí un nuevo enlace y consultá a soporte.');
}
export const fleetGpsService={
  list:async(search=''):Promise<FleetGpsLoads>=>(await api.get<{data:FleetGpsLoads}>('/manifiestos/cargas-en-curso',{params:search?{search}:undefined})).data.data,
  async verify(load:FleetGpsLoad,point:TransportGpsPoint,puntoId:string,isCurrent:()=>boolean):Promise<boolean> {
    if(load.kind!=='MANIFIESTO'||!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');
    let response:unknown;
    try{response=await api.get(`/manifiestos/${encodeURIComponent(load.id)}/ubicaciones/${encodeURIComponent(puntoId)}/confirmacion`);}
    catch(error){if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');throw error;}
    if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');
    return matchesGpsReceipt(response,{lat:point.latitud,lng:point.longitud,speed:point.velocidad??null,heading:point.direccion??null,puntoId});
  },
  async send(load:FleetGpsLoad,point:TransportGpsPoint,credentials:Map<string,string>,puntoId:string,isCurrent:()=>boolean=()=>true) {
    const ensureSession=()=>{if(!isCurrent())throw new Error('La cuenta o actividad cambió. Volvé a abrir GPS de mis viajes con la cuenta original.');};
    ensureSession();
    if(load.kind==='MANIFIESTO'){await manifiestoService.actualizarUbicacion(load.id,point.latitud,point.longitud,point.velocidad,point.direccion,puntoId);ensureSession();return;}
    let token=credentials.get(load.key);
    if(!token){token=(await api.post<{data:{acceso:string}}>(`/manifiestos/relevos-asignados/${load.id}/acceso`,{})).data.data.acceso;ensureSession();credentials.set(load.key,token);}
    try{
      ensureSession();
      const pointKey=JSON.stringify([load.id,puntoId]),version=relayVersion(token),previous=relayPointVersions.get(pointKey);
      if(previous&&previous!==version)throw new Error('La autorización del relevo cambió con una ubicación sin confirmar. Conservá esta pantalla y consultá a soporte.');
      relayPointVersions.set(pointKey,version);
      const result=await limitedLegRequest<LimitedTransportUpload>(load.id,token,point,puntoId);
      ensureSession();relayPointVersions.delete(pointKey);return result;
    }
    catch(error){if(error&&typeof error==='object'&&'status'in error&&[401,403].includes(Number(error.status)))credentials.delete(load.key);throw error;}
  },
};

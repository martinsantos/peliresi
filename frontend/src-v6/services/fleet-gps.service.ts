import {api} from './api';
import {manifiestoService} from './manifiesto.service';
import {limitedLegRequest,type TransportGpsPoint,type LimitedTransportUpload} from './limited-transport-gps';
export interface FleetGpsLoad {
  key:string;kind:'MANIFIESTO'|'RELEVO';id:string;numero:string;origen:string;destino:string;
  fechaInicio:string|null;referenciaTiempo:string;patente:string|null;puedeEntregar:boolean;gpsDisponible:boolean;
}
export interface FleetGpsLoads {targets:FleetGpsLoad[];total:number;limit:number}
export const fleetGpsService={
  list:async(search=''):Promise<FleetGpsLoads>=>(await api.get<{data:FleetGpsLoads}>('/manifiestos/cargas-en-curso',{params:search?{search}:undefined})).data.data,
  async send(load:FleetGpsLoad,point:TransportGpsPoint,credentials:Map<string,string>,puntoId:string) {
    if(load.kind==='MANIFIESTO')return manifiestoService.actualizarUbicacion(load.id,point.latitud,point.longitud,point.velocidad,point.direccion,puntoId);
    let token=credentials.get(load.key);
    if(!token){token=(await api.post<{data:{acceso:string}}>(`/manifiestos/relevos-asignados/${load.id}/acceso`,{})).data.data.acceso;credentials.set(load.key,token);}
    try{return await limitedLegRequest<LimitedTransportUpload>(load.id,token,point,puntoId);}
    catch(error){if(error&&typeof error==='object'&&'status'in error&&[401,403].includes(Number(error.status)))credentials.delete(load.key);throw error;}
  },
};

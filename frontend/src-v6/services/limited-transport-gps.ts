import { syntheticPreviewHeaders } from './syntheticPreviewHeaders';
import { sameGpsNumber, sameOptionalGpsNumber } from '../utils/gpsNumericEquality';

export interface TransportGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface LimitedTransportInfo {tramoId:string;numero:string;empresa:string;destino:string;domicilioDestino:string;orden:number;training:boolean;ultimaPosicion:string|null;vence:string}
export interface LimitedTransportUpload {tracking:{id:string;timestamp:string;tramoId:string}}
const endpoint=(id:string)=>`${(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'')}/seguimiento-relevo/${encodeURIComponent(id)}`;
const versionUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The version alone cannot authorize requests. Never persist the bearer token. */
export function relayCapabilityVersion(token:string):string {
  try{
    const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const claim=JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,'='))) as {jti?:unknown};
    if(typeof claim.jti==='string'&&versionUuid.test(claim.jti))return claim.jti.toLowerCase();
  }catch{/* The server still validates the actual signed capability. */}
  throw new Error('No se pudo verificar la autorización del relevo. Pedí un nuevo enlace y consultá a soporte.');
}

/** Check the exact previously attempted point without retransmitting it. */
export async function limitedLegReceipt(id:string,token:string,point:TransportGpsPoint,puntoId:string,version?:string):Promise<boolean> {
  if(version&&!versionUuid.test(version))throw new Error('No se pudo verificar la autorización anterior del relevo.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const query=version?`?version=${encodeURIComponent(version)}`:'';
    const response=await fetch(`${endpoint(id)}/ubicaciones/${encodeURIComponent(puntoId)}/confirmacion${query}`,{method:'GET',signal:controller.signal,
      headers:{Authorization:`Bearer ${token}`,...syntheticPreviewHeaders()},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    const body:unknown=await response.json().catch(()=>({}));
    const result=body&&typeof body==='object'?body as {success?:unknown;message?:unknown;data?:{idempotencia?:{version?:unknown;puntoId?:unknown;confirmado?:unknown};tracking?:Record<string,unknown>|null}}:{};
    if(!response.ok)throw Object.assign(new Error(typeof result.message==='string'?result.message:'No se pudo comprobar la ubicación.'),{status:[404,405,501].includes(response.status)?503:response.status});
    const receipt=result.data?.idempotencia,tracking=result.data?.tracking;
    if(result.success!==true||receipt?.version!==1||receipt.puntoId!==puntoId||typeof receipt.confirmado!=='boolean')throw new Error('SITREP no confirmó la ubicación. Consultá a soporte.');
    if(!receipt.confirmado){if(tracking!==null)throw new Error('La comprobación de ubicación no es válida. Consultá a soporte.');return false;}
    const matches=!!tracking&&['latitud','longitud','precision','velocidad','direccion'].every(key=>Object.hasOwn(tracking,key))
      &&sameGpsNumber(tracking.latitud,point.latitud)&&sameGpsNumber(tracking.longitud,point.longitud)&&sameGpsNumber(tracking.precision,point.precision)
      &&sameOptionalGpsNumber(tracking.velocidad,point.velocidad)&&sameOptionalGpsNumber(tracking.direccion,point.direccion);
    if(!matches)throw Object.assign(new Error('La ubicación confirmada no coincide. Conservá este dispositivo y consultá a soporte.'),{status:409});
    return true;
  }catch(error){if(controller.signal.aborted)throw new Error('La conexión tardó demasiado. Revisá la señal del teléfono.');throw error;}
  finally{clearTimeout(timeout);}
}

/** The capability never uses cookies, user tokens, refresh or account switching. */
export async function limitedLegRequest<T=LimitedTransportInfo>(id:string,token:string,point?:TransportGpsPoint,puntoId?:string):Promise<T> {
  if(point&&!puntoId)throw new Error('No se pudo preparar una referencia segura para la ubicación.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(endpoint(id)+(point?'/ubicacion-idempotente':''),{method:point?'POST':'GET',signal:controller.signal,
      headers:{Authorization:`Bearer ${token}`,...syntheticPreviewHeaders(),...(point?{'Content-Type':'application/json'}:{})},
      credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',...(point?{body:JSON.stringify({...point,puntoId})}:{})});
    const body:unknown=await response.json().catch(()=>({}));
    const data=body&&typeof body==='object'?body as {success?:unknown;message?:unknown;data?:T & {idempotencia?:{version?:unknown;puntoId?:unknown}}}:{};
    if(!response.ok){
      if(point&&[404,405,501].includes(response.status))throw Object.assign(new Error('No se pudo verificar el seguimiento o el servidor. Actualizá la pantalla y, si persiste, contactá a soporte.'),{status:503});
      throw Object.assign(new Error(typeof data.message==='string'?data.message:'No se pudo conectar con SITREP'),{status:response.status});
    }
    if(data.data===undefined)throw new Error('La respuesta de seguimiento no es válida. Volvé a intentar.');
    if(point&&(data.success!==true||data.data.idempotencia?.version!==1||data.data.idempotencia.puntoId!==puntoId))
      throw new Error('SITREP no confirmó la ubicación. Revisá la conexión o contactá a soporte.');
    return data.data;
  }catch(error){if(controller.signal.aborted)throw new Error('La conexión tardó demasiado. Revisá la señal del teléfono.');throw error;}
  finally{clearTimeout(timeout);}
}

export interface TransportGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface LimitedTransportInfo {tramoId:string;numero:string;empresa:string;destino:string;domicilioDestino:string;orden:number;training:boolean;ultimaPosicion:string|null;vence:string}
export interface LimitedTransportUpload {tracking:{id:string;timestamp:string;tramoId:string}}
const endpoint=(id:string)=>`${(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'')}/seguimiento-relevo/${encodeURIComponent(id)}`;

/** The capability never uses cookies, user tokens, refresh or account switching. */
export async function limitedLegRequest<T=LimitedTransportInfo>(id:string,token:string,point?:TransportGpsPoint,puntoId?:string):Promise<T> {
  if(point&&!puntoId)throw new Error('No se pudo preparar una referencia segura para la ubicación.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(endpoint(id)+(point?'/ubicacion-idempotente':''),{method:point?'POST':'GET',signal:controller.signal,
      headers:{Authorization:`Bearer ${token}`,...(point?{'Content-Type':'application/json'}:{})},
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

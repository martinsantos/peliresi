export interface TransportGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface LimitedTransportInfo {tramoId:string;numero:string;empresa:string;destino:string;domicilioDestino:string;orden:number;training:boolean;ultimaPosicion:string|null;vence:string}
export interface LimitedTransportUpload {tracking:{id:string;timestamp:string;tramoId:string}}
const endpoint=(id:string)=>`${(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'')}/seguimiento-relevo/${encodeURIComponent(id)}`;

/** The capability never uses cookies, user tokens, refresh or account switching. */
export async function limitedLegRequest<T=LimitedTransportInfo>(id:string,token:string,point?:TransportGpsPoint):Promise<T> {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(endpoint(id)+(point?'/ubicacion':''),{method:point?'POST':'GET',signal:controller.signal,
      headers:{Authorization:`Bearer ${token}`,...(point?{'Content-Type':'application/json'}:{})},
      credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',...(point?{body:JSON.stringify(point)}:{})});
    const body:unknown=await response.json().catch(()=>({}));
    const data=body&&typeof body==='object'?body as {message?:unknown;data?:T}:{};
    if(!response.ok)throw Object.assign(new Error(typeof data.message==='string'?data.message:'No se pudo conectar con SITREP'),{status:response.status});
    if(data.data===undefined)throw new Error('La respuesta de seguimiento no es válida. Volvé a intentar.');
    return data.data;
  }catch(error){if(controller.signal.aborted)throw new Error('La conexión tardó demasiado. Revisá la señal del teléfono.');throw error;}
  finally{clearTimeout(timeout);}
}

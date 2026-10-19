import React,{useCallback,useEffect,useRef,useState} from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Navigation, Radio, Square, Truck } from 'lucide-react';
import { Card,CardContent,CardHeader } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';

interface LegInfo {tramoId:string;numero:string;empresa:string;destino:string;domicilioDestino:string;orden:number;training:boolean;ultimaPosicion:string|null;vence:string}
type GpsPoint={latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number};
const endpoint=(id:string)=>`${(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'')}/seguimiento-relevo/${encodeURIComponent(id)}`;
export async function limitedLegRequest(id:string,token:string,point?:GpsPoint) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
  const response=await fetch(endpoint(id)+(point?'/ubicacion':''),{method:point?'POST':'GET',signal:controller.signal,
    headers:{Authorization:`Bearer ${token}`,...(point?{'Content-Type':'application/json'}:{})},
    credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',...(point?{body:JSON.stringify(point)}:{})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(body.message||'No se pudo conectar con SITREP'),{status:response.status});
  return body.data;
  }finally{clearTimeout(timeout);}
}

export default function RelevoGpsPage() {
  const {tramoId=''}=useParams();
  const [token]=useState(()=>{
    const value=window.location.hash.slice(1)||sessionStorage.getItem(`sitrep-relevo:${tramoId}`)||'';
    if(window.location.hash){sessionStorage.setItem(`sitrep-relevo:${tramoId}`,value);window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);}
    return value;
  });
  const [info,setInfo]=useState<LegInfo|null>(null),[error,setError]=useState(''),[blocked,setBlocked]=useState(false);
  const [sharing,setSharing]=useState(false),[status,setStatus]=useState('GPS detenido'),[lastSent,setLastSent]=useState<string|null>(null);
  const stopRef=useRef(false);
  const stop=useCallback(()=>{stopRef.current=true;setSharing(false);setStatus('GPS detenido');},[]);
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      if(!token){setError('Pedí el enlace completo a la transportista de origen.');setBlocked(true);return;}
      try{const data=await limitedLegRequest(tramoId,token);if(alive){setInfo(data);setError('');}}
      catch(err:any){if(alive){setError(err.message);if([401,403,404].includes(err.status)){setBlocked(true);stop();sessionStorage.removeItem(`sitrep-relevo:${tramoId}`);}}}
    };
    void load();const timer=window.setInterval(load,30000);return()=>{alive=false;window.clearInterval(timer);};
  },[tramoId,token,stop]);
  useEffect(()=>{
    if(!sharing||!info||blocked)return;
    if(!navigator.geolocation){setError('Este dispositivo no dispone de ubicación.');setSharing(false);return;}
    let alive=true,inFlight=false;let latest:{point:GpsPoint;timestamp:number}|null=null;let lastAttempt=0;
    stopRef.current=false;setStatus('Buscando ubicación…');setError('');
    const send=async()=>{
      if(!alive||stopRef.current||inFlight||!latest)return;
      if(Date.now()-latest.timestamp>60000){setStatus('Esperando una ubicación reciente…');return;}
      if(Date.now()-lastAttempt<29000)return;
      lastAttempt=Date.now();inFlight=true;setStatus('Enviando ubicación…');
      try{
        const data=await limitedLegRequest(tramoId,token,latest.point);
        if(alive&&!stopRef.current){setLastSent(data.tracking.timestamp);setStatus('Ubicación recibida por SITREP');setError('');}
      }catch(err:any){if(alive){setError(err.message);setStatus('Ubicación sin enviar');if([401,403,404].includes(err.status)){setBlocked(true);stop();}}}
      finally{inFlight=false;}
    };
    const watch=navigator.geolocation.watchPosition(position=>{
      if(!alive||stopRef.current)return;
      const c=position.coords;
      latest={point:{latitud:c.latitude,longitud:c.longitude,precision:c.accuracy,
        ...(c.speed!==null&&c.speed>=0?{velocidad:c.speed}:{}),...(c.heading!==null&&c.heading>=0?{direccion:c.heading}:{})},timestamp:position.timestamp};
      void send();
    },err=>{if(alive){setError(err.code===1?'Permití la ubicación en el navegador para compartir el GPS.':'No se obtuvo ubicación. Revisá la señal del teléfono.');setStatus('GPS sin ubicación');if(err.code===1)stop();}},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    const interval=window.setInterval(send,30000);
    return()=>{alive=false;navigator.geolocation.clearWatch(watch);window.clearInterval(interval);};
  },[sharing,!!info,blocked,tramoId,token,stop]);
  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900"><div className="mx-auto max-w-lg space-y-4">
    {info?.training&&<p className="rounded-lg bg-warning-100 p-3 text-sm font-semibold text-warning-900">Capacitación · datos artificiales · sin validez oficial</p>}
    <header className="flex items-center gap-3 py-2"><Truck size={28} className="text-primary-700"/><div><p className="text-sm font-bold text-primary-800">SITREP · Relevo de transporte</p><h1 className="text-xl font-bold">{info?.numero||'Seguimiento del tramo'}</h1></div></header>
    {error&&<p role="alert" className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800">{error}</p>}
    {info&&<><Card><CardHeader title={info.empresa} icon={<Truck size={20}/>}/><CardContent className="space-y-3">
      <p className="text-sm text-neutral-600">Tramo {info.orden} · traslado declarado por la transportista de origen</p>
      <div className="flex items-start gap-2"><MapPin size={20} className="mt-0.5 shrink-0 text-primary-700"/><div><strong className="text-sm">{info.destino}</strong><p className="text-sm text-neutral-600">{info.domicilioDestino}</p></div></div>
    </CardContent></Card>
    <Card><CardHeader title="Ubicación del transporte" icon={<Radio size={20}/>}/><CardContent className="space-y-4">
      <p role="status" aria-live="polite" className={`rounded-lg p-3 text-sm font-semibold ${lastSent&&sharing?'bg-primary-50 text-primary-800':'bg-neutral-100 text-neutral-700'}`}>{status}</p>
      {lastSent&&<p className="text-sm text-neutral-600">Última recepción: {new Date(lastSent).toLocaleTimeString('es-AR')}</p>}
      <Button fullWidth disabled={blocked} leftIcon={sharing?<Square size={20}/>:<Navigation size={20}/>} onClick={()=>sharing?stop():setSharing(true)}>{sharing?'Detener GPS':'Compartir ubicación'}</Button>
      <p className="text-sm text-neutral-600">Mantené esta pantalla abierta y permití la ubicación. Se envía cada 30 segundos mientras haya señal y una posición reciente.</p>
      <p className="text-sm text-neutral-600">La transportista de origen registra la entrega. Este enlace sólo comparte el GPS de este tramo.</p>
    </CardContent></Card></>}
    {!info&&!error&&<p role="status" className="p-4 text-sm text-neutral-600">Comprobando enlace…</p>}
  </div></main>;
}

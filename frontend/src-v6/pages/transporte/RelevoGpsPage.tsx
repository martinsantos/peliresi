import React,{useEffect,useRef,useState} from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Navigation, Radio, RefreshCw, Square, Truck } from 'lucide-react';
import { Card,CardContent,CardHeader } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { ToastContainer } from '../../components/ui/Toast';
import { SitrepMark, SitrepWordmark } from '../../components/SitrepMark';
import { LoadingIndicator } from '../../components/ui/LoadingState';
import { useFleetGps } from '../../hooks/useFleetGps';
import { gpsObservationIsFresh } from '../../utils/gpsFreshness';
import { limitedLegReceipt,limitedLegRequest,relayCapabilityVersion,type LimitedTransportInfo as LegInfo,type LimitedTransportUpload } from '../../services/limited-transport-gps';

function readRelayLink(tramoId:string) {
  const fragment=window.location.hash.slice(1);let stored='';
  try{stored=sessionStorage.getItem(`sitrep-relevo:${tramoId}`)||'';}catch{/* A link can still be used in this window. */}
  const value=fragment||stored;let saved=!!stored&&!fragment;
  if(fragment){
    try{sessionStorage.setItem(`sitrep-relevo:${tramoId}`,value);saved=true;window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);}
    catch{/* Preserve the fragment when this browser cannot remember it. */}
  }
  return {token:value,linkSaved:saved};
}
const changedRelay=()=>Object.assign(new Error('La autorización del relevo cambió. Conservá este dispositivo y consultá a soporte.'),{status:409});
export default function RelevoGpsPage() {
  const {tramoId=''}=useParams();
  const [{token,linkSaved},setLink]=useState(()=>readRelayLink(tramoId));
  const [info,setInfo]=useState<LegInfo|null>(null),[error,setError]=useState(''),[blocked,setBlocked]=useState(false);
  const [sharing,setSharing]=useState(false),[lastSent,setLastSent]=useState<string|null>(null);
  const [,setClock]=useState(()=>Date.now());
  const currentToken=useRef(token);currentToken.current=token;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const removeLink=()=>{try{sessionStorage.removeItem(`sitrep-relevo:${tramoId}`);}catch{/* It was already unavailable. */}};
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      if(!token){setError('Pedí el enlace completo a la transportista de origen.');setBlocked(true);return;}
      try{const data=await limitedLegRequest<LegInfo>(tramoId,token);if(alive){setInfo(data);setError('');}}
      catch(err:any){if(alive){setError(err.message);if([401,403,404].includes(err.status)){setBlocked(true);setSharing(false);removeLink();}}}
    };
    void load();const timer=window.setInterval(load,30000);return()=>{alive=false;window.clearInterval(timer);};
  },[tramoId,token]);
  const key=JSON.stringify(['enlace-relevo',`RELEVO:${tramoId}`]);
  const gps=useFleetGps([{key,lockId:`relevo:${tramoId}`,
    recoveryMessage:'No cierres ni recargues SITREP. Volvé en esta ventana al enlace del relevo y reintentá.',
    prepareCapability:async()=>{if(currentToken.current!==token)throw new Error('El enlace cambió. Volvé a iniciar el seguimiento.');return relayCapabilityVersion(token);},
    verify:async(point,puntoId,version)=>{
      if(currentToken.current!==token)throw new Error('El enlace cambió. Volvé a iniciar el seguimiento.');
      if(!version)return false;
      const confirmed=await limitedLegReceipt(tramoId,token,point,puntoId,version);
      if(currentToken.current!==token)throw new Error('El enlace cambió. Volvé a iniciar el seguimiento.');return confirmed;
    },
    send:async(point,puntoId,version,assertFresh)=>{
      if(currentToken.current!==token)throw new Error('El enlace cambió. Volvé a iniciar el seguimiento.');
      if(!version||relayCapabilityVersion(token)!==version)throw changedRelay();
      assertFresh?.();
      const result=await limitedLegRequest<LimitedTransportUpload>(tramoId,token,point,puntoId);
      if(currentToken.current!==token)throw new Error('El enlace cambió. Volvé a iniciar el seguimiento.');
      if(mounted.current)setLastSent(result.tracking.timestamp);
    },
  }],sharing&&!!info&&!blocked);
  useEffect(()=>{if(!sharing)return;const timer=window.setInterval(()=>setClock(Date.now()),15000);return()=>window.clearInterval(timer);},[sharing]);
  useEffect(()=>{
    const acceptLink=()=>{
      if(!window.location.hash.slice(1))return;
      const next=readRelayLink(tramoId);currentToken.current=next.token;
      setSharing(false);setBlocked(false);setError('');setInfo(null);setLastSent(null);setLink(next);
    };
    window.addEventListener('hashchange',acceptLink);
    return()=>window.removeEventListener('hashchange',acceptLink);
  },[tramoId]);
  const delivery=gps.deliveries[key];
  const fresh=gpsObservationIsFresh(delivery?.observedAt);
  useEffect(()=>{
    if(delivery?.terminal&&[401,403,404,409].includes(delivery.statusCode??0)){
      setBlocked(true);setSharing(false);if(delivery.statusCode!==409)removeLink();
    }
  },[delivery?.terminal,delivery?.statusCode,tramoId]);
  const gpsError=gps.status==='denied'?'Permití la ubicación en el navegador y tocá Reintentar GPS.'
    :gps.status==='unavailable'?'Este dispositivo no dispone de ubicación.':delivery?.state==='error'?delivery.message||'No se pudo compartir la ubicación.':'';
  const status=!sharing?'GPS detenido':gps.status==='denied'||gps.status==='unavailable'?'GPS sin ubicación'
    :delivery?.state==='sending'?'Enviando ubicación…':delivery?.state==='received'&&fresh?'Ubicación recibida por SITREP'
    :delivery?.state==='received'?'Última ubicación sin actualización reciente'
    :delivery?.state==='verified'?'SITREP confirmó una ubicación anterior':delivery?.state==='error'?'Ubicación sin confirmar':'Buscando ubicación…';
  const retrySensor=sharing&&(gps.status==='denied'||gps.status==='unavailable');
  return <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900"><div className="mx-auto max-w-lg space-y-4">
    <ToastContainer/>
    {info?.training&&<p className="rounded-lg bg-warning-100 p-3 text-sm font-semibold text-warning-900">Capacitación · datos artificiales · sin validez oficial</p>}
    <header className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4"><SitrepMark size={32}/><div className="min-w-0"><p className="text-sm font-bold"><SitrepWordmark/> <span className="font-medium text-neutral-600">· Relevo de transporte</span></p><h1 className="break-words text-xl font-bold">{info?.numero||'Seguimiento del tramo'}</h1></div></header>
    {(error||gpsError)&&<p role="alert" className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800">{error||gpsError}</p>}
    {token&&!linkSaved&&<p className="rounded-xl bg-warning-100 p-3 text-sm text-warning-900">Este dispositivo no pudo recordar el enlace. Conservalo para volver a abrir el seguimiento.</p>}
    {info&&<><Card><CardHeader title={info.empresa} icon={<Truck size={20}/>}/><CardContent className="space-y-3">
      <p className="text-sm text-neutral-600">Tramo {info.orden} · traslado declarado por la transportista de origen</p>
      <div className="flex items-start gap-2"><MapPin size={20} className="mt-0.5 shrink-0 text-primary-700"/><div><strong className="text-sm">{info.destino}</strong><p className="text-sm text-neutral-600">{info.domicilioDestino}</p></div></div>
    </CardContent></Card>
    <Card><CardHeader title="Ubicación del transporte" icon={<Radio size={20}/>}/><CardContent className="space-y-4">
      <p role="status" aria-live="polite" className={`rounded-lg p-3 text-sm font-semibold ${delivery?.state==='received'&&sharing&&fresh&&gps.status==='active'?'bg-primary-50 text-primary-800':'bg-neutral-100 text-neutral-700'}`}>{status}</p>
      {lastSent&&<p className="text-sm text-neutral-600">Última recepción: {new Date(lastSent).toLocaleTimeString('es-AR')}</p>}
      {delivery?.state==='error'&&delivery.saved&&<p className="text-sm text-neutral-600">Ubicación guardada en este dispositivo. Conservá el enlace del relevo para revisarla.</p>}
      {delivery?.state==='error'&&!delivery.terminal&&sharing&&<Button variant="outline" fullWidth onClick={()=>gps.resume(key)}>Reintentar envío</Button>}
      <Button fullWidth disabled={blocked} leftIcon={retrySensor?<RefreshCw size={20}/>:sharing?<Square size={20}/>:<Navigation size={20}/>} onClick={()=>{if(retrySensor){gps.retryLocation();return;}if(!sharing)gps.resume(key);setSharing(value=>!value);}}>{retrySensor?'Reintentar GPS':sharing?'Detener GPS':'Compartir ubicación'}</Button>
      <p className="text-sm text-neutral-600">Mantené esta pantalla abierta y permití la ubicación. Se comparten nuevas posiciones, hasta una cada 30 segundos, mientras haya señal.</p>
      <p className="text-sm text-neutral-600">La transportista de origen registra la entrega. Este enlace sólo comparte el GPS de este tramo.</p>
    </CardContent></Card></>}
    {!info&&!error&&<LoadingIndicator label="Comprobando enlace…" />}
  </div></main>;
}

import {useCallback,useEffect,useRef,useState} from 'react';
import {getApiErrorMessage} from '../utils/api-error';
import {createGpsFixOrder,gpsFixFingerprint} from '../utils/gpsFixOrder';
import {newGpsPointId} from '../services/gpsQueue';

export interface FleetGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface FleetGpsTarget {key:string;send:(point:FleetGpsPoint,puntoId:string)=>Promise<unknown>}
export interface FleetGpsDelivery {state:'sending'|'received'|'error';receivedAt?:Date;message?:string;terminal?:boolean;statusCode?:number}
type Observation={point:FleetGpsPoint;observedAt:number;fingerprint:string|null;references:Map<string,string>};
type Status='idle'|'acquiring'|'active'|'denied'|'unavailable';
function responseStatus(error:unknown):number|undefined {
  if(!error||typeof error!=='object')return;
  if('status'in error&&typeof error.status==='number')return error.status;
  if('response'in error&&error.response&&typeof error.response==='object'&&'status'in error.response&&typeof error.response.status==='number')return error.response.status;
}

/** One foreground device watcher fans a fresh observation out to explicitly
 * selected loads. A failed/released load never stops uploads for the others.
 * No offline coordinates are replayed as if they had just been observed. */
export function useFleetGps(targets:FleetGpsTarget[],enabled:boolean) {
  const [status,setStatus]=useState<Status>('idle');
  const [position,setPosition]=useState<(FleetGpsPoint&{observedAt:number})|null>(null);
  const [deliveries,setDeliveries]=useState<Record<string,FleetGpsDelivery>>({});
  const [locationAttempt,setLocationAttempt]=useState(0);
  const targetsRef=useRef(targets);
  const currentRef=useRef<Observation|null>(null);
  // Keep a failed attempt and its id until SITREP acknowledges it. A newer
  // sensor fix must not silently replace an observation with an unknown result.
  // This is still in memory: the durable fleet/relevo queue remains pending.
  const unconfirmedRef=useRef(new Map<string,Observation>());
  const activeRef=useRef(false),generation=useRef(0),cycleRef=useRef(false);
  const heldRef=useRef(new Set<string>()),attemptRef=useRef(new Map<string,number>());
  const receivedRef=useRef(new Map<string,string>());
  const requestsRef=useRef(new Map<string,Promise<unknown>>());
  const selected=targets.map(target=>target.key).sort().join('|');
  const activeCount=targets.filter(target=>!deliveries[target.key]?.terminal).length;
  const trackingEnabled=enabled&&activeCount>0;
  useEffect(()=>{targetsRef.current=targets;},[targets]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(unconfirmedRef.current.size){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const send=useCallback(async()=>{
    if(!activeRef.current||cycleRef.current)return;
    if(!currentRef.current||Date.now()-currentRef.current.observedAt>60000)setStatus('acquiring');
    if(!currentRef.current&&unconfirmedRef.current.size===0){setStatus('acquiring');return;}
    cycleRef.current=true;const run=generation.current;
    try{
      // Serialize network writes on a mobile connection; the single watcher
      // remains alive while individual loads finish or change transport.
      for(const key of targetsRef.current.map(target=>target.key)){
        if(!activeRef.current||generation.current!==run)break;
        const target=targetsRef.current.find(item=>item.key===key);
        const previousAttempt=attemptRef.current.get(key);
        const observation=unconfirmedRef.current.get(key)??currentRef.current;
        if(!target||!observation||heldRef.current.has(key)||(observation.fingerprint!==null&&receivedRef.current.get(key)===observation.fingerprint)||(previousAttempt!==undefined&&Date.now()-previousAttempt<29000))continue;
        if(Date.now()-observation.observedAt>60000){
          if(unconfirmedRef.current.has(key))setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',message:'Hay una ubicación pendiente sin confirmar. Conservá esta pantalla y contactá a soporte; no se reenviará como ubicación actual.'}}));
          else setStatus('acquiring');
          continue;
        }
        attemptRef.current.set(key,Date.now());
        setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'sending'}}));
        const upload=Promise.resolve().then(()=>{
          unconfirmedRef.current.set(key,observation);
          let reference=observation.references.get(key);
          if(!reference){reference=newGpsPointId();observation.references.set(key,reference);}
          return target.send(observation.point,reference);
        });requestsRef.current.set(key,upload);
        try{
          await upload;
          if(unconfirmedRef.current.get(key)===observation)unconfirmedRef.current.delete(key);
          if(activeRef.current&&generation.current===run){
            if(observation.fingerprint!==null)receivedRef.current.set(key,observation.fingerprint);
            if(targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{state:'received',receivedAt:new Date()}}));
          }
        }catch(error){
          const statusCode=responseStatus(error),terminal=[401,403,404,409].includes(statusCode??0);if(terminal)heldRef.current.add(key);
          if(activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',terminal,statusCode,message:getApiErrorMessage(error,'No se pudo enviar esta ubicación. Revisá la conexión o actualizá las cargas.')}}));
        }finally{if(requestsRef.current.get(key)===upload)requestsRef.current.delete(key);}
      }
    }finally{cycleRef.current=false;}
  },[]);
  const holdAndDrain=useCallback(async(key:string)=>{
    heldRef.current.add(key);const pending=requestsRef.current.get(key);if(pending)await Promise.allSettled([pending]);
    const unconfirmed=unconfirmedRef.current.get(key);
    if(unconfirmed)throw new Error(Date.now()-unconfirmed.observedAt>60000
      ?'Hay una ubicación pendiente sin confirmar que ya no es reciente. Conservá esta pantalla y contactá a soporte antes de confirmar la entrega.'
      :'Hay una ubicación pendiente sin confirmar. Revisá la conexión y reintentá el envío antes de confirmar la entrega.');
  },[]);
  const resume=useCallback((key:string)=>{heldRef.current.delete(key);attemptRef.current.delete(key);setDeliveries(previous=>{const next={...previous};delete next[key];return next;});void send();},[send]);
  // Restart only the device watcher. Keep selected loads, acknowledgements and
  // terminal access failures; retrying a sensor never grants access to a load.
  const retryLocation=useCallback(()=>setLocationAttempt(attempt=>attempt+1),[]);
  useEffect(()=>{
    if(!trackingEnabled){setStatus('idle');return;}
    if(!navigator.geolocation){setStatus('unavailable');return;}
    let mounted=true;const run=++generation.current;activeRef.current=true;attemptRef.current.clear();receivedRef.current.clear();currentRef.current=null;
    const acceptFix=createGpsFixOrder();
    setStatus('acquiring');
    const watch=navigator.geolocation.watchPosition(result=>{
      if(!mounted||generation.current!==run||!activeRef.current)return;
      const epoch=acceptFix.epoch();if(!acceptFix(result.timestamp))return;
      if(acceptFix.epoch()!==epoch){attemptRef.current.clear();receivedRef.current.clear();}
      const c=result.coords;
      const point={latitud:c.latitude,longitud:c.longitude,precision:c.accuracy,
        ...(c.speed!==null&&c.speed>=0?{velocidad:c.speed}:{}),...(c.heading!==null&&c.heading>=0?{direccion:c.heading}:{})};
      const rawFingerprint=gpsFixFingerprint(result.timestamp,point);
      const fingerprint=rawFingerprint===null?null:`${acceptFix.epoch()}:${rawFingerprint}`;
      const previous=currentRef.current;
      currentRef.current=fingerprint!==null&&previous?.fingerprint===fingerprint?previous:
        {point,observedAt:result.timestamp,fingerprint,references:new Map()};
      setPosition({...point,observedAt:result.timestamp});setStatus('active');void send();
    },error=>{if(mounted){currentRef.current=null;if(error.code===1)activeRef.current=false;setStatus(error.code===1?'denied':'acquiring');}},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    const timer=window.setInterval(()=>void send(),30000);
    return()=>{mounted=false;activeRef.current=false;generation.current++;navigator.geolocation.clearWatch(watch);window.clearInterval(timer);};
  },[trackingEnabled,send,locationAttempt]);
  // Adding/removing a selected load does not tear down the device watcher.
  useEffect(()=>{if(trackingEnabled)void send();},[selected,trackingEnabled,send]);
  return {status,position,deliveries,holdAndDrain,resume,retryLocation,activeCount};
}

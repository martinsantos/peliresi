import {useCallback,useEffect,useRef,useState} from 'react';
import {getApiErrorMessage} from '../utils/api-error';

export interface FleetGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface FleetGpsTarget {key:string;send:(point:FleetGpsPoint)=>Promise<unknown>}
export interface FleetGpsDelivery {state:'sending'|'received'|'error';receivedAt?:Date;message?:string;terminal?:boolean;statusCode?:number}
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
  const currentRef=useRef<{point:FleetGpsPoint;observedAt:number}|null>(null);
  const activeRef=useRef(false),generation=useRef(0),cycleRef=useRef(false);
  const heldRef=useRef(new Set<string>()),attemptRef=useRef(new Map<string,number>());
  const requestsRef=useRef(new Map<string,Promise<unknown>>());
  const selected=targets.map(target=>target.key).sort().join('|');
  const activeCount=targets.filter(target=>!deliveries[target.key]?.terminal).length;
  const trackingEnabled=enabled&&activeCount>0;
  useEffect(()=>{targetsRef.current=targets;},[targets]);
  const send=useCallback(async()=>{
    const observation=currentRef.current;
    if(!activeRef.current||cycleRef.current)return;
    if(!observation||Date.now()-observation.observedAt>60000){setStatus('acquiring');return;}
    cycleRef.current=true;const run=generation.current;
    try{
      // Serialize network writes on a mobile connection; the single watcher
      // remains alive while individual loads finish or change transport.
      for(const key of targetsRef.current.map(target=>target.key)){
        if(!activeRef.current||generation.current!==run)break;
        const target=targetsRef.current.find(item=>item.key===key);
        const previousAttempt=attemptRef.current.get(key);
        if(!target||heldRef.current.has(key)||(previousAttempt!==undefined&&Date.now()-previousAttempt<29000))continue;
        if(Date.now()-observation.observedAt>60000)break;
        attemptRef.current.set(key,Date.now());
        setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'sending'}}));
        const upload=Promise.resolve().then(()=>target.send(observation.point));requestsRef.current.set(key,upload);
        try{
          await upload;
          if(activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{state:'received',receivedAt:new Date()}}));
        }catch(error){
          const statusCode=responseStatus(error),terminal=[401,403,404,409].includes(statusCode??0);if(terminal)heldRef.current.add(key);
          if(activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',terminal,statusCode,message:getApiErrorMessage(error,'No se pudo enviar esta ubicación. Revisá la conexión o actualizá las cargas.')}}));
        }finally{if(requestsRef.current.get(key)===upload)requestsRef.current.delete(key);}
      }
    }finally{cycleRef.current=false;}
  },[]);
  const holdAndDrain=useCallback(async(key:string)=>{
    heldRef.current.add(key);const pending=requestsRef.current.get(key);if(pending)await Promise.allSettled([pending]);
  },[]);
  const resume=useCallback((key:string)=>{heldRef.current.delete(key);attemptRef.current.delete(key);setDeliveries(previous=>{const next={...previous};delete next[key];return next;});void send();},[send]);
  // Restart only the device watcher. Keep selected loads, acknowledgements and
  // terminal access failures; retrying a sensor never grants access to a load.
  const retryLocation=useCallback(()=>setLocationAttempt(attempt=>attempt+1),[]);
  useEffect(()=>{
    if(!trackingEnabled){setStatus('idle');return;}
    if(!navigator.geolocation){setStatus('unavailable');return;}
    let mounted=true;const run=++generation.current;activeRef.current=true;attemptRef.current.clear();currentRef.current=null;
    setStatus('acquiring');
    const watch=navigator.geolocation.watchPosition(result=>{
      if(!mounted||generation.current!==run||!activeRef.current)return;
      const c=result.coords;
      const point={latitud:c.latitude,longitud:c.longitude,precision:c.accuracy,
        ...(c.speed!==null&&c.speed>=0?{velocidad:c.speed}:{}),...(c.heading!==null&&c.heading>=0?{direccion:c.heading}:{})};
      currentRef.current={point,observedAt:result.timestamp};setPosition({...point,observedAt:result.timestamp});setStatus('active');void send();
    },error=>{if(mounted){currentRef.current=null;if(error.code===1)activeRef.current=false;setStatus(error.code===1?'denied':'acquiring');}},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    const timer=window.setInterval(()=>void send(),30000);
    return()=>{mounted=false;activeRef.current=false;generation.current++;navigator.geolocation.clearWatch(watch);window.clearInterval(timer);};
  },[trackingEnabled,send,locationAttempt]);
  // Adding/removing a selected load does not tear down the device watcher.
  useEffect(()=>{if(trackingEnabled)void send();},[selected,trackingEnabled,send]);
  return {status,position,deliveries,holdAndDrain,resume,retryLocation,activeCount};
}

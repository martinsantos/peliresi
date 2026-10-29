import {useCallback,useEffect,useRef,useState} from 'react';
import {getApiErrorMessage} from '../utils/api-error';
import {createGpsFixOrder,gpsFixFingerprint} from '../utils/gpsFixOrder';
import {newGpsPointId} from '../services/gpsQueue';
import {acknowledgeFleetGpsPoint,bindFleetGpsCapability,rebindFleetGpsCapabilityAfterAbsence,readFleetGpsPoints,saveFleetGpsPoint,type FleetStoredPoint} from '../services/fleetGpsStorage';
import {adoptParkedGpsLease,gpsLeaseClosing,parkGpsLease,startGpsLease,type GpsLease} from '../services/gpsCoordination';
import {clearVolatileFleetObservation,getVolatileFleetObservation,rememberVolatileFleetObservation,showVolatileFleetWarning,type FleetGpsObservation} from '../services/fleetGpsVolatile';

export interface FleetGpsPoint {latitud:number;longitud:number;precision:number;velocidad?:number;direccion?:number}
export interface FleetGpsTarget {key:string;lockId?:string;persist?:boolean;beforeSend?:()=>Promise<void>;prepareCapability?:()=>Promise<string>;recoveryMessage?:string;send:(point:FleetGpsPoint,puntoId:string,version?:string)=>Promise<unknown>;verify?:(point:FleetGpsPoint,puntoId:string,version?:string|null)=>Promise<boolean>}
export interface FleetGpsDelivery {state:'sending'|'received'|'verified'|'error';receivedAt?:Date;message?:string;terminal?:boolean;statusCode?:number;saved?:boolean}
type Observation=FleetGpsObservation;
type Status='idle'|'acquiring'|'active'|'denied'|'unavailable';
const recent=(observedAt:number)=>Number.isFinite(observedAt)&&Date.now()-observedAt>=0&&Date.now()-observedAt<=60000;
function responseStatus(error:unknown):number|undefined {
  if(!error||typeof error!=='object')return;
  if('status'in error&&typeof error.status==='number')return error.status;
  if('response'in error&&error.response&&typeof error.response==='object'&&'status'in error.response&&typeof error.response.status==='number')return error.response.status;
}

/** Keep this manifest's cross-tab lock when its observation cannot be saved.
 * The same scoped activity can adopt it after navigating back in this page. */
async function withFleetLease<T>(id:string,key:string,operation:()=>Promise<T>):Promise<T> {
  const closing=gpsLeaseClosing(id);if(closing)await closing;
  let lease:GpsLease|undefined=adoptParkedGpsLease(id,key);
  if(!lease){
    let grant!:()=>void,fail!:(error:Error)=>void;
    const ready=new Promise<void>((resolve,reject)=>{grant=resolve;fail=reject;});
    lease=startGpsLease(id,grant,fail);
    try{await ready;}catch(error){await lease.release();throw error;}
  }
  try{return await operation();}
  finally{
    if(getVolatileFleetObservation(key))parkGpsLease(id,key,lease);
    else await lease.release();
  }
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
  // An unsaved point stays in memory; attempted points are also written to the
  // scoped local store before transmission so they survive a normal reopen.
  const unconfirmedRef=useRef(new Map<string,Observation>());
  const volatileRef=useRef(new Set<string>());
  const activeRef=useRef(false),generation=useRef(0),cycleRef=useRef(false);
  const locationUnavailableRef=useRef(false);
  const sensorEpochRef=useRef(0);
  const heldRef=useRef(new Set<string>()),attemptRef=useRef(new Map<string,number>());
  const receivedRef=useRef(new Map<string,string>());
  const requestsRef=useRef(new Map<string,Promise<unknown>>());
  const selected=targets.map(target=>target.key).sort().join('|');
  const activeCount=targets.filter(target=>!deliveries[target.key]?.terminal).length;
  const trackingEnabled=enabled&&activeCount>0;
  useEffect(()=>{targetsRef.current=targets;},[targets]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(volatileRef.current.size){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const send=useCallback(async()=>{
    if(!activeRef.current||cycleRef.current)return;
    if((!currentRef.current||!recent(currentRef.current.observedAt))&&!locationUnavailableRef.current)setStatus('acquiring');
    cycleRef.current=true;const run=generation.current;
    try{
      // Serialize network writes on a mobile connection; the single watcher
      // remains alive while individual loads finish or change transport.
      for(const key of targetsRef.current.map(target=>target.key)){
        if(!activeRef.current||generation.current!==run)break;
        const target=targetsRef.current.find(item=>item.key===key);
        const previousAttempt=attemptRef.current.get(key);
        const remembered=getVolatileFleetObservation(key);
        if(remembered&&!unconfirmedRef.current.has(key)){unconfirmedRef.current.set(key,remembered);volatileRef.current.add(key);}
        const markVolatile=(observation:Observation)=>{
          volatileRef.current.add(key);
          if(target?.lockId&&target.persist!==false)rememberVolatileFleetObservation(key,observation);
        };
        const clearVolatile=()=>{volatileRef.current.delete(key);if(target?.lockId&&target.persist!==false)clearVolatileFleetObservation(key);};
        let stored:FleetStoredPoint[];
        try{stored=target?.persist===false?[]:readFleetGpsPoints(key);}catch(error){
          const current=currentRef.current;
          let problem:unknown=error;
          // If the store cannot be read, hold the same lock used by delivery
          // before accepting a new observation that it cannot preserve.
          if(target?.lockId&&(current||getVolatileFleetObservation(key))){
            const parking=withFleetLease(target.lockId,key,async()=>{
              if(target.beforeSend)await target.beforeSend();
              if(current&&!unconfirmedRef.current.has(key)){unconfirmedRef.current.set(key,current);markVolatile(current);}
              throw error;
            });requestsRef.current.set(key,parking);
            try{await parking;}catch(cause){problem=cause;}
            finally{if(requestsRef.current.get(key)===parking)requestsRef.current.delete(key);}
            if(getVolatileFleetObservation(key))showVolatileFleetWarning(key,target.recoveryMessage);
          }else if(target&&current&&!unconfirmedRef.current.has(key)){unconfirmedRef.current.set(key,current);markVolatile(current);}
          if(target)setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',saved:false,message:getApiErrorMessage(problem,'No se pudo revisar el almacenamiento de ubicaciones.')}}));
          continue;
        }
        const saved=stored[0],savedFingerprint=saved?gpsFixFingerprint(saved.observedAt,saved.point):null;
        const observation=unconfirmedRef.current.get(key)??(saved?{point:saved.point,observedAt:saved.observedAt,fingerprint:savedFingerprint===null?null:`${sensorEpochRef.current}:${savedFingerprint}`,references:new Map([[key,saved.puntoId]]),...(saved.capabilityVersion?{capabilityVersions:new Map([[key,saved.capabilityVersion]])}:{})}:currentRef.current);
        const sinceAttempt=previousAttempt===undefined?undefined:Date.now()-previousAttempt;
        if(!target||!observation||heldRef.current.has(key)||(!saved&&!unconfirmedRef.current.has(key)&&observation.fingerprint!==null&&receivedRef.current.get(key)===observation.fingerprint)||(sinceAttempt!==undefined&&sinceAttempt>=0&&sinceAttempt<29000))continue;
        if(!recent(observation.observedAt)){
          let checkError:unknown;
          if(saved&&target.verify){
            attemptRef.current.set(key,Date.now());
            const check=Promise.resolve().then(async()=>{
              const operation=async()=>{
                const confirmed=target.prepareCapability?await target.verify!(saved.point,saved.puntoId,saved.capabilityVersion):await target.verify!(saved.point,saved.puntoId);
                if(!confirmed)return false;
                acknowledgeFleetGpsPoint(saved);
                if(unconfirmedRef.current.get(key)?.references.get(key)===saved.puntoId){unconfirmedRef.current.delete(key);clearVolatile();}
                return true;
              };
              return target.lockId?withFleetLease(target.lockId,key,operation):operation();
            });requestsRef.current.set(key,check);
            try{
              if(await check){
                if(savedFingerprint!==null)receivedRef.current.set(key,`${sensorEpochRef.current}:${savedFingerprint}`);
                if(activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key)){
                  const remaining=unconfirmedRef.current.has(key),volatile=volatileRef.current.has(key);
                  setDeliveries(previous=>({...previous,[key]:remaining?{state:'error',saved:!volatile,message:volatile?'SITREP confirmó una ubicación anterior, pero queda otra sin guardar. Mantené esta pantalla abierta.':'SITREP confirmó una ubicación anterior, pero queda otra pendiente.'}:{state:'verified'}}));
                }
                continue;
              }
            }catch(error){checkError=error;/* A failed lookup is not evidence that the point was received. */}
            finally{if(requestsRef.current.get(key)===check)requestsRef.current.delete(key);}
          }
          // An old unsaved observation may be preserved for review, but must
          // never be sent as the vehicle's current position.
          let preserved=false;
          if(!saved&&target.lockId&&getVolatileFleetObservation(key)){
            const preserve=withFleetLease(target.lockId,key,async()=>{
              let reference=observation.references.get(key);
              if(!reference){reference=newGpsPointId();observation.references.set(key,reference);}
              saveFleetGpsPoint({targetKey:key,puntoId:reference,observedAt:observation.observedAt,point:observation.point,...(target.prepareCapability?{capabilityVersion:observation.capabilityVersions?.get(key)??null}:{})});
              clearVolatile();
            });requestsRef.current.set(key,preserve);
            try{await preserve;preserved=true;}catch{showVolatileFleetWarning(key,target.recoveryMessage);}
            finally{if(requestsRef.current.get(key)===preserve)requestsRef.current.delete(key);}
          }
          const checkStatus=responseStatus(checkError),terminal=[401,403,404,409].includes(checkStatus??0);
          if(terminal)heldRef.current.add(key);
          if((saved||unconfirmedRef.current.has(key))&&activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',terminal,statusCode:checkStatus,saved:(!!saved||preserved)&&!volatileRef.current.has(key),message:terminal?getApiErrorMessage(checkError,'No se pudo comprobar la autorización. Conservá este dispositivo y consultá a soporte.'):`Hay una ubicación pendiente sin confirmar. ${volatileRef.current.has(key)?'Mantené esta pantalla abierta':'Conservá este dispositivo'} y contactá a soporte; no se reenviará como ubicación actual.`}}));
          else setStatus('acquiring');
          continue;
        }
        attemptRef.current.set(key,Date.now());
        setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'sending'}}));
        const upload=Promise.resolve().then(async()=>{
          const operation=async()=>{
            // A delivery may have been queued immediately before we acquired
            // the lock. Do not create a new GPS obligation after that point.
            if(target.beforeSend)await target.beforeSend();
            unconfirmedRef.current.set(key,observation);
            markVolatile(observation);
            try{
              let reference=observation.references.get(key);
              if(!reference){reference=newGpsPointId();observation.references.set(key,reference);}
              let item:FleetStoredPoint=saved?.puntoId===reference?saved:{targetKey:key,puntoId:reference,observedAt:observation.observedAt,point:observation.point,...(target.prepareCapability?{capabilityVersion:observation.capabilityVersions?.get(key)??null}:{})};
              if(item.observedAt!==observation.observedAt||JSON.stringify(item.point)!==JSON.stringify(observation.point))throw new Error('La ubicación guardada no coincide. Conservá este dispositivo y consultá a soporte.');
              if(target.persist!==false){saveFleetGpsPoint(item);clearVolatile();}
              let version:string|undefined;
              if(target.prepareCapability){
                if(target.persist===false||item.capabilityVersion===undefined)throw new Error('No se pudo identificar la autorización de esta ubicación. Conservá este dispositivo y consultá a soporte.');
                version=await target.prepareCapability();
                if(item.capabilityVersion!==null&&item.capabilityVersion!==version){
                  if(!target.verify)throw Object.assign(new Error('No se pudo comprobar la autorización anterior. Conservá este dispositivo y consultá a soporte.'),{status:409});
                  const received=await target.verify(item.point,reference,item.capabilityVersion);
                  if(received){
                    try{acknowledgeFleetGpsPoint(item);}catch(error){markVolatile(observation);throw error;}
                    clearVolatile();return 'verified' as const;
                  }
                  item=rebindFleetGpsCapabilityAfterAbsence(item,version);
                }
                if(item.capabilityVersion===null)item=bindFleetGpsCapability(item,version);
                (observation.capabilityVersions??=new Map()).set(key,version);
              }
              if(target.prepareCapability)await target.send(observation.point,reference,version);
              else await target.send(observation.point,reference);
              if(target.persist!==false){try{acknowledgeFleetGpsPoint(item);}catch(error){markVolatile(observation);throw error;}}
              clearVolatile();
              return 'received' as const;
            }catch(error){
              // Prove the exact point is durable before releasing the lease.
              if(target.persist!==false&&volatileRef.current.has(key)){
                const reference=observation.references.get(key);
                try{if(reference&&readFleetGpsPoints(key).some(item=>item.puntoId===reference&&item.observedAt===observation.observedAt&&JSON.stringify(item.point)===JSON.stringify(observation.point)))clearVolatile();}catch{/* Keep the lock when storage cannot be read. */}
              }
              throw error;
            }
          };
          return target.lockId?withFleetLease(target.lockId,key,operation):operation();
        });requestsRef.current.set(key,upload);
        try{
          const outcome=await upload;
          if(unconfirmedRef.current.get(key)===observation)unconfirmedRef.current.delete(key);
          if(activeRef.current&&generation.current===run){
            if(observation.fingerprint!==null)receivedRef.current.set(key,observation.fingerprint);
            if(targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:outcome==='verified'?{state:'verified'}:{state:'received',receivedAt:new Date()}}));
          }
        }catch(error){
          if(target.lockId&&getVolatileFleetObservation(key))showVolatileFleetWarning(key,target.recoveryMessage);
          const statusCode=responseStatus(error),terminal=[401,403,404,409].includes(statusCode??0);if(terminal)heldRef.current.add(key);
          if(activeRef.current&&generation.current===run&&targetsRef.current.some(item=>item.key===key))setDeliveries(previous=>({...previous,[key]:{...previous[key],state:'error',terminal,statusCode,saved:!!(saved||unconfirmedRef.current.has(key))&&!volatileRef.current.has(key),message:getApiErrorMessage(error,'No se pudo enviar esta ubicación. Revisá la conexión o actualizá las cargas.')+(volatileRef.current.has(key)?' La ubicación no pudo guardarse; mantené esta pantalla abierta.':'')}}));
        }finally{if(requestsRef.current.get(key)===upload)requestsRef.current.delete(key);}
      }
    }finally{cycleRef.current=false;}
  },[]);
  const holdAndDrain=useCallback(async(key:string)=>{
    heldRef.current.add(key);const pending=requestsRef.current.get(key);if(pending)await Promise.allSettled([pending]);
    const stored=readFleetGpsPoints(key),saved=stored[0];
    const unconfirmed=unconfirmedRef.current.get(key)??getVolatileFleetObservation(key)??saved;
    if(unconfirmed)throw new Error(!recent(unconfirmed.observedAt)
      ?'Hay una ubicación pendiente sin confirmar que ya no es reciente. Conservá este dispositivo y contactá a soporte antes de confirmar la entrega.'
      :'Hay una ubicación pendiente sin confirmar. Revisá la conexión y reintentá el envío antes de confirmar la entrega.');
  },[]);
  const resume=useCallback((key:string)=>{heldRef.current.delete(key);attemptRef.current.delete(key);setDeliveries(previous=>{const next={...previous};delete next[key];return next;});void send();},[send]);
  // Restart only the device watcher. Keep selected loads, acknowledgements and
  // terminal access failures; retrying a sensor never grants access to a load.
  const retryLocation=useCallback(()=>setLocationAttempt(attempt=>attempt+1),[]);
  useEffect(()=>{
    if(!trackingEnabled){setStatus('idle');return;}
    let mounted=true;const run=++generation.current;activeRef.current=true;attemptRef.current.clear();receivedRef.current.clear();currentRef.current=null;
    locationUnavailableRef.current=false;
    sensorEpochRef.current=0;
    const acceptFix=createGpsFixOrder();
    const geolocation=navigator.geolocation;
    if(!geolocation)locationUnavailableRef.current=true;
    setStatus(geolocation?'acquiring':'unavailable');
    const watch=geolocation?.watchPosition(result=>{
      if(!mounted||generation.current!==run||!activeRef.current||locationUnavailableRef.current)return;
      const epoch=acceptFix.epoch();if(!acceptFix(result.timestamp))return;
      if(acceptFix.epoch()!==epoch){attemptRef.current.clear();receivedRef.current.clear();}
      sensorEpochRef.current=acceptFix.epoch();
      const c=result.coords;
      const point={latitud:c.latitude,longitud:c.longitude,precision:c.accuracy,
        ...(c.speed!==null&&c.speed>=0?{velocidad:c.speed}:{}),...(c.heading!==null&&c.heading>=0?{direccion:c.heading}:{})};
      const rawFingerprint=gpsFixFingerprint(result.timestamp,point);
      const fingerprint=rawFingerprint===null?null:`${acceptFix.epoch()}:${rawFingerprint}`;
      const previous=currentRef.current;
      currentRef.current=fingerprint!==null&&previous?.fingerprint===fingerprint?previous:
        {point,observedAt:result.timestamp,fingerprint,references:new Map()};
      setPosition({...point,observedAt:result.timestamp});setStatus('active');void send();
    },error=>{if(mounted){currentRef.current=null;if(error.code===1)locationUnavailableRef.current=true;setStatus(error.code===1?'denied':'acquiring');}},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    // Stored observations can be reconciled without a new GPS permission.
    void send();
    const timer=window.setInterval(()=>void send(),30000);
    return()=>{mounted=false;activeRef.current=false;generation.current++;if(watch!==undefined)geolocation?.clearWatch(watch);window.clearInterval(timer);};
  },[trackingEnabled,send,locationAttempt]);
  // Adding/removing a selected load does not tear down the device watcher.
  useEffect(()=>{if(trackingEnabled)void send();},[selected,trackingEnabled,send]);
  return {status,position,deliveries,holdAndDrain,resume,retryLocation,activeCount};
}

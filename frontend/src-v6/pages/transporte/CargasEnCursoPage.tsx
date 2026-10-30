import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,CheckCircle2,Clock3,MapPin,Navigation,Radio,RefreshCw,Search,Square,Truck} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useMobilePrefix} from '../../hooks/useMobilePrefix';
import {useFleetGps} from '../../hooks/useFleetGps';
import {useConfirmarEntrega} from '../../hooks/useManifiestoWorkflow';
import {usePendingDeliveryIds} from '../../hooks/usePendingDeliveryIds';
import {subscribeDeliveryConfirmed} from '../../services/offlineSyncEvents';
import {getSyncQueue} from '../../services/indexeddb';
import {queuedDeliveryManifestId} from '../../services/syncQueuePolicy';
import {fleetGpsService,type FleetGpsLoad} from '../../services/fleet-gps.service';
import {companyCacheScope} from '../../services/companyContext';
import {getApiErrorMessage} from '../../utils/api-error';
import {gpsObservationIsFresh} from '../../utils/gpsFreshness';
import {supportRequestContext} from '../../utils/supportSession';
import {manifestFeatureVisible} from '../../utils/manifestFeatures';
import {Card,CardContent,CardHeader} from '../../components/ui/CardV2';
import {Button} from '../../components/ui/ButtonV2';
import {Modal} from '../../components/ui/Modal';
import {toast} from '../../components/ui/Toast';

function elapsed(start:string|null,now:number) {
  const date=start?new Date(start).getTime():NaN;
  if(!Number.isFinite(date)||date>now)return null;
  const minutes=Math.floor((now-date)/60000);
  return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60} min`;
}

export default function CargasEnCursoPage() {
  const {currentUser}=useAuth(),mp=useMobilePrefix(),qc=useQueryClient();
  const pending=usePendingDeliveryIds(),confirmDelivery=useConfirmarEntrega();
  const sessionContext=supportRequestContext();
  const scope=`${currentUser?.training?'cap':'op'}:${currentUser?.id}:${currentUser?.rol}:${currentUser?.actorId}:${companyCacheScope(currentUser?.empresaContexto??null)}:${sessionContext}`;
  const currentScope=useRef(scope);currentScope.current=scope;
  const allowed=currentUser?.rol==='TRANSPORTISTA'&&manifestFeatureVisible(import.meta.env.VITE_TRANSPORT_MULTI_GPS_ENABLED,currentUser);
  const [owner,setOwner]=useState(scope),[known,setKnown]=useState<Record<string,FleetGpsLoad>>({}),[selected,setSelected]=useState<string[]>([]),[started,setStarted]=useState(false);
  const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[now,setNow]=useState(()=>Date.now());
  const [choosing,setChoosing]=useState(true);
  const [delivery,setDelivery]=useState<FleetGpsLoad|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const deliveryGuard=useRef(false),credentials=useRef(new Map<string,string>());
  const errorRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  const query=useQuery({queryKey:['fleet-gps-targets',scope,term],queryFn:()=>fleetGpsService.list(term),enabled:allowed,refetchInterval:15000,retry:false});
  const ownsSession=owner===scope;
  useEffect(()=>{setOwner(scope);setKnown({});setSelected([]);setStarted(false);setChoosing(true);setSearch('');setTerm('');credentials.current.clear();setDelivery(null);setError('');},[scope]);
  useEffect(()=>{if(query.data&&ownsSession)setKnown(previous=>({...previous,...Object.fromEntries(query.data.targets.map(load=>[load.key,load]))}));},[query.data,ownsSession]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    const confirmed=(event:Event)=>{
      const detail=(event as CustomEvent<{id:string;owner:string}>).detail;
      if(!detail?.id||!Object.values(known).some(load=>load.id===detail.id))return;
      setSelected(previous=>previous.filter(key=>known[key]?.id!==detail.id));
      setDelivery(previous=>previous?.id===detail.id?null:previous);
      void qc.invalidateQueries({queryKey:['fleet-gps-targets',scope]});
    };
    return subscribeDeliveryConfirmed(confirmed);
  },[known,qc,scope]);
  const chosen=ownsSession?selected.map(key=>known[key]).filter((load):load is FleetGpsLoad=>!!load):[];
  const canTrack=(load:FleetGpsLoad)=>load.gpsDisponible&&!pending.ids.has(load.id)&&!pending.checking&&!pending.error;
  // Keep pending observations isolated when the same person changes account,
  // role or company without unmounting this screen.
  const gpsKey=(key:string)=>JSON.stringify([scope,key]);
  const currentSession=()=>!!sessionContext&&supportRequestContext()===sessionContext&&currentScope.current===scope;
  const checkDelivery=async(id:string)=>{
    if(!currentSession())throw new Error('La cuenta o actividad cambió. Volvé a abrir tus viajes.');
    let actions:Awaited<ReturnType<typeof getSyncQueue>>;
    try{actions=await getSyncQueue();}catch{throw new Error('No pudimos revisar las entregas guardadas. Reintentá antes de enviar GPS.');}
    if(!currentSession())throw new Error('La cuenta o actividad cambió. Volvé a abrir tus viajes.');
    if(actions.some(action=>action.type==='POST'&&queuedDeliveryManifestId(action.endpoint)===id))throw new Error('Hay una entrega pendiente en este dispositivo. Revisá la sincronización antes de enviar GPS.');
  };
  const gps=useFleetGps(chosen.filter(canTrack).map(load=>({key:gpsKey(load.key),...(load.kind==='MANIFIESTO'?{lockId:load.id,beforeSend:()=>checkDelivery(load.id),verify:(point,puntoId)=>fleetGpsService.verify(load,point,puntoId,currentSession)}:{lockId:`relevo:${load.id}`,prepareCapability:()=>fleetGpsService.prepareRelay(load,credentials.current,currentSession),verify:(point,puntoId,version)=>fleetGpsService.verifyRelay(load,point,puntoId,version,credentials.current,currentSession)}),send:(point,puntoId,version,assertFresh)=>fleetGpsService.send(load,point,credentials.current,puntoId,currentSession,version,assertFresh)})),allowed&&ownsSession&&started);
  const rows=query.data?.targets??[];
  const refresh=async()=>{await qc.invalidateQueries({queryKey:['fleet-gps-targets',scope]});await qc.invalidateQueries({queryKey:['manifiestos']});};
  const toggle=(load:FleetGpsLoad)=>{
    if(selected.includes(load.key))setSelected(previous=>previous.filter(key=>key!==load.key));
    else{setKnown(previous=>({...previous,[load.key]:load}));gps.resume(gpsKey(load.key));setSelected(previous=>[...previous,load.key]);}
  };
  const finish=async()=>{
    if(!delivery||deliveryGuard.current)return;deliveryGuard.current=true;setBusy(true);setError('');
    const selectedDelivery=delivery;
    try{
      await gps.holdAndDrain(gpsKey(selectedDelivery.key));
      const pointAge=gps.position?Date.now()-gps.position.observedAt:NaN;
      const point=gps.status==='active'&&gps.position&&pointAge>=0&&pointAge<60000?gps.position:null;
      const result=await confirmDelivery.mutateAsync({id:selectedDelivery.id,observaciones:'Entrega confirmada desde las cargas de este móvil',...(point?{latitud:point.latitud,longitud:point.longitud}:{})});
      setDelivery(null);
      if(result.status==='confirmed') {
        setSelected(previous=>previous.filter(key=>key!==selectedDelivery.key));await refresh();
        toast.success(started&&chosen.length>1?'Entrega registrada. Las demás cargas conservan su seguimiento actual.':'Entrega registrada.');
      } else toast.info('Entrega pendiente',result.message);
    }catch(cause){gps.resume(gpsKey(selectedDelivery.key));setError(getApiErrorMessage(cause,'No se pudo confirmar la entrega. Revisá la conexión y el estado del manifiesto.'));await query.refetch();}
    finally{deliveryGuard.current=false;setBusy(false);}
  };
  if(!allowed)return <Card><CardContent><p className="text-sm text-neutral-700">El GPS de varias cargas no está habilitado para esta sesión.</p><Link to={mp('/transporte/perfil')} className="text-primary-800 underline">Volver a mis viajes</Link></CardContent></Card>;
  const retryLocation=started&&(gps.status==='denied'||gps.status==='unavailable');
  const label=gps.status==='denied'?'Permití la ubicación del teléfono y tocá Reintentar GPS.':gps.status==='unavailable'?'No se pudo acceder al GPS del dispositivo. Revisá la ubicación y tocá Reintentar GPS.':!started?'GPS detenido':gps.activeCount===0?'Revisá las cargas marcadas: no se está enviando GPS.':gps.status==='active'?`GPS para ${gps.activeCount} carga${gps.activeCount===1?'':'s'}`:'Buscando una ubicación reciente…';
  return <div className="mx-auto max-w-4xl space-y-4 pb-6">
    <Link to={mp('/transporte/perfil')} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-800"><ArrowLeft size={18}/>Mis viajes</Link>
    <p className="text-sm text-neutral-600">Marcá sólo los manifiestos que llevás en este vehículo.</p>
    <Card><CardContent className="space-y-3">
      <p role="status" aria-live="polite" className={`flex items-center gap-2 rounded-lg p-3 text-sm font-semibold ${started&&gps.status==='active'?'bg-primary-50 text-primary-800':'bg-neutral-100 text-neutral-700'}`}><Radio size={18} aria-hidden="true"/>{label}</p>
      <Button fullWidth disabled={!started&&chosen.filter(canTrack).length===0} leftIcon={retryLocation?<RefreshCw size={18}/>:started?<Square size={18}/>:<Navigation size={18}/>} onClick={()=>{if(retryLocation){gps.retryLocation();return;}if(!started)setChoosing(false);setStarted(value=>!value);}}>{retryLocation?'Reintentar GPS':started?'Detener GPS':'Iniciar GPS'}</Button>
      {chosen.length>0&&<button type="button" onClick={()=>setChoosing(value=>!value)} className="min-h-11 text-sm font-semibold text-primary-800 underline">{choosing?'Cerrar selección':'Elegir otras cargas'}</button>}
      <p className="text-sm text-neutral-600">Mantené esta pantalla abierta para compartir ubicaciones con cada carga marcada, hasta una cada 30 segundos. Al entregar una, las demás continúan.</p>
      {pending.error&&<p role="alert" className="text-sm text-error-800">No pudimos revisar las entregas guardadas. <button type="button" className="font-semibold underline" onClick={pending.retry}>Reintentar</button></p>}
    </CardContent></Card>
    {chosen.length>0&&<Card role="region" aria-label="Cargas marcadas"><CardHeader title={`Cargas marcadas · ${chosen.length}`} icon={<Truck size={20}/>}/><CardContent className="divide-y divide-neutral-100">
      {chosen.map(load=>{
        const sent=gps.deliveries[gpsKey(load.key)],duration=elapsed(load.fechaInicio,now),fresh=started&&gps.status==='active'&&gpsObservationIsFresh(sent?.observedAt);
        const state=pending.ids.has(load.id)?'Entrega pendiente en este dispositivo. Revisá la sincronización.':pending.checking?'Comprobando entregas guardadas…':!load.gpsDisponible?'Pedí un nuevo enlace GPS a la transportista de origen.':sent?.state==='error'?sent.message:sent?.state==='sending'?'Enviando ubicación…':!started?'GPS detenido':gps.status==='denied'||gps.status==='unavailable'?'GPS sin ubicación':sent?.state==='verified'?'SITREP confirmó una ubicación anterior':sent?.state==='received'&&fresh?'GPS recibido':sent?.receivedAt?'GPS sin actualización reciente':'Todavía sin envío GPS';
        return <div key={load.key} className="space-y-2 py-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block break-words text-sm text-neutral-900">{load.numero}</strong><p className="text-xs text-neutral-600">{load.destino}</p></div><button type="button" disabled={busy&&delivery?.key===load.key} onClick={()=>toggle(load)} className="min-h-11 px-2 text-xs font-semibold text-primary-800 underline" aria-label={`Quitar ${load.numero} del GPS`}>Quitar</button></div>
          <p role="status" className={`text-sm ${sent?.state==='error'?'text-error-800':sent?.state==='received'&&fresh?'text-primary-800':'text-neutral-600'}`}>{state}{sent?.state==='received'&&sent.receivedAt&&<span className="ml-1 text-xs">· {sent.receivedAt.toLocaleTimeString('es-AR')}</span>}</p>
          {sent?.state==='error'&&sent.saved&&<p className="text-xs text-neutral-600">Ubicación guardada en este dispositivo. Volvé con la misma cuenta y actividad para revisarla.</p>}
          {sent?.state!=='received'&&sent?.receivedAt&&<p className="text-xs text-neutral-500">Última recepción: {sent.receivedAt.toLocaleTimeString('es-AR')}</p>}
          {duration&&<p className="flex items-center gap-1 text-xs text-neutral-600"><Clock3 size={13}/>{load.referenciaTiempo}: {duration}</p>}
          <div className="flex flex-wrap gap-2">{sent?.state==='error'&&sent.statusCode!==409&&canTrack(load)&&<Button size="sm" variant="outline" aria-label={`Reintentar envío GPS de ${load.numero}`} onClick={()=>gps.resume(gpsKey(load.key))}>Reintentar envío</Button>}{load.puedeEntregar?<Button size="sm" variant="outline" aria-label={`Entregar ${load.numero}`} disabled={pending.checking||pending.error||pending.ids.has(load.id)} leftIcon={<CheckCircle2 size={16}/>} onClick={()=>{setError('');setDelivery(load);}}>Entregar</Button>:<p className="text-xs text-neutral-600">Entrega a cargo de la transportista de origen.</p>}</div>
        </div>;
      })}
    </CardContent></Card>}
    {(choosing||chosen.length===0)&&<Card><CardHeader title="Elegir cargas" icon={<MapPin size={20}/>}/><CardContent className="space-y-3">
      <form aria-label="Buscar cargas en tránsito" className="flex gap-2" onSubmit={event=>{event.preventDefault();setTerm(search.trim());}}><input aria-label="Número de manifiesto" type="search" maxLength={80} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar número" className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900"/><Button type="submit" variant="outline" leftIcon={<Search size={17}/>}>Buscar</Button></form>
      {term&&<button type="button" onClick={()=>{setSearch('');setTerm('');}} className="min-h-11 text-sm font-semibold text-primary-800 underline">Ver todas las cargas</button>}
      {query.isLoading&&<p role="status" className="text-sm text-neutral-600">Cargando manifiestos en tránsito…</p>}
      {query.isError&&<div role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-800">No se pudo actualizar la lista. Los envíos de las cargas ya marcadas muestran su resultado arriba. <button type="button" onClick={()=>query.refetch()} className="font-semibold underline">Reintentar</button></div>}
      {!query.isLoading&&!query.isError&&rows.length===0&&<p className="text-sm text-neutral-600">{term?'No hay cargas en tránsito con ese número.':'No tenés cargas en tránsito para este GPS.'}</p>}
      <ul className="divide-y divide-neutral-100">{rows.map(load=><li key={load.key}><label className={`flex min-h-16 items-center gap-3 rounded-lg py-3 ${load.gpsDisponible?'cursor-pointer':'opacity-60'}`}><input type="checkbox" aria-label={`Llevo ${load.numero} en este móvil`} checked={selected.includes(load.key)} disabled={!load.gpsDisponible||(!selected.includes(load.key)&&!canTrack(load))} onChange={()=>toggle(load)} className="h-5 w-5 shrink-0 accent-primary-700"/><span className="min-w-0"><strong className="block break-words text-sm text-neutral-900">{load.numero}</strong><span className="block text-xs text-neutral-600">{load.destino}</span><span className="block text-xs text-neutral-500">{load.patente||'Sin patente declarada'}{load.kind==='RELEVO'?' · relevo':''}{!load.gpsDisponible?' · enlace GPS no disponible':''}{pending.ids.has(load.id)?' · entrega pendiente':''}</span></span></label></li>)}</ul>
      {query.data&&query.data.total>rows.length&&<p className="text-xs text-neutral-600">Se muestran {rows.length} de {query.data.total}. Buscá un número para encontrar otra carga; las ya marcadas siguen enviando GPS.</p>}
    </CardContent></Card>}
    <Modal isOpen={!!delivery} onClose={()=>{if(!busy){setDelivery(null);setError('');}}} title="Confirmar entrega" description={delivery?.numero} size="sm" isBusy={busy}
      footer={<><Button variant="outline" disabled={busy} onClick={()=>setDelivery(null)}>Volver</Button><Button isLoading={busy} onClick={finish}>Confirmar entrega de esta carga</Button></>}>
      <p className="text-sm text-neutral-700">Confirmás la entrega en {delivery?.destino}.{chosen.length>1&&(started?' Las otras cargas conservan su seguimiento actual.':' Las otras cargas permanecen seleccionadas.')}</p>{error&&<p ref={errorRef} role="alert" tabIndex={-1} className="mt-3 text-sm text-error-800 focus:outline focus:outline-2 focus:outline-error-600">{error}</p>}
    </Modal>
  </div>;
}

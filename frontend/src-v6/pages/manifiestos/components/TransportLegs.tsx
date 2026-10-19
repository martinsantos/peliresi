import React,{useState} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Copy, MapPin, Truck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card,CardHeader,CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { useCatalogoTransportistas } from '../../../hooks/useCatalogos';
import { useTransportLegs,transportHandoffService,transportLegKey,handoffLink,type TransportDeclaration } from '../../../services/transport-handoff.service';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateTime } from '../../../utils/formatters';
import { manifestFeatureVisible } from '../../../utils/manifestFeatures';

const fieldClass='mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100';
interface Props {id:string;beforeHandoff?:()=>Promise<void>;onHandoffError?:()=>void}
export function TransportLegs(props:Props) {
  const {currentUser}=useAuth();
  if(!manifestFeatureVisible(import.meta.env.VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED,currentUser))return null;
  return <TransportLegsContent {...props}/>;
}
function TransportLegsContent({id,beforeHandoff,onHandoffError}:Props) {
  const {currentUser}=useAuth();
  const query=useTransportLegs(id);const qc=useQueryClient();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[link,setLink]=useState('');
  const [kind,setKind]=useState<'REGISTRADO'|'EXTERNO'>('REGISTRADO');
  const [carrierId,setCarrierId]=useState(''),[vehicle,setVehicle]=useState(''),[driver,setDriver]=useState(''),[reason,setReason]=useState('');
  const [declared,setDeclared]=useState<TransportDeclaration>({});
  const [commandId,setCommandId]=useState(()=>crypto.randomUUID());
  const [expectedLeg,setExpectedLeg]=useState<string|null>(null);
  const catalog=useCatalogoTransportistas(open&&kind==='REGISTRADO');
  const legs=query.data?.tramos||[],active=legs.find(leg=>!leg.fin);
  const selected=catalog.data?.find(c=>c.id===carrierId);
  const updateDeclared=(key:keyof TransportDeclaration,value:string)=>{setDeclared(prev=>({...prev,[key]:value}));setCommandId(crypto.randomUUID());};
  const refresh=async()=>{await qc.invalidateQueries({queryKey:transportLegKey(id,currentUser?.id)});await qc.invalidateQueries({queryKey:['manifiestos']});};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      await beforeHandoff?.();
      const result=await transportHandoffService.create(id,{id:commandId,anteriorId:expectedLeg,tipo:kind,motivo:reason,
        ...(kind==='REGISTRADO'?{transportistaId:carrierId,...(vehicle?{vehiculoId:vehicle}:{}),...(driver?{choferId:driver}:{})}:{}),datos:declared});
      setLink(result.acceso?handoffLink(result.tramo.id,result.acceso):'');setOpen(false);setReason('');setDeclared({});setCommandId(crypto.randomUUID());await refresh();
    }catch(err:any){onHandoffError?.();setError(err?.response?.data?.message||'No se pudo registrar el traspaso. Los datos del formulario se conservaron.');}
    finally{setBusy(false);}
  };
  const access=async(revoke:boolean)=>{
    if(!active||busy)return;setBusy(true);setError('');
    try{const result=await transportHandoffService.access(id,active.id,revoke);setLink(result.acceso?handoffLink(active.id,result.acceso):'');await refresh();}
    catch(err:any){setError(err?.response?.data?.message||'No se pudo actualizar el acceso GPS');}finally{setBusy(false);}
  };
  if(query.isError)return <Card><CardHeader title="Tramos de transporte" icon={<ArrowRightLeft size={20}/>}/><CardContent><p role="alert" className="text-sm text-error-700">No se pudieron cargar los tramos.</p><Button variant="outline" onClick={()=>query.refetch()}>Reintentar</Button></CardContent></Card>;
  if(!query.data)return null;
  return <Card role="region" aria-label="Tramos de transporte"><CardHeader title="Tramos de transporte" icon={<ArrowRightLeft size={20}/>}/><CardContent className="space-y-4">
    {legs.length===0?<p className="text-sm text-neutral-600">Continúa el transporte original del manifiesto.</p>:<ol className="divide-y divide-neutral-100">{legs.map(leg=><li key={leg.id} className="flex gap-3 py-3">
      <Truck size={20} aria-hidden="true" className={leg.fin?'mt-0.5 shrink-0 text-neutral-400':'mt-0.5 shrink-0 text-primary-700'}/><div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><strong className="break-words text-sm text-neutral-900">{leg.datos.empresa||'Empresa sin nombre declarado'}</strong><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${leg.fin?'bg-neutral-100 text-neutral-600':'bg-primary-50 text-primary-800'}`}>{leg.fin?'Finalizado':'En curso'}</span></div>
        <p className="mt-1 text-sm text-neutral-700">{leg.datos.patente||'Patente sin declarar'} · {leg.datos.chofer||'Chofer sin declarar'}</p>
        {leg.tipo==='EXTERNO'&&<p className="text-xs font-semibold text-warning-800">Eventual · datos declarados</p>}
        <p className="mt-1 text-xs text-neutral-500">{formatDateTime(leg.inicio)}{leg.fin?` → ${formatDateTime(leg.fin)}`:''}</p>
        {leg.tipo!=='ORIGINAL'&&<p className="mt-1 break-words text-sm text-neutral-600">{leg.motivo}</p>}
      </div></li>)}</ol>}
    {error&&<p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-800">{error}</p>}
    {query.data.puedeRegistrar&&!open&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setExpectedLeg(active?.id??null);setCommandId(crypto.randomUUID());setOpen(true);setError('');setLink('');}}>Registrar traspaso</Button>
      {active&&active.tipo!=='ORIGINAL'&&<><Button variant="outline" isLoading={busy} onClick={()=>access(false)}>Nuevo enlace GPS</Button>{active.accesoActivo&&<Button variant="outline" disabled={busy} onClick={()=>access(true)}>Revocar enlace GPS</Button>}</>}
    </div>}
    {open&&<form onSubmit={submit} className="space-y-4 border-t border-neutral-100 pt-4" aria-label="Registrar traspaso de carga">
      <p className="text-sm text-neutral-600">La transportista de origen declara a quién entrega la carga.</p>
      <label className="block text-sm font-semibold text-neutral-800">Reemplazo<select className={fieldClass} value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setCarrierId('');setVehicle('');setDriver('');setDeclared({});setCommandId(crypto.randomUUID());}}><option value="REGISTRADO">Transportista registrada en SITREP</option><option value="EXTERNO">Empresa externa eventual</option></select></label>
      {kind==='REGISTRADO'&&<><label className="block text-sm font-semibold text-neutral-800">Transportista<select required className={fieldClass} value={carrierId} onChange={e=>{setCarrierId(e.target.value);setVehicle('');setDriver('');setCommandId(crypto.randomUUID());}}><option value="">Elegir transportista</option>{catalog.data?.map(c=><option key={c.id} value={c.id}>{c.razonSocial||c.nombre}</option>)}</select></label>
        {catalog.isError&&<p role="alert" className="text-sm text-error-700">No se pudo cargar el padrón. <button type="button" className="underline" onClick={()=>catalog.refetch()}>Reintentar</button></p>}
        <label className="block text-sm font-semibold text-neutral-800">Móvil registrado<select className={fieldClass} value={vehicle} onChange={e=>{setVehicle(e.target.value);setCommandId(crypto.randomUUID());}}><option value="">Sin móvil seleccionado</option>{(selected?.vehiculos||[]).filter((v:any)=>v.activo!==false).map((v:any)=><option key={v.id} value={v.id}>{v.patente}</option>)}</select></label>
        <label className="block text-sm font-semibold text-neutral-800">Chofer registrado<select className={fieldClass} value={driver} onChange={e=>{setDriver(e.target.value);setCommandId(crypto.randomUUID());}}><option value="">Sin chofer seleccionado</option>{(selected?.choferes||[]).filter((c:any)=>c.activo!==false).map((c:any)=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}</select></label>
      </>}
      {kind==='EXTERNO'&&<><p className="text-sm text-neutral-600">Completá lo que tengas. Los datos faltantes quedarán sin declarar.</p><div className="grid gap-3 sm:grid-cols-2">{([['empresa','Empresa',180],['cuit','CUIT',30],['patente','Patente',30],['chofer','Chofer',180],['documento','Documento',40],['telefono','Contacto',80]] as const).map(([key,label,max])=><label key={key} className="block text-sm font-semibold text-neutral-800">{label}<input type="text" autoComplete="off" maxLength={max} className={fieldClass} value={declared[key]||''} onChange={e=>updateDeclared(key,e.target.value)}/></label>)}</div></>}
      <label className="block text-sm font-semibold text-neutral-800">Motivo del traspaso<textarea required minLength={3} maxLength={1000} className={fieldClass} rows={2} value={reason} onChange={e=>{setReason(e.target.value);setCommandId(crypto.randomUUID());}} placeholder="Ej.: rotura del móvil"/></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" isLoading={busy}>Confirmar traspaso</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cerrar formulario</Button></div>
    </form>}
    {link&&<section aria-label="Acceso GPS del reemplazo" className="space-y-3 rounded-xl bg-primary-50 p-4 text-primary-900">
      <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold"><MapPin size={18}/>GPS del reemplazo</h3><button type="button" aria-label="Ocultar enlace" onClick={()=>setLink('')}><X size={18}/></button></div>
      <p className="text-sm">El chofer abre este enlace y toca Compartir ubicación. Sólo permite enviar GPS para este tramo. La transportista de origen confirma la entrega.</p>
      <QRCodeSVG value={link} size={160} className="mx-auto rounded-lg bg-white p-2"/>
      <input aria-label="Enlace GPS del reemplazo" readOnly value={link} className={fieldClass}/><Button variant="outline" leftIcon={<Copy size={16}/>} onClick={async()=>{try{await navigator.clipboard.writeText(link);}catch{setError('No se pudo copiar. Seleccioná el enlace para compartirlo.');}}}>Copiar enlace</Button>
      <p className="text-xs">Vence en 24 horas o al terminar/relevar este tramo. Un enlace nuevo revoca el anterior.</p>
    </section>}
  </CardContent></Card>;
}

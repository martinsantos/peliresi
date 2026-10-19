import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Card, CardHeader } from './ui/CardV2';
import { PartyApprovalStatus, type PartyApproval } from './PartyApprovalStatus';
type Task={id:string;numero:string;estado:string;fechaEstimadaRetiro:string|null;partes:PartyApproval[]|null;inicio:string|null;requiereMiAprobacion:boolean;pesajePendiente:boolean};
const day=(value:string|Date)=>new Date(value).toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Mendoza'});
function label(m:Task,role:string){
 switch(m.estado){
 case 'PENDIENTE_APROBACION':return m.requiereMiAprobacion?'Te toca aprobar':'Esperando aprobación';
 case 'APROBADO':return !m.partes?'Retiro pendiente':!m.inicio?'Listo para iniciar':role==='TRANSPORTISTA'?'Confirmar retiro':'Preparando retiro';
 case 'EN_TRANSITO':return 'En viaje · GPS';
 case 'ENTREGADO':return 'Recepción pendiente';
 case 'RECIBIDO':return m.pesajePendiente?'Registrar pesaje':'Registrar tratamiento';
 case 'EN_TRATAMIENTO':return 'En tratamiento';
 case 'TRATADO':return 'Certificación final pendiente';
 default:return m.estado;
 }
}
export function TrainingTaskQueue(){
 const {currentUser}=useAuth(),mp=useMobilePrefix();
 const [filter,setFilter]=useState('all'),[period,setPeriod]=useState('all'),[search,setSearch]=useState(''),[count,setCount]=useState(6);
 const query=useQuery({queryKey:['training-tasks',currentUser?.id],enabled:!!currentUser?.training,queryFn:async()=>(await api.get('/manifiestos/tareas-partes')).data.data as {items:Task[];total:number;limited:boolean},refetchInterval:5000,staleTime:0});
 if(!currentUser?.training)return null;
 const today=day(new Date());
 const items=(query.data?.items||[]).filter(m=>{
  const date=m.fechaEstimadaRetiro?day(m.fechaEstimadaRetiro):null;
  return (filter==='all'||filter==='mine'&&m.requiereMiAprobacion||filter==='waiting'&&m.estado==='PENDIENTE_APROBACION'||filter==='progress'&&['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO'].includes(m.estado))&&(period==='all'||period==='today'&&date===today||period==='future'&&!!date&&date>today)&&m.numero.toLowerCase().includes(search.trim().toLowerCase());
 }).sort((a,b)=>{
  const priority=(m:Task)=>{const date=m.fechaEstimadaRetiro?day(m.fechaEstimadaRetiro):null;return date===today?0:['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO'].includes(m.estado)?1:date&&date>today?2:3;};
  return priority(a)-priority(b)||(a.fechaEstimadaRetiro||'9999').localeCompare(b.fechaEstimadaRetiro||'9999')||a.numero.localeCompare(b.numero);
 });
 return <section aria-label="Agenda de manifiestos"><Card padding="none" className="overflow-hidden">
 <div className="px-4 pt-4"><CardHeader icon={<CalendarDays size={22}/>} title={currentUser.rol==='ADMIN'?'Agenda de operaciones':'Mi agenda'} action={<span className="text-sm font-semibold text-primary-800">{query.data?.total??'…'}</span>} className="mb-3 pb-3"/>
 <div className="grid grid-cols-2 gap-2 mb-2"><input aria-label="Buscar manifiesto en agenda" type="search" placeholder="Buscar nº" value={search} onChange={e=>{setSearch(e.target.value);setCount(6);}} className="h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-2 text-base sm:text-sm"/><select aria-label="Fecha de la agenda" value={period} onChange={e=>{setPeriod(e.target.value);setCount(6);}} className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-sm"><option value="all">Toda fecha</option><option value="today">Hoy</option><option value="future">Próximos</option></select></div>
 <div role="group" aria-label="Filtrar agenda" className="grid grid-cols-4 gap-1 pb-3">{[['all','Todos'],['mine','Por aprobar'],['waiting','En espera'],['progress','En curso']].map(([value,name])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setCount(6);}} className={`min-h-11 rounded-lg px-1 text-xs font-semibold ${filter===value?'bg-primary-800 text-white':'bg-neutral-100 text-neutral-700 hover:bg-primary-50'}`}>{name}</button>)}</div></div>
 {query.isError?<p role="alert" className="p-4">No pudimos actualizar la agenda. <button className="underline" onClick={()=>void query.refetch()}>Reintentar</button></p>:query.isPending?<p className="p-4">Cargando agenda…</p>:<>
 <ul className="divide-y divide-neutral-200">{items.slice(0,count).map(m=><li key={m.id} data-agenda-row><Link to={mp(`/manifiestos/${m.id}`)} className={`flex items-center gap-3 px-4 py-3 hover:bg-primary-50 ${m.requiereMiAprobacion?'bg-emerald-50/60':''}`}><div className="min-w-0 flex-1"><span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-neutral-900" title={m.numero}>{m.numero}</span><span className={`block text-xs font-semibold ${m.requiereMiAprobacion?'text-primary-800':'text-neutral-700'}`}>{label(m,currentUser.rol)}</span><span className="block text-xs text-neutral-500">{m.fechaEstimadaRetiro?new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza',day:'2-digit',month:'short'}):'Sin fecha prevista'}</span></div>{m.partes&&<PartyApprovalStatus partes={m.partes} compact/>}<ChevronRight size={16} aria-hidden="true" className="shrink-0 text-primary-700"/></Link></li>)}</ul>
 {!items.length&&<p role="status" className="p-4 text-sm text-neutral-600">Sin manifiestos para estos filtros.</p>}
 <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-600"><span>{Math.min(count,items.length)} de {items.length}{query.data?.limited?' · últimos 100 consultados':''}</span>{items.length>count?<button className="min-h-11 font-semibold text-primary-800 underline" onClick={()=>setCount(count+6)}>Ver más</button>:<Link className="min-h-11 inline-flex items-center font-semibold text-primary-800" to={mp('/manifiestos')}>Todos los manifiestos</Link>}</div></>}
 </Card></section>;
}

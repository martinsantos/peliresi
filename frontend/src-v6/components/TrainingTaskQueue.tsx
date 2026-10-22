import { manifestProposalsVisible } from '../utils/manifestFeatures';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, Clock3, Route, CircleAlert, Award } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Card, CardHeader } from './ui/CardV2';
import { PartyApprovalStatus, type PartyApproval } from './PartyApprovalStatus';
type Task={id:string;numero:string;estado:string;modalidad?:string;fechaEstimadaRetiro:string|null;partes:PartyApproval[]|null;inicio:string|null;requiereMiAprobacion:boolean;pesajePendiente:boolean;certificatePending?:boolean};
function label(m:Task,role:string){
 switch(m.estado){
 case 'PENDIENTE_APROBACION':return m.requiereMiAprobacion?'Te toca aprobar':'En espera';
 case 'APROBADO':return !m.partes?(m.modalidad==='IN_SITU'?'Recepción in situ':'Retiro pendiente'):!m.inicio?'Listo para iniciar':role==='TRANSPORTISTA'?'Confirmar retiro':'Preparando retiro';
 case 'EN_TRANSITO':return 'En viaje · GPS';
 case 'ENTREGADO':return role==='OPERADOR'?'Confirmar recepción':'Esperando recepción';
 case 'RECIBIDO':return role==='OPERADOR'?(m.pesajePendiente?'Registrar pesaje':'Registrar tratamiento'):'En recepción';
 case 'EN_TRATAMIENTO':return 'En tratamiento';
 case 'TRATADO':return role==='OPERADOR'?'Emitir certificación final':'Esperando certificado final';
 default:return m.estado;
 }
}
export function TrainingTaskQueue(){
 const {currentUser}=useAuth(),mp=useMobilePrefix();
 const [filter,setFilter]=useState('all'),[period,setPeriod]=useState('all'),[search,setSearch]=useState(''),[page,setPage]=useState(1);
 const query=useQuery({queryKey:['training-tasks',currentUser?.id,currentUser?.rol,currentUser?.actorId,filter,period,search,page],enabled:manifestProposalsVisible(currentUser),queryFn:async()=>(await api.get('/manifiestos/tareas-partes',{params:{filter,period,search,page,limit:6}})).data.data as {items:Task[];total:number;page:number;limit:number;counts:Record<string,number>},refetchInterval:5000,staleTime:0});
 if(!manifestProposalsVisible(currentUser) || !currentUser)return null;
 const items=query.data?.items||[], counts=query.data?.counts||{};
 const actualPage=query.data?.page||page, total=query.data?.total||0, pages=Math.max(1,Math.ceil(total/6));
 return <section aria-label="Agenda de manifiestos"><Card padding="none" className="overflow-hidden">
 <div className="px-4 pt-4"><CardHeader icon={<CalendarDays size={22}/>} title={currentUser.rol==='ADMIN'?'Agenda de operaciones':'Mi agenda'} action={<span className="text-sm font-semibold text-primary-800">{counts.all??'…'}</span>} className="mb-3 pb-3"/>
 <div className="grid grid-cols-2 gap-2 mb-2"><input aria-label="Buscar manifiesto en agenda" type="search" maxLength={80} placeholder="Buscar nº" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-2 text-base sm:text-sm"/><select aria-label="Fecha de la agenda" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}} className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-sm"><option value="all">Toda fecha</option><option value="today">Hoy</option><option value="future">Próximos</option></select></div>
 <div role="group" aria-label="Filtrar agenda" className="grid grid-cols-3 sm:grid-cols-5 gap-1 pb-3">{[['all','Todos'],['mine','Por aprobar'],['waiting','En espera'],['progress','En curso'],['certificates','Certificados']].map(([value,name])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1);}} className={`min-h-11 rounded-lg px-1 text-xs font-semibold ${filter===value?'bg-primary-800 text-white':'bg-neutral-100 text-neutral-700 hover:bg-primary-50'}`}>{name}<span aria-hidden="true" className="ml-1 tabular-nums opacity-80">{counts[value]??''}</span></button>)}</div></div>
 {query.isError?<p role="alert" className="p-4">No pudimos actualizar la agenda. <button className="underline" onClick={()=>void query.refetch()}>Reintentar</button></p>:query.isPending?<p className="p-4">Cargando agenda…</p>:<>
 <ul className="divide-y divide-neutral-200">{items.map(m=>{
  const Icon=m.certificatePending?Award:m.requiereMiAprobacion?CircleAlert:m.estado==='PENDIENTE_APROBACION'?Clock3:Route;
  return <li key={m.id} data-agenda-row className="agenda-row-enter"><Link to={mp(`/manifiestos/${m.id}${m.certificatePending?'#certificaciones':''}`)} className={`flex items-center gap-2 border-l-4 px-3 py-3 hover:bg-primary-50 ${m.requiereMiAprobacion?'border-l-primary-700 bg-primary-50/60':m.estado==='PENDIENTE_APROBACION'?'border-l-warning-500':'border-l-transparent'}`}>
    <Icon size={17} aria-hidden="true" className={`shrink-0 ${m.requiereMiAprobacion?'text-primary-800':'text-neutral-500'}`}/>
    <div className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-bold text-neutral-900"><span className="min-w-0 truncate" title={m.numero}>{m.numero}</span><span className="shrink-0 text-[11px] font-normal text-neutral-600">{m.fechaEstimadaRetiro?new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza',day:'2-digit',month:'short'}):'Sin fecha'}</span></span><span className={`block text-xs font-semibold ${m.requiereMiAprobacion?'text-primary-800':'text-neutral-700'}`}>{label(m,currentUser.rol)}</span></div>
    {m.partes&&<PartyApprovalStatus partes={m.partes} compact/>}<ChevronRight size={16} aria-hidden="true" className="shrink-0 text-primary-700"/></Link></li>;
 })}</ul>
 {!items.length&&<p role="status" className="p-4 text-sm text-neutral-600">Sin manifiestos para estos filtros.</p>}
 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-600"><span role="status">{total} pendientes · Página {actualPage} de {pages}</span><div className="flex gap-3"><button disabled={actualPage<=1||query.isFetching} className="min-h-11 font-semibold text-primary-800 disabled:text-neutral-400" onClick={()=>setPage(actualPage-1)}>Anterior</button><button disabled={actualPage>=pages||query.isFetching} className="min-h-11 font-semibold text-primary-800 disabled:text-neutral-400" onClick={()=>setPage(actualPage+1)}>Siguiente</button></div><Link className="min-h-11 inline-flex items-center font-semibold text-primary-800" to={mp('/manifiestos')}>Todos los manifiestos</Link></div></>}
 </Card></section>;
}

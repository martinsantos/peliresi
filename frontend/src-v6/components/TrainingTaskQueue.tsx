import { manifestProposalsVisible } from '../utils/manifestFeatures';
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Card } from './ui/CardV2';
import { PartyApprovalStatus, type PartyApproval } from './PartyApprovalStatus';
import { manifestWork } from '../utils/manifestWork';
import { useScopedSearchParams } from '../hooks/useScopedSearchParams';
const taskFilterKeys = ['pendientes', 'periodo', 'buscarPendiente', 'paginaPendientes'] as const;
type Task={id:string;numero:string;estado:string;modalidad?:string;fechaEstimadaRetiro:string|null;partes:PartyApproval[]|null;inicio:string|null;requiereMiAprobacion:boolean;pesajePendiente:boolean;certificatePending?:boolean;detail?:string;actores?:{generador:string;transportista:string|null;operador:string}};
const roleNames: Record<string,string> = { GENERADOR:'Generador', TRANSPORTISTA:'Transporte', OPERADOR:'Operador' };
function missingApprovals(m:Task){return ['PENDIENTE_APROBACION','APROBADO'].includes(m.estado) ? m.partes?.filter(p=>!p.aprobada).map(p=>roleNames[p.rol]||p.rol).join(', ') : '';}
export function TrainingTaskQueue(){
 const {currentUser}=useAuth(),mp=useMobilePrefix();
 const location=useLocation();
 const [showFilters,setShowFilters]=useState(false);
 const scope=currentUser?JSON.stringify([currentUser.id,currentUser.rol,currentUser.actorId||'',currentUser.empresaContexto?.empresaId||'',currentUser.empresaContexto?.establecimientoId||'']):'';
 const [params,setParams]=useScopedSearchParams('manifest-tasks',taskFilterKeys,scope);
 const allowedFilters=['all','mine','waiting','progress','certificates','drafts'];
 const filter=allowedFilters.includes(params.get('pendientes')||'')?params.get('pendientes')!:'all';
 const period=['today','future'].includes(params.get('periodo')||'')?params.get('periodo')!:'all';
 const search=(params.get('buscarPendiente')||'').slice(0,80);
 const rawPage=Number(params.get('paginaPendientes')||1),page=Number.isSafeInteger(rawPage)&&rawPage>0&&rawPage<=100000?rawPage:1;
 const changeFilter=(key:string,value:string)=>setParams(next=>{if(value&&value!=='all')next.set(key,value);else next.delete(key);next.delete('paginaPendientes');return next;});
 const setPage=(value:number)=>setParams(next=>{next.set('paginaPendientes',String(value));return next;});
 const query=useQuery({queryKey:['training-tasks',currentUser?.id,currentUser?.rol,currentUser?.actorId,currentUser?.empresaContexto?.empresaId,currentUser?.empresaContexto?.establecimientoId,filter,period,search,page],enabled:manifestProposalsVisible(currentUser),queryFn:async()=>(await api.get('/manifiestos/tareas-partes',{params:{filter,period,search,page,limit:6}})).data.data as {items:Task[];total:number;page:number;limit:number;counts:Record<string,number>},refetchInterval:5000,staleTime:0});
 if(!manifestProposalsVisible(currentUser) || !currentUser)return null;
 const items=query.data?.items||[], counts=query.data?.counts||{};
 const admin=currentUser.rol==='ADMIN'||currentUser.rol.startsWith('ADMIN_');
 const filters=admin?[['all','Todos'],['waiting','Por aprobar'],['progress','En curso'],['certificates','Certificados'],['drafts','Borradores']]:[['all','Todos'],['mine','Por aprobar'],['waiting','En espera'],['progress','En curso'],['certificates','Certificados'],['drafts','Borradores']];
 const hasWork=Object.values(counts).some(value=>value>0)||filter!=='all'||period!=='all'||!!search;
 const actualPage=query.data?.page||page, total=query.data?.total||0, pages=Math.max(1,Math.ceil(total/6));
 return <section aria-label="Agenda de manifiestos"><Card padding="none" className="overflow-hidden">
 <div className="px-4 pt-4">
 <div className="flex items-center justify-between gap-2 pb-3"><h3 className="flex min-w-0 items-center gap-2 text-base font-bold text-neutral-900"><CalendarDays size={20} className="shrink-0 text-primary-800" aria-hidden="true"/>Manifiestos pendientes</h3>
 {hasWork&&<button type="button" aria-expanded={showFilters||period!=='all'||!!search} aria-controls="agenda-filters" onClick={()=>setShowFilters(!showFilters)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-800 hover:bg-primary-50"><SlidersHorizontal size={16} aria-hidden="true"/>Filtrar</button>}</div>
 {hasWork&&<>
 {(showFilters||period!=='all'||!!search)&&<div id="agenda-filters" className="grid grid-cols-1 gap-2 pb-3 sm:grid-cols-2"><input aria-label="Buscar manifiesto en agenda" type="search" maxLength={80} placeholder="Buscar nº de manifiesto" value={search} onChange={e=>{changeFilter('buscarPendiente',e.target.value);}} className="h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 text-base sm:text-sm"/><select aria-label="Fecha de la agenda" value={period} onChange={e=>{changeFilter('periodo',e.target.value);}} className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm"><option value="all">Toda fecha</option><option value="today">Hoy</option><option value="future">Próximos</option></select></div>}
 <div role="group" aria-label="Filtrar agenda" className="flex gap-1.5 overflow-x-auto pb-3">{filters.map(([value,name])=><button type="button" key={value} title={(counts[value]??0)+((counts[value]??0)===1?' manifiesto · ':' manifiestos · ')+name} aria-pressed={filter===value} onClick={()=>{changeFilter('pendientes',value);}} className={'flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 '+(filter===value?'border-primary-800 bg-primary-800 text-white':'border-neutral-200 bg-white text-neutral-700 hover:bg-primary-50')}>{name}<span aria-hidden="true" className="tabular-nums">{counts[value]??''}</span></button>)}</div>
 </>}</div>
 {query.isError?<p role="alert" className="p-4">No pudimos actualizar la agenda. <button className="underline" onClick={()=>void query.refetch()}>Reintentar</button></p>:query.isPending?<p className="p-4">Cargando agenda…</p>:<>
 <ul className="divide-y divide-neutral-200">{items.map(m=>{
  const missing=missingApprovals(m), actors=m.actores ? [m.actores.generador,m.actores.operador].filter(Boolean).join(' → ') : '';
  const context=[m.numero,manifestWork(m,currentUser.rol).label,actors,m.actores?.transportista&&`Transporte: ${m.actores.transportista}`,missing?`Falta aprobar: ${missing}`:m.detail].filter(Boolean).join('. ');
  return <li key={m.id} data-agenda-row className="agenda-row-enter"><Link aria-label={context} title={context} state={{manifestHomeReturn:mp('/dashboard')+location.search}} to={mp(`/manifiestos/${m.id}${m.certificatePending?'#certificaciones':''}`)} className={`flex items-center gap-2 border-l-4 px-3 py-3 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700 ${m.requiereMiAprobacion?'border-l-primary-700 bg-primary-50/60':m.estado==='PENDIENTE_APROBACION'?'border-l-warning-500':'border-l-transparent'}`}>
    <div className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-neutral-900"><span className="min-w-0 truncate" title={m.numero}>{m.numero}</span><span className="shrink-0 text-[11px] font-normal text-neutral-600">{m.fechaEstimadaRetiro?new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza',day:'2-digit',month:'short'}):'Sin fecha'}</span></span><span className={`block text-xs font-semibold ${m.requiereMiAprobacion?'text-primary-800':'text-neutral-700'}`}>{manifestWork(m,currentUser.rol).label}</span>{actors&&<span className="block truncate text-xs text-neutral-600" title={actors}>{actors}</span>}{m.modalidad==='IN_SITU'&&<span className="block text-xs text-neutral-600">Tratamiento en origen · sin transporte</span>}</div>
    {m.partes&&<div className="shrink-0"><PartyApprovalStatus partes={m.partes} compact showSummary/></div>}<ChevronRight size={16} aria-hidden="true" className="shrink-0 text-primary-700"/>
    </Link></li>;
 })}</ul>
 {!items.length&&<p role="status" className="p-4 text-sm text-neutral-600">{hasWork?'Sin manifiestos para estos filtros.':'No tenés manifiestos pendientes.'}</p>}
 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-600">
 {pages>1&&<><span role="status">{total} pendientes · Página {actualPage} de {pages}</span><div className="flex gap-3"><button disabled={actualPage<=1||query.isFetching} className="min-h-11 font-semibold text-primary-800 disabled:text-neutral-400" onClick={()=>setPage(actualPage-1)}>Anterior</button><button disabled={actualPage>=pages||query.isFetching} className="min-h-11 font-semibold text-primary-800 disabled:text-neutral-400" onClick={()=>setPage(actualPage+1)}>Siguiente</button></div></>}
 <Link className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-800" to={mp('/manifiestos')}>Ver todos los manifiestos<ChevronRight size={16} aria-hidden="true"/></Link></div></>}
 </Card></section>;
}

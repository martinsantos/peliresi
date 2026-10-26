import React from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui/CardV2';
import {Input} from '../../../components/ui/Input';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import { Button } from '../../../components/ui/ButtonV2';
import { useScopedSearchParams } from '../../../hooks/useScopedSearchParams';
import { manifestDraftScope } from '../../../hooks/useManifestDraft';
export function ManifestAgenda(){
 const {currentUser}=useAuth();const mp=useMobilePrefix();const location=useLocation();const owner=manifestDraftScope(currentUser);
 const [params,setParams]=useScopedSearchParams('manifest-agenda',['programado','paginaProgramados'],owner);
 const search=params.get('programado')||'',rawPage=Number(params.get('paginaProgramados')||1),page=Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
 const setPage=(value:number)=>setParams(next=>{next.set('paginaProgramados',String(value));return next;});
 const setSearch=(value:string)=>setParams(next=>{if(value)next.set('programado',value);else next.delete('programado');next.delete('paginaProgramados');return next;});
 const query=useQuery({queryKey:['manifest-agenda',owner,search,page],queryFn:async()=>(await api.get('/manifiestos/agenda-partes',{params:{search,page}})).data.data as {total:number;items:{id:string;numero:string;fechaEstimadaRetiro:string;generador?:{razonSocial:string};operador?:{razonSocial:string}}[]},refetchInterval:15000,staleTime:0});
 return <section aria-label="Manifiestos programados"><Card padding="none" className="overflow-hidden"><div className="space-y-4 p-4">
   <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={20} aria-hidden="true" className="shrink-0 text-primary-800"/>Manifiestos programados</h2><Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar programados</Button></div>
   <Input label="Buscar manifiesto programado" type="search" maxLength={80} placeholder="Número de manifiesto" value={search} onChange={e=>{setSearch(e.target.value);}}/>
   </div>
   {query.isError?<p role="alert" className="px-4 pb-4">No se pudo cargar la agenda. <Button variant="outline" onClick={()=>void query.refetch()}>Reintentar</Button></p>:query.isPending?<p role="status" className="px-4 pb-4 text-sm text-neutral-600">Cargando agenda…</p>:!query.data?.total?<p role="status" className="px-4 pb-4 text-sm text-neutral-600">Sin retiros aprobados para esta búsqueda.</p>:<ul className="divide-y divide-neutral-200 border-t border-neutral-200">{query.data.items.map(m=>{
     const date=new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza',weekday:'short',day:'numeric',month:'short'});
     const route=[m.generador?.razonSocial,m.operador?.razonSocial].filter(Boolean).join(' → ');
     return <li key={m.id}><Link className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700" state={{manifestListReturn:location.pathname+location.search}} to={mp(`/manifiestos/${m.id}`)}>
       <span className="w-20 shrink-0 text-sm font-semibold text-primary-800">{date}</span>
       <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-neutral-900">{m.numero}</span>{route&&<span className="block break-words text-sm text-neutral-600">{route}</span>}</span>
       <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-primary-800"/>
     </Link></li>;
   })}</ul>}

   {((query.data?.total||0)>50||page>1)&&<div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-4"><Button size="sm" variant="outline" disabled={page===1||query.isFetching} onClick={()=>setPage(page-1)}>Anterior</Button><span className="text-sm">Página {page} de {Math.max(1,Math.ceil((query.data?.total||0)/50))}</span><Button size="sm" variant="outline" disabled={page*50>=(query.data?.total||0)||query.isFetching} onClick={()=>setPage(page+1)}>Siguiente</Button></div>}
 </Card></section>;
}

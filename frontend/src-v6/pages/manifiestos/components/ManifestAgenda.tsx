import React from 'react';
import {Input} from '../../../components/ui/Input';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import { Button } from '../../../components/ui/ButtonV2';
export function ManifestAgenda(){
 const {currentUser}=useAuth();const mp=useMobilePrefix();const location=useLocation();const [params,setParams]=useSearchParams();
 const search=params.get('programado')||'',rawPage=Number(params.get('paginaProgramados')||1),page=Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
 const setPage=(value:number)=>{const next=new URLSearchParams(params);next.set('paginaProgramados',String(value));setParams(next,{replace:true});};
 const setSearch=(value:string)=>{const next=new URLSearchParams(params);if(value)next.set('programado',value);else next.delete('programado');next.delete('paginaProgramados');setParams(next,{replace:true});};
 const query=useQuery({queryKey:['manifest-agenda',currentUser?.id,currentUser?.rol,currentUser?.actorId,currentUser?.empresaContexto?.empresaId,currentUser?.empresaContexto?.establecimientoId,search,page],queryFn:async()=>(await api.get('/manifiestos/agenda-partes',{params:{search,page}})).data.data as {total:number;items:{id:string;numero:string;fechaEstimadaRetiro:string}[]},refetchInterval:15000,staleTime:0});
 return <section aria-label="Manifiestos programados" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
   <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Manifiestos programados</h2><Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar programados</Button></div>
   <Input label="Buscar manifiesto programado" type="search" maxLength={80} placeholder="Número de manifiesto" value={search} onChange={e=>{setSearch(e.target.value);}}/>
   {query.isError?<p role="alert">No se pudo cargar la agenda.</p>:query.isPending?<p>Cargando agenda...</p>:!query.data?.total?<p className="text-sm">Sin retiros aprobados para esta búsqueda.</p>:<ul className="space-y-2">{query.data.items.map(m=><li key={m.id}><Link className="inline-flex min-h-11 items-center gap-2 text-primary-800 underline" state={{manifestListReturn:location.pathname+location.search}} to={mp(`/manifiestos/${m.id}`)}>{new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})} · {m.numero}</Link></li>)}</ul>}
   {((query.data?.total||0)>50||page>1)&&<div className="flex items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={page===1||query.isFetching} onClick={()=>setPage(page-1)}>Anterior</Button><span className="text-sm">Página {page} de {Math.max(1,Math.ceil((query.data?.total||0)/50))}</span><Button size="sm" variant="outline" disabled={page*50>=(query.data?.total||0)||query.isFetching} onClick={()=>setPage(page+1)}>Siguiente</Button></div>}
 </section>;
}

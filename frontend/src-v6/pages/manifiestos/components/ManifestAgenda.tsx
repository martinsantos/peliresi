import React, {useState} from 'react';
import {Input} from '../../../components/ui/Input';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import { Button } from '../../../components/ui/ButtonV2';
export function ManifestAgenda(){
 const {currentUser}=useAuth();const mp=useMobilePrefix();const [search,setSearch]=useState(''),[page,setPage]=useState(1);
 const query=useQuery({queryKey:['manifest-agenda',currentUser?.id,search,page],queryFn:async()=>(await api.get('/manifiestos/agenda-partes',{params:{search,page}})).data.data as {total:number;items:{id:string;numero:string;fechaEstimadaRetiro:string}[]},refetchInterval:15000,staleTime:0});
 return <details aria-label="Próximos retiros" className="border-b border-neutral-200 pb-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary-800">Ver manifiestos programados · {query.data?.total ?? "…"}</summary><div className="space-y-2">
   <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Próximos retiros</h2><Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar agenda</Button></div>
   <Input label="Buscar manifiesto programado" type="search" maxLength={80} placeholder="Número de manifiesto" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
   {query.isError?<p role="alert">No se pudo cargar la agenda.</p>:query.isPending?<p>Cargando agenda...</p>:!query.data?.total?<p className="text-sm">Sin retiros aprobados para esta búsqueda.</p>:<ul className="space-y-2">{query.data.items.map(m=><li key={m.id}><Link className="inline-flex min-h-11 items-center gap-2 text-primary-800 underline" to={mp(`/manifiestos/${m.id}`)}>{new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})} · {m.numero}</Link></li>)}</ul>}
   {((query.data?.total||0)>50||page>1)&&<div className="flex items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={page===1||query.isFetching} onClick={()=>setPage(page-1)}>Anterior</Button><span className="text-sm">Página {page} de {Math.max(1,Math.ceil((query.data?.total||0)/50))}</span><Button size="sm" variant="outline" disabled={page*50>=(query.data?.total||0)||query.isFetching} onClick={()=>setPage(page+1)}>Siguiente</Button></div>}
 </div></details>;
}

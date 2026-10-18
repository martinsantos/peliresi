import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import { Button } from '../../../components/ui/ButtonV2';
export function ManifestAgenda(){
 const {currentUser}=useAuth();const mp=useMobilePrefix();
 const query=useQuery({queryKey:['manifest-agenda',currentUser?.id],queryFn:async()=>(await api.get('/manifiestos/agenda-partes')).data.data as {total:number;items:{id:string;numero:string;fechaEstimadaRetiro:string}[]},refetchInterval:15000,staleTime:0});
 return <details aria-label="Próximos retiros" className="border-b border-neutral-200 pb-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary-800">Ver manifiestos programados · {query.data?.total ?? "…"}</summary><div className="space-y-2">
   <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Próximos retiros</h2><Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar agenda</Button></div>
   <p className="text-sm">Son los mismos manifiestos del listado, ordenados por su fecha prevista. No requieren otra alta.</p>
   {query.isError?<p role="alert">No se pudo cargar la agenda.</p>:query.isPending?<p>Cargando agenda...</p>:!query.data?.total?<p className="text-sm">Todavía no hay retiros aprobados para estas fechas.</p>:<ul className="space-y-2">{query.data.items.map(m=><li key={m.id}><Link className="inline-flex min-h-11 items-center gap-2 text-primary-800 underline" to={mp(`/manifiestos/${m.id}`)}>{new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})} · {m.numero}</Link></li>)}</ul>}
   {(query.data?.total||0)>50&&<p>Se muestran los próximos 50 retiros. El resto permanece en el listado de manifiestos.</p>}
 </div></details>;
}

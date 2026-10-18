import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
type Task={id:string;numero:string;action:string;detail:string;fechaEstimadaRetiro:string|null};
export function TrainingTaskQueue(){
 const {currentUser}=useAuth(),mp=useMobilePrefix();
 const query=useQuery({queryKey:['training-tasks',currentUser?.id],enabled:!!currentUser?.training,queryFn:async()=>(await api.get('/manifiestos/tareas-partes')).data.data as {items:Task[];total:number;limited:boolean},refetchInterval:5000,staleTime:0});
 if(!currentUser?.training)return null;
 return <section aria-label="Tu próximo paso" className="space-y-3"><div className="flex items-center gap-2"><ClipboardCheck size={22} className="text-primary-700"/><h2 className="text-lg font-bold">Tu próximo paso</h2></div><p className="text-sm text-neutral-600">Trabajo actual por manifiesto. Los avisos guardan la historia; leerlos no completa estos pasos.</p>
 {query.isError?<p role="alert">No pudimos actualizar los pendientes. <button className="underline" onClick={()=>void query.refetch()}>Reintentar</button></p>:query.isPending?<p>Cargando pendientes…</p>:!query.data?.total?<p>Sin pasos pendientes por ahora.</p>:<><ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">{query.data.items.slice(0,5).map(m=><li key={m.id}><Link to={mp(`/manifiestos/${m.id}`)} className="flex items-start gap-3 p-4 hover:bg-primary-50"><div className="min-w-0 flex-1"><span className="text-xs font-semibold text-primary-800">{m.numero}</span><strong className="mt-1 block text-base text-neutral-900">{m.action}</strong><span className="mt-1 block text-sm text-neutral-600">{m.detail}</span>{m.fechaEstimadaRetiro&&<span className="mt-2 block text-xs text-neutral-600">Fecha prevista: {new Date(m.fechaEstimadaRetiro).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza'})}</span>}</div><ArrowRight size={20} className="shrink-0 text-primary-700"/></Link></li>)}</ul>{query.data.total>5&&<Link className="inline-flex min-h-11 items-center font-semibold text-primary-800 underline" to={mp('/manifiestos')}>Ver todos los manifiestos · {query.data.total} con pasos pendientes</Link>}</>}
 </section>;
}

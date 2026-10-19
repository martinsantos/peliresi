import React, { useEffect, useRef, useState } from 'react';
import { Play, XCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../services/api';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/ButtonV2';

type Approval = { autorRol: string; rechazo?: string; estado: string; inicio: string|null; puedeIniciar: boolean; partes: { rol: string; aprobada: boolean }[]; puedeAprobar: string | null };
const names: Record<string, string> = { OPERADOR: 'Operador', GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte' };
import { PartyApprovalStatus } from '../../../components/PartyApprovalStatus';
export function ManifestProposalApprovals({ id, estado, onSign }: { id: string; estado?: string; onSign: () => void }) {
  const { currentUser } = useAuth(); const qc = useQueryClient();
  const [motivo,setMotivo] = useState(''),[rejecting,setRejecting]=useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''),[now,setNow]=useState(Date.now()); const lock=useRef(false);
  const key=['manifest-proposal',currentUser?.id,id];
  const query=useQuery({queryKey:key,enabled:!!currentUser?.training,
    queryFn:async()=> (await api.get(`/manifiestos/${id}/aprobaciones`)).data.data as Approval|null,
    refetchInterval:5000,refetchOnMount:'always', staleTime:0, retry:false});
  useEffect(()=>{if(query.data && query.data.estado!==estado)void qc.invalidateQueries({queryKey:['manifiestos','detail',id]});},[query.data,estado,id,qc]);
  useEffect(()=>{if(!query.data?.inicio||query.data.estado!=='APROBADO')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[query.data?.inicio,query.data?.estado]);
  if(!currentUser?.training)return null;
  if(query.isError)return <p role="alert">No pudimos comprobar las aprobaciones. <Button onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button></p>;
  if(!query.data)return null;
  const data=query.data,approved=data.partes.filter(p=>p.aprobada).length,missing=data.partes.filter(p=>!p.aprobada).map(p=>names[p.rol]).join(', ');
  async function act(action:'approve'|'reject'|'start'){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await api.post(`/manifiestos/${id}/${action==='start'?'iniciar-coordinacion':'aprobar-parte'}`,action==='reject'?{decision:'RECHAZADA',motivo}:undefined);await qc.invalidateQueries({queryKey:key});await qc.invalidateQueries({queryKey:['manifiestos']});await qc.invalidateQueries({queryKey:['training-tasks']});}
    catch(e:any){setError(e.response?.data?.message||'No se pudo guardar. Reintentá.');}
    finally{lock.current=false;setBusy(false);}
  }
  const minutes=data.inicio?Math.max(0,Math.floor((now-Date.parse(data.inicio))/1000)):0;
  return <section aria-label="Aprobaciones de las partes" className="mb-4 space-y-3 border-b border-neutral-200 pb-4">
    <div><p className="text-sm text-neutral-600">Creado por {names[data.autorRol] || 'Administrador'}</p><h3 className="text-lg font-bold text-neutral-900">{data.rechazo?'Propuesta detenida':approved===3?'3 de 3 · Aprobado':`${approved} de 3 aprobaciones`}</h3></div>
    <PartyApprovalStatus partes={data.partes}/>
    {data.estado==='PENDIENTE_APROBACION' && <p role="status" className="text-sm"><strong>{data.puedeAprobar?'Te toca revisar y aprobar.':data.partes.some(p=>p.rol===currentUser?.rol&&p.aprobada)?'Tu aprobación está registrada.':'Esperando a las partes.'}</strong> Falta aprobar: {missing}.</p>}
    {data.puedeAprobar==='GENERADOR'?<Button fullWidth onClick={onSign}>Firmar Manifiesto</Button>:data.puedeAprobar?<Button fullWidth disabled={busy} onClick={()=>void act('approve')}>{busy?'Guardando...':`Aprobar como ${names[data.puedeAprobar].toLowerCase()}`}</Button>:null}
    {data.estado==='APROBADO' && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
      <p className="font-semibold">{data.inicio?'Coordinación iniciada':'Todo aprobado'}</p>

      {data.inicio?<p className="tabular-nums text-xl font-bold" aria-label="Tiempo de coordinación">{Math.floor(minutes/3600).toString().padStart(2,'0')}:{Math.floor(minutes/60)%60<10?'0':''}{Math.floor(minutes/60)%60}:{(minutes%60).toString().padStart(2,'0')}</p>:data.puedeIniciar?<Button fullWidth leftIcon={<Play size={18}/>} disabled={busy} onClick={()=>void act('start')}>Iniciar coordinación</Button>:null}
      <p className="text-xs">Retiro físico → viaje y GPS.</p>
    </div>}
    {data.puedeAprobar && <details open={rejecting} onToggle={e=>setRejecting(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-sm text-error-800">No puedo participar / rechazar</summary><Input label="Motivo del rechazo" maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} /><Button variant="outline" disabled={busy||!motivo.trim()} onClick={()=>void act('reject')}>Rechazar mi participación</Button></details>}
    {data.rechazo && <p role="status" className="rounded-xl bg-error-50 p-3 text-error-800"><XCircle className="inline mr-2" size={20}/>Propuesta rechazada: {JSON.parse(data.rechazo).motivo}. No se puede iniciar ni retirar; hace falta otra propuesta.</p>}
    {error&&<p role="alert">{error}</p>}
    <button type="button" className="min-h-11 text-xs text-neutral-600 underline" onClick={()=>void query.refetch()}>Actualizar aprobaciones</button>
  </section>;
}

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../services/api';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/ButtonV2';

type Approval = { autorRol: string; rechazo?: string; estado: string; partes: { rol: string; aprobada: boolean }[]; puedeAprobar: string | null };
const names: Record<string, string> = { OPERADOR: 'Operador', GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte' };
export function ManifestProposalApprovals({ id, estado, onSign }: { id: string; estado?: string; onSign: () => void }) {
  const { currentUser } = useAuth(); const qc = useQueryClient();
  const [motivo,setMotivo] = useState('');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''); const lock=useRef(false);
  const key=['manifest-proposal',currentUser?.id,id];
  const query=useQuery({queryKey:key,enabled:!!currentUser?.training,
    queryFn:async()=> (await api.get(`/manifiestos/${id}/aprobaciones`)).data.data as Approval|null,
    refetchInterval: q => q.state.data?.estado === 'PENDIENTE_APROBACION' ? 5000 : false,
    refetchOnMount:'always', staleTime:0, retry:false});
  useEffect(()=>{if(query.data && query.data.estado!==estado)void qc.invalidateQueries({queryKey:['manifiestos','detail',id]});},[query.data,estado,id,qc]);
  if(!currentUser?.training)return null;
  if(query.isError)return <p role="alert">No pudimos comprobar las aprobaciones. <Button onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button></p>;
  if(!query.data)return null;
  const data=query.data;
  async function approve(reject=false){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await api.post(`/manifiestos/${id}/aprobar-parte`,reject?{decision:'RECHAZADA',motivo}:undefined);await qc.invalidateQueries({queryKey:key});await qc.invalidateQueries({queryKey:['manifiestos']});}
    catch(e:any){setError(e.response?.data?.message||'No se pudo aprobar. Reintentá.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <section aria-label="Aprobaciones de las partes" className="mb-4 space-y-3 border-b border-neutral-200 pb-4">
    <h3 className="font-semibold">Propuesta iniciada por {names[data.autorRol] || 'Administrador'}</h3>
    <p className="text-sm">Cada parte aprueba desde su cuenta. El retiro se habilita cuando aprueban las tres.</p>
    <ul className="space-y-1 text-sm">{data.partes.map(p=><li key={p.rol}>{names[p.rol]}: <strong>{p.aprobada?'Aprobado':'Pendiente'}</strong></li>)}</ul>
    {data.puedeAprobar==='GENERADOR'?<Button onClick={onSign}>Firmar Manifiesto</Button>:
      data.puedeAprobar?<Button disabled={busy} onClick={()=>void approve()}>{busy?'Guardando...':`Aprobar como ${names[data.puedeAprobar].toLowerCase()}`}</Button>:null}
    {data.estado==='PENDIENTE_APROBACION' && <p role="status" className="text-sm">Pendiente de aprobación: todavía no se puede retirar.</p>}
    {data.estado==='APROBADO' && <p role="status" className="text-sm font-semibold">Las tres partes aprobaron. Transporte ya puede confirmar el retiro.</p>}
    {data.puedeAprobar && <div className="space-y-2"><Input label="Motivo del rechazo" maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} /><Button variant="outline" disabled={busy||!motivo.trim()} onClick={()=>void approve(true)}>Rechazar mi participación</Button></div>}
    {data.rechazo && <p role="status">Propuesta rechazada: {JSON.parse(data.rechazo).motivo}. No se puede retirar; creá otra propuesta si corresponde.</p>}
    {error&&<p role="alert">{error}</p>}
    <Button variant="outline" size="sm" onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button>
  </section>;
}

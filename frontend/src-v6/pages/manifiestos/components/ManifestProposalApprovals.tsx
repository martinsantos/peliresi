import { manifestProposalsVisible } from '../../../utils/manifestFeatures';
import React, { useEffect, useRef, useState } from 'react';
import { Play, RefreshCw, XCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../services/api';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/ButtonV2';
import { manifestDraftScope } from '../../../hooks/useManifestDraft';

type Approval = { modalidad?: string; autorRol: string; rechazo?: string | null; estado: string; inicio: string|null; puedeIniciar: boolean; partes: { rol: string; aprobada: boolean }[]; puedeAprobar: string | null; puedeRechazar?: boolean; requiereNuevaPropuesta?: boolean };
const names: Record<string, string> = { OPERADOR: 'Operador', GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte' };
import { ManifestNextStep } from '../../../components/ManifestNextStep';
import { hasThreePartyStatuses, rejectionReason, validCoordinationTime, validPartyStatuses } from '../../../utils/manifestWork';
import { PartyApprovalStatus } from '../../../components/PartyApprovalStatus';
import { LegacyProposalRecoveryLink } from './LegacyProposalRecoveryLink';
export function ManifestProposalApprovals({ id, onSign }: { id: string; estado?: string; onSign: () => void }) {
  const { currentUser } = useAuth(); const qc = useQueryClient();
  const [motivo,setMotivo] = useState(''),[rejecting,setRejecting]=useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''); const lock=useRef(false);
  const key=['manifest-proposal',manifestDraftScope(currentUser),id];
  const query=useQuery({queryKey:key,enabled:manifestProposalsVisible(currentUser),
    queryFn:async()=> (await api.get(`/manifiestos/${id}/aprobaciones`)).data.data as Approval|null,
    refetchInterval:5000,refetchOnMount:'always', staleTime:0, retry:false});
  const revision = query.data ? JSON.stringify([query.data.estado,query.data.inicio,query.data.rechazo,query.data.partes]) : null;
  // Coordination does not change APROBADO. Refresh the parent on event changes too,
  // so another party's start unlocks physical pickup without a page reload.
  useEffect(()=>{if(revision)void qc.invalidateQueries({queryKey:['manifiestos','detail',id]});},[revision,id,qc]);
  if(!manifestProposalsVisible(currentUser) || !currentUser)return null;
  if(query.isError)return <p role="alert">No pudimos comprobar las aprobaciones. <Button onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button></p>;
  if(query.isPending)return <p role="status" className="py-3 text-sm text-neutral-600">Comprobando aprobaciones…</p>;
  if(!query.data)return <p role="alert" className="py-3 text-sm">No se encontraron las aprobaciones de esta propuesta. <Button variant="outline" onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button></p>;
  const data=query.data;
  const ongoing=['PENDIENTE_APROBACION','APROBADO'].includes(data.estado);
  const validFlags = typeof data.puedeIniciar === 'boolean' && (data.puedeRechazar === undefined || typeof data.puedeRechazar === 'boolean') &&
    (data.requiereNuevaPropuesta === undefined || typeof data.requiereNuevaPropuesta === 'boolean') &&
    (data.puedeAprobar === null || typeof data.puedeAprobar === 'string') && (data.rechazo == null || typeof data.rechazo === 'string');
  if (!validFlags || !validCoordinationTime(data.inicio) || !validPartyStatuses(data.partes) || (ongoing && !data.requiereNuevaPropuesta && !hasThreePartyStatuses(data.partes))) return <p role="alert" className="py-3 text-sm">No pudimos comprobar las aprobaciones. Actualizá el manifiesto y, si continúa el problema, consultá a Ambiente. <Button variant="outline" onClick={()=>void query.refetch()}>Actualizar aprobaciones</Button></p>;
  const approved=data.partes.filter(p=>p.aprobada).length;
  // Older APIs omit this field when no rejection exists, but may return null
  // or an empty description for a recorded rejection. Do not infer consent.
  const rejectionRecorded = data.rechazo !== undefined;
  const rejectionText = typeof data.rechazo === 'string' && data.rechazo.trim() ? data.rechazo : 'Rechazo registrado sin motivo disponible';
  const unanimous = !data.requiereNuevaPropuesta && data.partes.length === 3
    && ['GENERADOR','TRANSPORTISTA','OPERADOR'].every(role => data.partes.some(part => part.rol === role && part.aprobada)) && !rejectionRecorded;
  const stateConflict = data.estado === 'PENDIENTE_APROBACION' && (unanimous || data.inicio !== null);
  const participant = !!currentUser.actorId && data.partes.some(part => part.rol === currentUser.rol);
  const decisionConflict = data.puedeAprobar != null && (data.estado !== 'PENDIENTE_APROBACION' || rejectionRecorded || !!data.requiereNuevaPropuesta ||
    !participant || data.puedeAprobar !== currentUser.rol || !data.partes.some(part => part.rol === data.puedeAprobar && !part.aprobada)) ||
    (data.puedeRechazar === true && (!participant || data.estado !== 'PENDIENTE_APROBACION' || rejectionRecorded)) ||
    (data.puedeIniciar === true && (data.estado !== 'APROBADO' || !!data.inicio || !participant));
  const conflicting = stateConflict || decisionConflict;
  const creator = typeof data.autorRol === 'string' && Object.prototype.hasOwnProperty.call(names, data.autorRol)
    ? names[data.autorRol] : data.autorRol === 'ADMIN' ? 'Administrador' : 'No informado';
  if(!['PENDIENTE_APROBACION','APROBADO'].includes(data.estado)&&!rejectionRecorded)return <section aria-label="Aprobaciones de las partes" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4"><span className="text-sm font-medium text-neutral-700">Aprobaciones registradas</span><PartyApprovalStatus partes={data.partes} compact showSummary/></section>;
  async function act(action:'approve'|'reject'|'start'){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await api.post(`/manifiestos/${id}/${action==='start'?'iniciar-coordinacion':'aprobar-parte'}`,action==='reject'?{decision:'RECHAZADA',motivo}:undefined);await Promise.all([key,['manifiestos'],['training-tasks'],['manifest-agenda'],['notificaciones']].map(queryKey=>qc.invalidateQueries({queryKey})));}
    catch(e:any){setError(e.response?.data?.message||'No se pudo guardar. Reintentá.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <section aria-label="Aprobaciones de las partes" className="mb-4 grid gap-4 border-b border-neutral-200 pb-4 lg:grid-cols-2 lg:gap-8">
    <div className="min-w-0 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-neutral-900">{rejectionRecorded?'Propuesta detenida':data.requiereNuevaPropuesta?'Propuesta anterior':conflicting?'Revisar aprobaciones':unanimous?`${approved} de ${data.partes.length} · Aprobado`:`${approved} de ${data.partes.length} aprobaciones`}</h3><p className="mt-1 text-xs text-neutral-600">Creado por {creator}{data.modalidad==='IN_SITU'?' · En origen, sin traslado':''}</p></div><button type="button" aria-label="Actualizar aprobaciones" title="Actualizar aprobaciones" disabled={query.isFetching} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:opacity-50" onClick={()=>void query.refetch()}><RefreshCw size={18} aria-hidden="true"/></button></div>
    <PartyApprovalStatus partes={data.partes}/>
    </div>
    <div className="min-w-0 space-y-3">
    {data.requiereNuevaPropuesta&&<div role="alert" className="rounded-xl bg-warning-50 p-3 text-warning-900"><p>Esta propuesta anterior no tiene transporte aprobador. Una cuenta habilitada debe presentar una nueva propuesta con las tres partes para iniciar; el historial anterior se conserva.</p><LegacyProposalRecoveryLink manifestId={id} /></div>}
    {conflicting && <p role="alert" className="rounded-xl bg-warning-50 p-3 text-warning-900">{stateConflict?'El estado no coincide con las decisiones registradas.':'No pudimos comprobar qué acción corresponde a tu cuenta.'} Actualizá las aprobaciones y, si continúa el problema, consultá a Ambiente.</p>}
    {ongoing && !rejectionRecorded && !data.requiereNuevaPropuesta && !conflicting && <ManifestNextStep work={{...data,requiereMiAprobacion:!!data.puedeAprobar}} role={currentUser.rol} showLabel={!!data.inicio || (!data.puedeAprobar && !data.puedeIniciar)}/>}
    {!conflicting && !rejectionRecorded && data.estado==='PENDIENTE_APROBACION' && !data.puedeAprobar && data.partes.some(p=>p.rol===currentUser.rol&&p.aprobada) && <p role="status" className="text-sm text-neutral-700">Tu aprobación está registrada.{data.puedeRechazar && <> Si ya no podés participar, podés rechazar mientras la propuesta siga pendiente. Ambas decisiones quedan en el historial.</>}</p>}
    {!conflicting && !rejectionRecorded && (data.puedeAprobar==='GENERADOR'?<Button fullWidth onClick={onSign}>Firmar Manifiesto</Button>:data.puedeAprobar?<Button fullWidth disabled={busy} onClick={()=>void act('approve')}>{busy?'Guardando...':`Aprobar como ${names[data.puedeAprobar].toLowerCase()}`}</Button>:null)}
    {!conflicting && !rejectionRecorded && data.estado==='APROBADO' && !unanimous && !data.requiereNuevaPropuesta && <p role="alert" className="rounded-xl bg-warning-50 p-3 text-warning-900">No constan todas las aprobaciones. No se puede iniciar. Actualizá las aprobaciones y, si persiste, contactá a Administración.</p>}
    {!conflicting && data.estado==='APROBADO' && unanimous && (data.inicio||data.puedeIniciar) && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
      {data.inicio&&<p className="font-semibold">Coordinación iniciada</p>}

      {!data.inicio&&data.puedeIniciar?<Button fullWidth leftIcon={<Play size={18}/>} disabled={busy} onClick={()=>void act('start')}>Iniciar coordinación</Button>:null}

    </div>}
    {!conflicting && !rejectionRecorded && (data.puedeAprobar||data.puedeRechazar) && <details open={rejecting} onToggle={e=>setRejecting(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-sm text-error-800">No puedo participar / rechazar</summary><Input label="Motivo del rechazo" maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} /><Button variant="outline" disabled={busy||!motivo.trim()} onClick={()=>void act('reject')}>Rechazar mi participación</Button></details>}
    {rejectionRecorded && <p role="status" className="rounded-xl bg-error-50 p-3 text-error-800"><XCircle className="inline mr-2" size={20}/>Propuesta rechazada: {rejectionReason(rejectionText)}. No se puede iniciar ni retirar; hace falta otra propuesta.</p>}
    {error&&<p role="alert">{error}</p>}
    </div>
  </section>;
}

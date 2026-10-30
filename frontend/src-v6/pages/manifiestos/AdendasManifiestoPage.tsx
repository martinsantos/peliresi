import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileSearch, ClipboardCheck, UserRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, getAccessToken } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { Input } from '../../components/ui/Input';
import { OperatorFindingSummary } from '../../components/manifiestos/OperatorFindingSummary';
import type { OperatorFinding } from '../../types/inspectionIntake';
import type { EstadoManifiesto } from '../../types/models';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { manifestDraftScope } from '../../hooks/useManifestDraft';
import { supportRequestContext } from '../../utils/supportSession';
import { addendumCommandConfirmed, addendumCommandPath, addendumDraftScope, addendumSubmissionKey, clearAddendumSubmission,
  dispatchAddendumSubmission, legacyAddendumCommand, legacyAddendumSignature, readAddendumSubmission, validAddendumCommand,
  writeAddendumSubmission, type AddendumCommand, type AddendumSubmission } from '../../services/addendumSubmission';
import { formatEstado } from '../../utils/formatters';

type Waste = { corriente: string; cantidad: number; unidad: string };
type Author = { nombre: string; rol: string };
const roleLabels: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador', ADMIN: 'Administración',
  ADMIN_GENERADOR: 'Administración de Generadores', ADMIN_OPERADOR: 'Administración de Operadores', ADMIN_TRANSPORTISTA: 'Administración de Transporte' };
const authorLabel = (author: Author | null | undefined, id: string) => author ? `${roleLabels[author.rol] || author.rol} · ${author.nombre}` : `Cuenta ${id}`;
type Adenda = { id: string; motivo: string; rectificaId: string | null; version: number; estadoRevision: string; puedeResolver: boolean; observacionResueltaPorRectificacion?: boolean; relacionRectificacionInvalida?: boolean;
  informeHallazgo?: OperatorFinding | null; autor?: Author | null;
  creadoPorId: string; createdAt: string; residuos: Waste[]; declaracion: { numero: string; residuos: Waste[] };
  revisiones: { autor?: Author | null; id: string; autorId: string; fecha: string; decision: string; nota: string }[] };
type Data = { finalLiberado?: boolean; puedeInformarHallazgo?: boolean; adendas: Adenda[]; total: number; puedeRegistrar: boolean; manifiesto: { numero: string; estado: EstadoManifiesto; residuos?: Waste[] };
  documental?: { pendientes: number; observadas: number; rechazadas: number; estado: string; cierreAcreditado: boolean } };
const labels: Record<string, string> = { PENDIENTE: 'Pendiente de revisión', APROBADA: 'Aprobada post facto', OBSERVADA: 'Observada', RECHAZADA: 'Conformidad rechazada' };
function reviewGuidance(item: Adenda, userId: string | number | undefined, canRegister: boolean): string {
  if (item.observacionResueltaPorRectificacion) return 'Una rectificación aprobada resolvió esta observación. El antecedente conserva su estado.';
  if (item.puedeResolver) return item.estadoRevision === 'PENDIENTE'
    ? 'Podés revisar la evidencia y registrar tu decisión.'
    : 'La última decisión está registrada. Podés revisarla y registrar otra decisión.';
  if (item.estadoRevision === 'APROBADA') return 'La última revisión aprobó esta adenda; no implica unanimidad.';
  if (item.estadoRevision === 'OBSERVADA') return canRegister
    ? 'La última revisión observó esta adenda. Revisá el motivo y, si corresponde, agregá una rectificación.'
    : 'La última revisión observó esta adenda. Revisá el motivo.';
  if (item.estadoRevision === 'RECHAZADA') return canRegister
    ? 'La conformidad fue rechazada. Revisá el motivo y, si corresponde, agregá una rectificación.'
    : 'La conformidad fue rechazada. Revisá el motivo.';
  return item.creadoPorId === userId && canRegister
    ? 'Informe registrado. Las otras partes pueden revisarlo; vos podés agregar una rectificación.'
    : 'Consultá las decisiones y el anexo conservado.';
}
const emptyWaste = (): Waste => ({ corriente: '', cantidad: 0, unidad: 'kg' });
const observedUnits = ['kg', 'lt', 'tn', 'un', 'l', 't', 'm3'];
type AddendumDraft = { creating: boolean; rectificaId?: string; wastes: Waste[]; motivo: string; notes: Record<string,string>; noteVersions: Record<string,number>; pending?: { signature: string; id: string } };
const emptyDraft = (): AddendumDraft => ({ creating:false,wastes:[emptyWaste()],motivo:'',notes:{},noteVersions:{} });
function validDraft(value: unknown): value is AddendumDraft {
 if (!value || typeof value !== 'object') return false;
 const v=value as AddendumDraft;
 return typeof v.creating==='boolean' && typeof v.motivo==='string' && v.motivo.length<=500 && (v.rectificaId===undefined||typeof v.rectificaId==='string')
  && Array.isArray(v.wastes)&&v.wastes.length>0&&v.wastes.length<=50&&v.wastes.every(r=>r&&typeof r.corriente==='string'&&typeof r.unidad==='string'&&Number.isFinite(r.cantidad))
  && !!v.notes&&typeof v.notes==='object'&&Object.values(v.notes).every(n=>typeof n==='string'&&n.length<=500)
  && !!v.noteVersions&&typeof v.noteVersions==='object'&&Object.values(v.noteVersions).every(n=>Number.isSafeInteger(n)&&n>=0)
  && (!v.pending||(typeof v.pending.id==='string'&&typeof v.pending.signature==='string'));
}
function Load({ rows }: { rows: Waste[] }) {
  return <ul className="space-y-1">{rows.map((row, i) => <li key={i}>{row.corriente} · {row.cantidad} {row.unidad}</li>)}</ul>;
}
function mayKeepDraft(key:string,ownPending?:string,ledgerPending?:string):boolean {
  try{
    const raw=localStorage.getItem(key);if(raw===null)return true;
    const record=JSON.parse(raw);
    if(!record||record.version!==1||typeof record.revision!=='string'||!Number.isFinite(record.savedAt)
      ||(record.value!==null&&!validDraft(record.value)))return false;
    const pending=(record.value as AddendumDraft|null)?.pending;
    return !pending||pending.id===ownPending||pending.id===ledgerPending;
  }catch{return false;}
}
export default function AdendasManifiestoPage() {
 const { id }=useParams();const {currentUser}=useAuth();
 const identity=currentUser&&id?addendumDraftScope(manifestDraftScope(currentUser)+':'+id,currentUser.id,getAccessToken()):null;
 const session=supportRequestContext();
 if(!identity||!session)return <p role="status" className="p-4">Ingresá nuevamente para recuperar la actividad y sus borradores.</p>;
 return <AddendumContext key={JSON.stringify([identity.scope,session])} scope={identity.scope} session={session} impersonator={identity.impersonator}/>;
}
function AddendumContext({scope,session,impersonator}:{scope:string;session:string;impersonator:string|null}) {
  const { id } = useParams(); const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const enabled = manifestFeatureVisible(import.meta.env.VITE_MANIFEST_ADDENDA_ENABLED, currentUser);
  const [params, setParams] = useSearchParams();
  const selected = params.get('adenda');
  const [page, setPage] = useState(1); const qc = useQueryClient();
  const key = ['manifiesto-adendas', scope];
  const endpoint = `/manifiestos/${encodeURIComponent(id || '')}/adendas`;
  const query = useQuery({ queryKey: [...key, page, selected], enabled: enabled && !!id && !!currentUser,
    queryFn: async () => (await api.get(endpoint, { params: { page, ...(selected ? { adenda: selected } : {}) } })).data.data as Data, retry: false, refetchInterval: 5000 });
  const draftKey='sitrep:adenda-form:v1:'+scope;
  const syncDraft=useRef<() => void>(()=>{});
  const ownership=useInspectionDraftOwnership('adenda:'+draftKey,enabled&&!!id&&!!currentUser,()=>syncDraft.current());
  const draft=useRecoverableForm(draftKey,emptyDraft(),validDraft,{retainExpired:()=>true,rejectUnreadable:true,canWrite:ownership.canWrite});
  syncDraft.current=draft.synchronize;
  const readSubmission=()=>{try{return {pending:readAddendumSubmission(draftKey),error:false};}catch{return {pending:null,error:true};}};
  const [submission,setSubmission]=useState(readSubmission);
  useEffect(()=>{
    const refresh=()=>setSubmission(readSubmission());
    const storage=(event:StorageEvent)=>{if(event.key===addendumSubmissionKey(draftKey))refresh();};
    window.addEventListener('storage',storage);window.addEventListener('focus',refresh);
    return()=>{window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);};
  },[draftKey]);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const sameSession=()=>alive.current&&supportRequestContext()===session;
  const isCurrent=()=>sameSession()&&ownership.canWrite();
  let legacy: AddendumCommand|null=null,legacyError=false;
  try{legacy=legacyAddendumCommand(draft.value.pending,endpoint);}catch{legacyError=true;}
  const command=submission.pending?.command||legacy;
  const identityConflict=!!(submission.pending&&legacy&&submission.pending.command.id===legacy.id
    && JSON.stringify(submission.pending.command)!==JSON.stringify(legacy));
  const {creating,rectificaId,wastes,motivo,notes,noteVersions}=draft.value;
  const setField=<K extends keyof AddendumDraft,>(field:K,value:React.SetStateAction<AddendumDraft[K]>)=>draft.update(previous=>({...previous,[field]:typeof value==='function'?(value as (v:AddendumDraft[K])=>AddendumDraft[K])(previous[field]):value}));
  const setCreating=(v:boolean)=>setField('creating',v),setRectificaId=(v?:string)=>setField('rectificaId',v),setWastes=(v:Waste[])=>setField('wastes',v),setMotivo=(v:string)=>setField('motivo',v),setNotes=(v:Record<string,string>)=>setField('notes',v),setNoteVersions=(v:React.SetStateAction<Record<string,number>>)=>setField('noteVersions',v);
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState('');
  const [discarding,setDiscarding]=useState(false);
  const hasFinding=creating||!!motivo||wastes.some(row=>!!row.corriente||!!row.cantidad);
  const lock = useRef(false);
  async function download(item: Adenda, version: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data: blob } = await api.get(endpoint + '/' + item.id + '/anexo', { params: { version }, responseType: 'blob' });
      if(!sameSession())return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'anexo-adenda-' + item.id + '-v' + version + '.pdf';
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if(sameSession())setError('No se pudo descargar el anexo. Tus datos y revisiones no cambiaron.');
    } finally { lock.current = false; if(sameSession())setBusy(false); }
  }
  const permits=(target: AddendumCommand, data: Data|undefined)=>!!data&&(target.kind==='create' ? data.puedeRegistrar
    : data.adendas.some(item=>item.id===target.adendaId&&item.puedeResolver));
  const finish=(sent:AddendumSubmission)=>{
    const c=sent.command;
    const savedDraft=draft.update(current=>{
      // An older version may have written a different pending command. Never
      // erase it or its editable fields while acknowledging this one.
      if(current.pending&&current.pending.id!==c.id)return current;
      const next={...current,notes:{...current.notes},noteVersions:{...current.noteVersions}};
      if(next.pending?.id===c.id)delete next.pending;
      if(c.kind==='create'&&current.motivo.trim()===c.body.motivo.trim()
        &&JSON.stringify(current.wastes)===JSON.stringify(c.body.residuos)
        &&(current.rectificaId||null)===(c.body.rectificaId||null)){
        next.creating=false;next.rectificaId=undefined;next.motivo='';next.wastes=[emptyWaste()];
      }
      if(c.kind==='review'&&current.notes[c.adendaId]?.trim()===c.body.nota.trim()
        &&(current.noteVersions[c.adendaId]===undefined||current.noteVersions[c.adendaId]===c.body.version)){
        delete next.notes[c.adendaId];delete next.noteVersions[c.adendaId];
      }
      return next;
    });
    let cleaned=savedDraft.saved&&!savedDraft.conflict;
    if(cleaned){try{clearAddendumSubmission(draftKey,sent);}catch{cleaned=false;}}
    setSubmission(readSubmission());
    setSaved(cleaned?'La acción quedó registrada. El manifiesto conserva su declaración y su estado operativo.'
      :'La acción se registró, pero no pudimos actualizar la copia local. Conservá este dispositivo y comprobá el envío.');
    if(!cleaned)setError('Revisá el almacenamiento o las versiones del borrador antes de continuar.');
    void Promise.all([key,['training-tasks'],['manifest-certificates'],['notificaciones']].map(queryKey=>qc.invalidateQueries({queryKey})))
      .catch(()=>{if(sameSession())setError('La acción se registró, pero no pudimos actualizar las revisiones. Reintentá la carga.');});
  };
  async function send(path: string, body: Record<string, unknown>, checking=false) {
    if(lock.current||!isCurrent()||draft.conflict||submission.error||legacyError||identityConflict)return;
    if(!checking&&(query.isError||draft.error||command))return;
    lock.current=true;setBusy(true);setError('');setSaved('');
    let sent:AddendumSubmission|null=null,firstDispatch=false;
    try{
      sent=readAddendumSubmission(draftKey);
      const old=legacyAddendumCommand(draft.value.pending,endpoint);
      if(sent&&old&&sent.command.id===old.id&&JSON.stringify(sent.command)!==JSON.stringify(old))throw Error('La referencia guardada no coincide. Conservá este dispositivo y consultá a soporte.');
      if(!sent&&old){sent={command:old,phase:'dispatched'};writeAddendumSubmission(draftKey,sent);}
      if(!sent&&!checking){
        const candidate=legacyAddendumCommand({id:crypto.randomUUID(),signature:JSON.stringify({path,body})},endpoint);
        if(!candidate||!validAddendumCommand(candidate))throw Error('Revisá los datos de la adenda antes de enviar.');
        if(!permits(candidate,query.data))throw Error('Esta acción ya no está disponible. Actualizá las revisiones; tu borrador se conserva.');
        sent={command:candidate,phase:'prepared'};writeAddendumSubmission(draftKey,sent);
      }
      if(!sent){setError('No encontramos la referencia del envío. Conservá este dispositivo y consultá a soporte.');return;}
      setSubmission({pending:sent,error:false});
      if(!checking&&sent.phase==='dispatched'){
        setError('Hay un envío sin confirmar. Comprobalo antes de registrar otra acción.');return;
      }
      if(checking&&sent.phase==='dispatched'){
        const selectedId=sent.command.kind==='create'?sent.command.id:sent.command.adendaId;
        const current=(await api.get(endpoint,{params:{adenda:selectedId}})).data.data as Data;
        if(!isCurrent())return;
        if(!current||!Array.isArray(current.adendas))throw Error('No pudimos comprobar el envío. Conservá este dispositivo y reintentá.');
        const found=current.adendas.find(item=>item.id===selectedId);
        if(found&&addendumCommandConfirmed(sent.command,found,currentUser!.id,impersonator)){finish(sent);return;}
        if(found&&(sent.command.kind==='create'||found.revisiones.some(review=>review.id===sent!.command.id)))
          throw Error('La referencia encontrada tiene otros datos. Conservá este dispositivo y consultá a soporte.');
        if(!permits(sent.command,current))throw Error('No pudimos confirmar este envío con la autorización actual. Conservá el dispositivo y consultá a soporte.');
      }
      if(sent.phase==='prepared'){
        let different=false;
        const reference={id:sent.command.id,signature:legacyAddendumSignature(endpoint,sent.command)};
        const result=draft.update(current=>{
          if(current.pending&&current.pending.id!==reference.id){different=true;return current;}
          return {...current,pending:reference};
        });
        if(different||!result.saved||result.conflict){setError('Todavía no se envió. Revisá el borrador y su almacenamiento antes de continuar.');return;}
        sent=dispatchAddendumSubmission(draftKey,sent);setSubmission({pending:sent,error:false});firstDispatch=true;
      }
      await api.post(addendumCommandPath(endpoint,sent.command),{...sent.command.body,id:sent.command.id});
      if(!isCurrent())return;
      finish(sent);
    }catch(cause:unknown){
      if(!isCurrent())return;
      const failure=cause as {message?:string;response?:{status?:number;data?:{message?:string}}};
      // Only the first, definitive rejection can release this reference. A
      // rejection during a retry cannot disprove an earlier successful write.
      if(firstDispatch&&sent&&[400,409,422].includes(failure.response?.status||0)){
        const discarded=draft.update(current=>{
          const next={...current};if(next.pending?.id===sent?.command.id)delete next.pending;return next;
        });
        if(discarded.saved&&!discarded.conflict){try{clearAddendumSubmission(draftKey,sent);}catch{/* Keep the ledger for review. */}}
      }
      setSubmission(readSubmission());
      const local=failure.message&&/^(La referencia|No encontramos|Revisá los datos|Esta acción|No pudimos)/.test(failure.message)?failure.message:'';
      setError(failure.response?.data?.message||local||(sent?.phase==='prepared'
        ? 'No pudimos guardar la referencia en este dispositivo. Todavía no se envió; conservá el borrador y revisá el almacenamiento.'
        : 'No se pudo confirmar. Conservá este dispositivo y comprobá el envío.'));
    }finally{lock.current=false;if(sameSession())setBusy(false);}
  }
  if (!enabled) return <p>Adendas no habilitadas.</p>;
  const data = query.data;
  const blocked = ownership.status!=='owned'||busy||draft.conflict||draft.error||query.isError||submission.error||legacyError||identityConflict||!!command;
  return <section className="mx-auto w-full max-w-[960px] space-y-4" aria-label="Adendas del manifiesto">
    <Link to={mp(`/manifiestos/${id}`)} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><ArrowLeft size={18} aria-hidden="true"/>Volver al manifiesto</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Manifiesto {data?.manifiesto.numero || ''}</h2>
      {data?.puedeRegistrar && !creating && <Button disabled={blocked} onClick={() => { if(hasFinding){setCreating(true);return;} setRectificaId(undefined); setMotivo(''); setCreating(true); setSaved(''); setWastes(data.manifiesto.residuos?.map(row => ({ ...row })) || [emptyWaste()]); }}>{hasFinding?'Retomar informe':data.puedeInformarHallazgo ? 'Informar hallazgo' : 'Registrar diferencia'}</Button>}
    </div>
    {(data?.puedeRegistrar||data?.adendas.some(item=>item.puedeResolver)||command)&&ownership.status!=='owned'&&
      (ownership.status==='checking'?<p role="status" className="text-sm text-neutral-600">Preparando la edición segura…</p>
        :<div role="alert" className="space-y-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-900">
          <p>{ownership.status==='blocked'?'Este borrador está abierto en otra pestaña. Cerrala y volvé a comprobar para editar aquí.'
            :'Este navegador no permite proteger la edición entre pestañas. Abrí SITREP en un navegador compatible para continuar.'}</p>
          {ownership.status==='unavailable'&&<p>Las copias no se trasladan automáticamente. Si hay un envío sin confirmar, conservá este dispositivo y consultá a soporte antes de repetirlo.</p>}
          <Button type="button" variant="outline" onClick={ownership.retry}>Volver a comprobar</Button>
        </div>)}
    {draft.conflict&&<DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={()=>draft.overwrite()}
      canReload={ownership.status==='owned'&&(!draft.value.pending||submission.pending?.command.id===draft.value.pending.id)}
      canKeep={ownership.status==='owned'&&!legacyError&&!identityConflict&&mayKeepDraft(draftKey,draft.value.pending?.id,submission.pending?.command.id)} />}
    {selected && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>Adenda del aviso</span><Button variant="outline" onClick={() => { setPage(1); setParams({}); }}>Ver todas las adendas</Button></div>}
    {data && <p className="text-sm text-neutral-600">Operación: {formatEstado(data.manifiesto.estado)}</p>}
    {data?.finalLiberado && <p role="status" className="rounded border border-neutral-200 p-3">El operador ya liberó la disposición final{currentUser?.training ? ' CAP' : ''}. Se conservan el certificado y las adendas revisadas; este expediente queda en consulta.</p>}
    {data?.documental && data.total > 0 && <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm" role="region" aria-label="Control documental">
      <ClipboardCheck size={20} className="shrink-0 text-primary-700" aria-hidden="true" />
      <div className="space-y-1">
        {data.documental.estado !== 'ADENDAS_REVISADAS' && <p className="font-semibold">{[
          data.documental.pendientes ? `${data.documental.pendientes} ${data.documental.pendientes === 1 ? 'pendiente' : 'pendientes'}` : '',
          data.documental.observadas ? `${data.documental.observadas} ${data.documental.observadas === 1 ? 'observada' : 'observadas'}` : '',
          data.documental.rechazadas ? `${data.documental.rechazadas} ${data.documental.rechazadas === 1 ? 'rechazada' : 'rechazadas'}` : '',
        ].filter(Boolean).join(' · ')}</p>}
        <p className="text-neutral-600">{data.documental.estado === 'ADENDAS_REVISADAS' ? 'Adendas revisadas. No acredita el cierre documental del expediente.' : 'Hay revisiones por atender. El cierre operativo no las aprueba.'}</p>
      </div>
    </div>}
    <details className="text-sm text-neutral-600"><summary className="min-h-11 cursor-pointer py-3 font-medium text-primary-800 focus-visible:ring-2 focus-visible:ring-primary-700">Cómo se revisa una adenda</summary><p className="pb-3">La revisión de adendas no detiene el circuito operativo. Cada revisión expresa la decisión de su autor. La última revisión indica el estado actual; no representa unanimidad ni cierre documental.</p></details>
    {query.isPending && <p role="status">Cargando adendas…</p>}
    {query.isError && <p role="alert">No se pudieron cargar las adendas. <Button variant="outline" onClick={() => void query.refetch()}>Reintentar carga</Button></p>}
    {error && <p role="alert" className="text-error-700">{error} <Button variant="outline" onClick={() => void query.refetch()}>Actualizar revisiones</Button></p>}
    {saved && <p role="status">{saved}</p>}
    {(submission.error||legacyError||identityConflict)&&<div role="alert" className="space-y-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-900">
      <p>No pudimos leer la referencia de una acción anterior. Conservá este dispositivo y consultá a soporte antes de enviar otra.</p>
      {submission.error&&!legacyError&&!identityConflict&&<Button type="button" variant="outline" onClick={()=>setSubmission(readSubmission())}>Reintentar lectura</Button>}
    </div>}
    {command&&!submission.error&&!legacyError&&!identityConflict&&<div role="status" className="space-y-2 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
      <p>{submission.pending?.phase==='prepared'?'La acción está preparada y todavía no se envió.':'La acción podría haberse registrado. Comprobá el mismo envío antes de continuar.'}</p>
      <p>{command.kind==='create'?'Informe de adenda':`Decisión: ${labels[command.body.decision]}`} · {command.kind==='create'?command.body.motivo:command.body.nota}</p>
      <Button type="button" disabled={ownership.status!=='owned'||busy||draft.conflict} onClick={()=>void send('',{},true)}>Comprobar envío</Button>
    </div>}
    {!command&&draft.saved&&(hasFinding||Object.keys(notes).length>0)&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600"><p role="status">{draft.restored?'Borrador recuperado':'Borrador guardado'} en este dispositivo · todavía no enviado.</p>{!discarding?<button type="button" disabled={blocked} className="min-h-11 underline underline-offset-2 disabled:opacity-50" onClick={()=>setDiscarding(true)}>Descartar borrador</button>:<div className="flex flex-wrap items-center gap-2"><span>¿Descartar lo no enviado?</span><Button variant="outline" onClick={()=>setDiscarding(false)}>Conservar</Button><Button variant="outline" disabled={blocked} onClick={()=>{if(draft.clear())setDiscarding(false);}}>Sí, descartar</Button></div>}</div>}
    {draft.error&&<p role="alert" className="text-sm text-error-800">No se pudo guardar el borrador en este dispositivo. Conservá esta pantalla abierta.</p>}
    {creating && <Card className="p-4"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void send(endpoint, { motivo, residuos: wastes, ...(rectificaId ? { rectificaId } : {}) }); }}>
      {data&&!data.puedeRegistrar&&<p role="status" className="text-sm text-neutral-700">Se conserva tu borrador, pero el expediente ya no permite registrar una adenda.</p>}
      <h2 className="flex items-center gap-2 font-semibold"><FileSearch size={20} className="text-primary-700" aria-hidden="true" />{rectificaId ? 'Rectificar mediante una nueva adenda' : data?.puedeInformarHallazgo ? 'Informe de hallazgo dentro de la adenda' : 'Carga observada completa'}</h2>
      {data?.puedeInformarHallazgo && <p className="text-sm text-neutral-700">Ajustá las cantidades a lo recibido y agregá las Y encontradas. Conservá toda la carga observada. El informe queda en esta adenda y las diferencias pasan a evaluación en PSIP.</p>}
      <p className="text-sm text-neutral-600">No se suma automáticamente a lo declarado. Compatibilidad de corrientes pendiente de verificar.</p>
      <fieldset disabled={ownership.status!=='owned'||busy||draft.conflict||!!command||submission.error||legacyError||identityConflict} className="space-y-4 min-w-0">
      {wastes.map((row, i) => <fieldset key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-0"><legend className="sr-only">Residuo {i + 1}</legend>
        <Input label={`Corriente observada ${i + 1}`} type="text" inputMode="text" autoCapitalize="characters" autoCorrect="off" helperText="Letra Y y número: Y1, Y21…" title="Ingresá la letra Y seguida del número, por ejemplo Y21" required pattern="Y[0-9]{1,3}" maxLength={4} placeholder="Y1" value={row.corriente} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, corriente: e.target.value.toUpperCase() } : v))} />
        <Input label={`Cantidad observada ${i + 1}`} required type="number" inputMode="decimal" min="0.001" max="1000000000000" step="any" value={row.cantidad || ''} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, cantidad: Number(e.target.value) } : v))} />
        <label className="text-sm font-medium">Unidad observada {i + 1}<select required className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base" value={observedUnits.includes(row.unidad) ? row.unidad : ''} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, unidad: e.target.value } : v))}>
          {!observedUnits.includes(row.unidad) && <option value="" disabled>Revisar unidad declarada: {row.unidad || 'sin informar'}</option>}
          {observedUnits.map(unit => <option key={unit}>{unit}</option>)}
        </select></label>
        {wastes.length > 1 && <Button type="button" variant="ghost" onClick={() => setWastes(wastes.filter((_, n) => n !== i))}>Quitar residuo {i + 1}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={wastes.length >= 50 || busy} onClick={() => setWastes([...wastes, emptyWaste()])}>Agregar corriente</Button>
      <Input label="Motivo de la adenda" type="text" inputMode="text" required maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={blocked||!data?.puedeRegistrar}>Guardar y solicitar revisión</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cerrar formulario</Button></div>
      </fieldset>
    </form></Card>}
    {currentUser?.training && <p className="text-sm text-neutral-600">Capacitación: sin anexos ni documentos oficiales.</p>}
    {data && <>
      {data.total === 0 && !creating && <p>{selected ? 'La adenda del aviso ya no está disponible o no corresponde a este manifiesto.' : 'Todavía no hay adendas.'}</p>}
      {data.adendas.map((item, i) => <Card key={item.id} className="p-4 space-y-3" role="region" aria-label={`Adenda ${item.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{selected ? 'Adenda del aviso' : `Adenda ${data.total - (page - 1) * 20 - i}`}</h2><span role="status" aria-label="Estado de revisión">{labels[item.estadoRevision]}</span></div>
        <p className="flex items-center gap-2 text-sm text-neutral-600"><UserRound size={16} className="shrink-0" aria-hidden="true" />{authorLabel(item.autor, item.creadoPorId)}</p>
        <p className="break-words">{item.motivo}</p>
        {item.relacionRectificacionInvalida && <p role="alert" className="text-sm text-error-800">No se pudo verificar la relación con la adenda anterior. Consultá a Administración antes de emitir la certificación final.</p>}
        {item.revisiones.length > 0 && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm" aria-label="Última revisión">
          <p className="font-semibold">{authorLabel(item.revisiones.at(-1)?.autor, item.revisiones.at(-1)!.autorId)}</p>
          <p>{item.revisiones.at(-1)!.nota}</p>
        </div>}
        <p className="text-sm font-medium text-primary-800">{reviewGuidance(item, currentUser?.id, data.puedeRegistrar)}</p>
        <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="font-medium">Declaración conservada</h3><Load rows={item.declaracion.residuos} /></div><div><h3 className="font-medium">Carga observada</h3><Load rows={item.residuos} /></div></div>
        {item.informeHallazgo && <OperatorFindingSummary finding={item.informeHallazgo} />}
        {item.rectificaId && <p className="text-sm break-all">Rectifica adenda {item.rectificaId}; el antecedente se conserva.</p>}
        <p className="text-sm text-amber-800">Compatibilidad de corrientes sin verificar. Registrar no implica habilitación.</p>
        <Button variant="outline" disabled={busy || currentUser?.training} onClick={() => void download(item, item.version)}>Descargar anexo v{item.version}</Button>
        {item.puedeResolver && <div className="space-y-2"><Input id={`resolucion-${item.id}`} label="Motivo de resolución" maxLength={500} disabled={blocked} value={notes[item.id] || ''} onChange={e => { setNotes({ ...notes, [item.id]: e.target.value }); setNoteVersions(previous => ({ ...previous, [item.id]: previous[item.id] ?? item.version })); }} />
          {noteVersions[item.id] !== undefined && noteVersions[item.id] !== item.version && <div role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Hay una revisión nueva. Leela antes de reenviar; conservamos tu motivo. <Button variant="outline" disabled={blocked} onClick={() => { setNoteVersions(previous => ({ ...previous, [item.id]: item.version })); setError(''); }}>Usar revisión actual</Button></div>}
          <div className="flex flex-wrap gap-2">{[['APROBADA', 'Aprobar post facto'], ['OBSERVADA', 'Observar'], ['RECHAZADA', 'Rechazar conformidad']].map(([decision, label]) => <Button key={decision} variant="outline" disabled={blocked || !notes[item.id]?.trim() || (noteVersions[item.id] !== undefined && noteVersions[item.id] !== item.version)} onClick={() => void send(endpoint + '/' + item.id + '/revisiones', { version: noteVersions[item.id] ?? item.version, decision, nota: notes[item.id] })}>{label}</Button>)}</div>
        </div>}
        {data.puedeRegistrar && <Button variant="outline" disabled={blocked} onClick={() => { setRectificaId(item.id); setWastes(item.residuos.map(r => ({ ...r }))); setMotivo(''); setCreating(true); setSaved(''); }}>Agregar rectificación</Button>}
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm focus-visible:ring-2 focus-visible:ring-primary-700">Trazabilidad de la adenda</summary><p className="text-sm break-all">{item.id} · {item.createdAt} · {item.creadoPorId}</p>
          {item.version > 0 && <div className="flex flex-wrap gap-2" aria-label="Versiones anteriores">
            <Input label="Versión anterior" type="number" inputMode="numeric" min={0} max={item.version - 1} step={1} value={versions[item.id] ?? 0} onChange={e => setVersions({ ...versions, [item.id]: Number(e.target.value) })} />
            <Button variant="outline" disabled={busy || currentUser?.training || !Number.isSafeInteger(versions[item.id] ?? 0) || (versions[item.id] ?? 0) < 0 || (versions[item.id] ?? 0) >= item.version} onClick={() => void download(item, versions[item.id] ?? 0)}>Descargar versión anterior</Button>
          </div>}
          <ul className="space-y-2">{item.revisiones.map(r => <li key={r.id} className="text-sm break-words">{labels[r.decision]} · {r.nota}<span className="block text-neutral-600 break-all">{r.fecha} · {authorLabel(r.autor, r.autorId)}</span></li>)}</ul>
        </details>
      </Card>)}
      {data.total > 20 && <nav aria-label="Páginas de adendas" className="flex items-center gap-3"><Button variant="outline" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Anterior</Button><span>{page} / {Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={page * 20 >= data.total || busy} onClick={() => setPage(page + 1)}>Siguiente</Button></nav>}
    </>}
  </section>;
}

import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import React, { useRef, useState } from 'react';
import { ArrowLeft, FileSearch, ClipboardCheck, UserRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
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
import { manifestDraftScope } from '../../hooks/useManifestDraft';
import { formatEstado } from '../../utils/formatters';

type Waste = { corriente: string; cantidad: number; unidad: string };
type Author = { nombre: string; rol: string };
const roleLabels: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador', ADMIN: 'Administración',
  ADMIN_GENERADOR: 'Administración de Generadores', ADMIN_OPERADOR: 'Administración de Operadores', ADMIN_TRANSPORTISTA: 'Administración de Transporte' };
const authorLabel = (author: Author | null | undefined, id: string) => author ? `${roleLabels[author.rol] || author.rol} · ${author.nombre}` : `Cuenta ${id}`;
type Adenda = { id: string; motivo: string; rectificaId: string | null; version: number; estadoRevision: string; puedeResolver: boolean;
  informeHallazgo?: OperatorFinding | null; autor?: Author | null;
  creadoPorId: string; createdAt: string; residuos: Waste[]; declaracion: { numero: string; residuos: Waste[] };
  revisiones: { autor?: Author | null; id: string; autorId: string; fecha: string; decision: string; nota: string }[] };
type Data = { finalLiberado?: boolean; puedeInformarHallazgo?: boolean; adendas: Adenda[]; total: number; puedeRegistrar: boolean; manifiesto: { numero: string; estado: EstadoManifiesto; residuos?: Waste[] };
  documental?: { pendientes: number; observadas: number; rechazadas: number; estado: string; cierreAcreditado: boolean } };
const labels: Record<string, string> = { PENDIENTE: 'Pendiente de revisión', APROBADA: 'Aprobada post facto', OBSERVADA: 'Observada', RECHAZADA: 'Conformidad rechazada' };
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
export default function AdendasManifiestoPage() {
 const { id }=useParams();const {currentUser}=useAuth();
 const scope=manifestDraftScope(currentUser)+':'+id;
 return <AddendumContext key={scope} scope={scope}/>;
}
function AddendumContext({scope}:{scope:string}) {
  const { id } = useParams(); const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const enabled = manifestFeatureVisible(import.meta.env.VITE_MANIFEST_ADDENDA_ENABLED, currentUser);
  const [params, setParams] = useSearchParams();
  const selected = params.get('adenda');
  const [page, setPage] = useState(1); const qc = useQueryClient();
  const key = ['manifiesto-adendas', scope];
  const endpoint = `/manifiestos/${encodeURIComponent(id || '')}/adendas`;
  const query = useQuery({ queryKey: [...key, page, selected], enabled: enabled && !!id && !!currentUser,
    queryFn: async () => (await api.get(endpoint, { params: { page, ...(selected ? { adenda: selected } : {}) } })).data.data as Data, retry: false, refetchInterval: 5000 });
  const draft=useRecoverableForm('sitrep:adenda-form:v1:'+scope,emptyDraft(),validDraft);
  const {creating,rectificaId,wastes,motivo,notes,noteVersions}=draft.value;
  const setField=<K extends keyof AddendumDraft,>(field:K,value:React.SetStateAction<AddendumDraft[K]>)=>draft.update(previous=>({...previous,[field]:typeof value==='function'?(value as (v:AddendumDraft[K])=>AddendumDraft[K])(previous[field]):value}));
  const setCreating=(v:boolean)=>setField('creating',v),setRectificaId=(v?:string)=>setField('rectificaId',v),setWastes=(v:Waste[])=>setField('wastes',v),setMotivo=(v:string)=>setField('motivo',v),setNotes=(v:Record<string,string>)=>setField('notes',v),setNoteVersions=(v:React.SetStateAction<Record<string,number>>)=>setField('noteVersions',v);
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState('');
  const [discarding,setDiscarding]=useState(false);
  const hasFinding=creating||!!motivo||wastes.some(row=>!!row.corriente||!!row.cantidad);
  const lock = useRef(false); const pending = useRef(draft.value.pending);
  async function download(item: Adenda, version: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data: blob } = await api.get(endpoint + '/' + item.id + '/anexo', { params: { version }, responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'anexo-adenda-' + item.id + '-v' + version + '.pdf';
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('No se pudo descargar el anexo. Tus datos y revisiones no cambiaron.');
    } finally { lock.current = false; setBusy(false); }
  }
  async function send(path: string, body: Record<string, unknown>) {
    if (lock.current || draft.conflict || query.isError) return;
    const allowed = path === endpoint ? query.data?.puedeRegistrar : query.data?.adendas.some(item => item.puedeResolver && path === endpoint+'/'+item.id+'/revisiones');
    if(!allowed){setError('Esta acción ya no está disponible. Actualizá las revisiones; tu borrador se conserva.');return;}
    lock.current = true; setBusy(true); setError(''); setSaved('');
    const signature = JSON.stringify({ path, body });
    // A deliberate conflict reload may restore a request already attempted by the other tab.
    if (draft.value.pending?.signature === signature) pending.current = draft.value.pending;
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    if(setField('pending',pending.current).conflict){lock.current=false;setBusy(false);return;}
    try {
      await api.post(path, { ...body, id: pending.current.id });
      // Refresh bounded lists, including fresh shared caches. Never mutate the manifest cache or declaration.
      await Promise.all([key,['training-tasks'],['manifest-certificates'],['notificaciones']].map(queryKey=>qc.invalidateQueries({queryKey})));
      if(!draft.clear())setError('La decisión se guardó en SITREP, pero hay otro borrador en este dispositivo. Revisá el conflicto antes de continuar.');
      setSaved('Adenda actualizada. El manifiesto conserva su declaración y su estado operativo.'); pending.current = undefined;
    } catch (cause: unknown) {
      const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'No se pudo guardar. Conservamos tus datos para reintentar.');
    } finally { lock.current = false; setBusy(false); }
  }
  if (!enabled) return <p>Adendas no habilitadas.</p>;
  const data = query.data;
  const blocked = busy || draft.conflict || query.isError;
  return <section className="mx-auto w-full max-w-[960px] space-y-4" aria-label="Adendas del manifiesto">
    <Link to={mp(`/manifiestos/${id}`)} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><ArrowLeft size={18} aria-hidden="true"/>Volver al manifiesto</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Manifiesto {data?.manifiesto.numero || ''}</h2>
      {data?.puedeRegistrar && !creating && <Button disabled={query.isError||draft.conflict} onClick={() => { if(hasFinding){setCreating(true);return;} setRectificaId(undefined); pending.current = undefined; setMotivo(''); setCreating(true); setSaved(''); setWastes(data.manifiesto.residuos?.map(row => ({ ...row })) || [emptyWaste()]); }}>{hasFinding?'Retomar informe':data.puedeInformarHallazgo ? 'Informar hallazgo' : 'Registrar diferencia'}</Button>}
    </div>
    {draft.conflict&&<DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={()=>{draft.reload();pending.current=undefined;}} onKeep={()=>draft.overwrite()} />}
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
    {draft.saved&&(hasFinding||Object.keys(notes).length>0)&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600"><p role="status">{draft.restored?'Borrador recuperado':'Borrador guardado'} en este dispositivo · todavía no enviado.</p>{!discarding?<button type="button" className="min-h-11 underline underline-offset-2" onClick={()=>setDiscarding(true)}>Descartar borrador</button>:<div className="flex flex-wrap items-center gap-2"><span>¿Descartar lo no enviado?</span><Button variant="outline" onClick={()=>setDiscarding(false)}>Conservar</Button><Button variant="outline" onClick={()=>{if(draft.clear()){pending.current=undefined;setDiscarding(false);}}}>Sí, descartar</Button></div>}</div>}
    {draft.error&&<p role="alert" className="text-sm text-error-800">No se pudo guardar el borrador en este dispositivo. Conservá esta pantalla abierta.</p>}
    {creating && <Card className="p-4"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void send(endpoint, { motivo, residuos: wastes, ...(rectificaId ? { rectificaId } : {}) }); }}>
      {data&&!data.puedeRegistrar&&<p role="status" className="text-sm text-neutral-700">Se conserva tu borrador, pero el expediente ya no permite registrar una adenda.</p>}
      <h2 className="flex items-center gap-2 font-semibold"><FileSearch size={20} className="text-primary-700" aria-hidden="true" />{rectificaId ? 'Rectificar mediante una nueva adenda' : data?.puedeInformarHallazgo ? 'Informe de hallazgo dentro de la adenda' : 'Carga observada completa'}</h2>
      {data?.puedeInformarHallazgo && <p className="text-sm text-neutral-700">Ajustá las cantidades a lo recibido y agregá las Y encontradas. Conservá toda la carga observada. El informe queda en esta adenda y las diferencias pasan a evaluación en PSIP.</p>}
      <p className="text-sm text-neutral-600">No se suma automáticamente a lo declarado. Compatibilidad de corrientes pendiente de verificar.</p>
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
    </form></Card>}
    {currentUser?.training && <p className="text-sm text-neutral-600">Capacitación: sin anexos ni documentos oficiales.</p>}
    {data && <>
      {data.total === 0 && !creating && <p>{selected ? 'La adenda del aviso ya no está disponible o no corresponde a este manifiesto.' : 'Todavía no hay adendas.'}</p>}
      {data.adendas.map((item, i) => <Card key={item.id} className="p-4 space-y-3" role="region" aria-label={`Adenda ${item.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{selected ? 'Adenda del aviso' : `Adenda ${data.total - (page - 1) * 20 - i}`}</h2><span role="status" aria-label="Estado de revisión">{labels[item.estadoRevision]}</span></div>
        <p className="flex items-center gap-2 text-sm text-neutral-600"><UserRound size={16} className="shrink-0" aria-hidden="true" />{authorLabel(item.autor, item.creadoPorId)}</p>
        <p className="break-words">{item.motivo}</p>
        {item.revisiones.length > 0 && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm" aria-label="Última revisión">
          <p className="font-semibold">{authorLabel(item.revisiones.at(-1)?.autor, item.revisiones.at(-1)!.autorId)}</p>
          <p>{item.revisiones.at(-1)!.nota}</p>
        </div>}
        <p className="text-sm font-medium text-primary-800">{item.puedeResolver ? 'Podés revisar la evidencia y registrar tu decisión.' : item.creadoPorId === currentUser?.id && data.puedeRegistrar ? 'Informe registrado. Las otras partes pueden revisarlo; vos podés agregar una rectificación.' : 'Consultá las decisiones y el anexo conservado.'}</p>
        <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="font-medium">Declaración conservada</h3><Load rows={item.declaracion.residuos} /></div><div><h3 className="font-medium">Carga observada</h3><Load rows={item.residuos} /></div></div>
        {item.informeHallazgo && <OperatorFindingSummary finding={item.informeHallazgo} />}
        {item.rectificaId && <p className="text-sm break-all">Rectifica adenda {item.rectificaId}; el antecedente se conserva.</p>}
        <p className="text-sm text-amber-800">Compatibilidad de corrientes sin verificar. Registrar no implica habilitación.</p>
        <Button variant="outline" disabled={busy || currentUser?.training} onClick={() => void download(item, item.version)}>Descargar anexo v{item.version}</Button>
        {item.puedeResolver && <div className="space-y-2"><Input id={`resolucion-${item.id}`} label="Motivo de resolución" maxLength={500} value={notes[item.id] || ''} onChange={e => { setNotes({ ...notes, [item.id]: e.target.value }); setNoteVersions(previous => ({ ...previous, [item.id]: previous[item.id] ?? item.version })); }} />
          {noteVersions[item.id] !== undefined && noteVersions[item.id] !== item.version && <div role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Hay una revisión nueva. Leela antes de reenviar; conservamos tu motivo. <Button variant="outline" disabled={busy} onClick={() => { setNoteVersions(previous => ({ ...previous, [item.id]: item.version })); setError(''); }}>Usar revisión actual</Button></div>}
          <div className="flex flex-wrap gap-2">{[['APROBADA', 'Aprobar post facto'], ['OBSERVADA', 'Observar'], ['RECHAZADA', 'Rechazar conformidad']].map(([decision, label]) => <Button key={decision} variant="outline" disabled={blocked || !notes[item.id]?.trim() || (noteVersions[item.id] !== undefined && noteVersions[item.id] !== item.version)} onClick={() => void send(endpoint + '/' + item.id + '/revisiones', { version: noteVersions[item.id] ?? item.version, decision, nota: notes[item.id] })}>{label}</Button>)}</div>
        </div>}
        {data.puedeRegistrar && <Button variant="outline" disabled={busy} onClick={() => { setRectificaId(item.id); setWastes(item.residuos.map(r => ({ ...r }))); setMotivo(''); setCreating(true); setSaved(''); }}>Agregar rectificación</Button>}
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

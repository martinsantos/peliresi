import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Camera, Check, CircleMinus, ClipboardCheck, CloudOff, Download, FileAudio, FileText, Loader2, MapPin, Mic, Paperclip, Save, Send, ShieldCheck, Square, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInspection, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import type { InspectionComparison, InspectionItem, InspectionItemResult, InspectionState } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';
import { InspectionComparisonPanel } from './InspectionComparisonPanel';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { InspectionReport } from './InspectionReport';
import { InspectionTimeline } from './InspectionTimeline';
import { inspectionActorRoute, inspectionDate } from './inspectionPresentation';

const LABELS: Record<InspectionState, string> = { BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión', NOTIFICADA: 'Notificada', EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación', CERRADA_CONFORME: 'Cerrada conforme', DERIVADA_LEGALES: 'Derivada a legales', EN_TRAMITE_LEGAL: 'En trámite legal', DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
const COLORS: Partial<Record<InspectionState, BadgeColor>> = { BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning', NOTIFICADA: 'info', EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error', CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error', EN_TRAMITE_LEGAL: 'warning', DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral' };
const RESULTS: Array<{ value: InspectionItemResult; label: string; icon: React.ReactNode; active: string }> = [
  { value: 'CUMPLE', label: 'Cumple', icon: <Check size={16} />, active: 'border-success-600 bg-success-50 text-success-800' },
  { value: 'NO_CUMPLE', label: 'No cumple', icon: <XCircle size={16} />, active: 'border-error-600 bg-error-50 text-error-800' },
  { value: 'NO_APLICA', label: 'No aplica', icon: <CircleMinus size={16} />, active: 'border-neutral-500 bg-neutral-100 text-neutral-800' },
];
type Draft = { version: number; observaciones: string; numeroActa: string; ubicacion: string; plazoRespuestaAt: string; items: InspectionItem[]; comparaciones: InspectionComparison[] };
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';

const InspeccionExpedientePage: React.FC = () => {
  const { id = '' } = useParams(); const navigate = useNavigate(); const location = useLocation(); const mobile = location.pathname.startsWith('/mobile'); const hasMobileNav = mobile || window.location.pathname.startsWith('/app/'); const { currentUser } = useAuth();
  const query = useInspection(id); const inspection = query.data;
  const [items, setItems] = useState<InspectionItem[]>([]); const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [observaciones, setObservaciones] = useState(''); const [numeroActa, setNumeroActa] = useState(''); const [ubicacion, setUbicacion] = useState(''); const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine); const [recording, setRecording] = useState(false); const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const fileRef = useRef<HTMLInputElement | null>(null); const cameraRef = useRef<HTMLInputElement | null>(null);
  const draftKey = currentUser?.id && id ? `sitrep_inspection_draft_${currentUser.id}_${id}` : '';

  useEffect(() => { const on = () => setIsOnline(true); const off = () => setIsOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => {
    if (!inspection) return;
    const draft: Draft = { version: inspection.version, observaciones: inspection.observaciones || '', numeroActa: inspection.numeroActa || '', ubicacion: inspection.ubicacion || '', plazoRespuestaAt: localDate(inspection.plazoRespuestaAt), items: inspection.items, comparaciones: inspection.comparaciones || [] };
    if (draftKey) try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
      if (saved?.version === inspection.version) {
        const serverComparisonIds = new Set(draft.comparaciones.map((row) => row.id));
        const savedComparisonsAreCurrent = saved.comparaciones.length === draft.comparaciones.length
          && saved.comparaciones.every((row) => serverComparisonIds.has(row.id));
        Object.assign(draft, saved, { comparaciones: savedComparisonsAreCurrent ? saved.comparaciones : draft.comparaciones });
      }
    } catch { /* ignore */ }
    setItems(draft.items); setComparisons(draft.comparaciones); setObservaciones(draft.observaciones); setNumeroActa(draft.numeroActa); setUbicacion(draft.ubicacion); setPlazoRespuestaAt(draft.plazoRespuestaAt);
  }, [inspection?.id, inspection?.version, draftKey]);
  useEffect(() => { if (!draftKey || !inspection || !items.length) return; const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify({ version: inspection.version, observaciones, numeroActa, ubicacion, plazoRespuestaAt, items, comparaciones: comparisons } satisfies Draft)), 350); return () => window.clearTimeout(timer); }, [draftKey, inspection?.version, observaciones, numeroActa, ubicacion, plazoRespuestaAt, items, comparisons]);

  const saveMutation = useInspectionMutation(async () => { if (!inspection) return; const meta = await inspeccionService.update(id, { version: inspection.version, observaciones: observaciones || null, numeroActa: numeroActa || null, ubicacion: ubicacion || null, plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : null }); const checked = await inspeccionService.updateItems(id, meta.version, items.map((item) => ({ id: item.id, resultado: item.resultado, observacion: item.observacion || null }))); return inspeccionService.updateComparisons(id, checked.version, comparisons.map((row) => ({ id: row.id, resultado: row.resultado, valorObservado: row.valorObservado || null, observacion: row.observacion || null }))); }, id);
  const transitionMutation = useInspectionMutation(async (next: InspectionState) => inspection && inspeccionService.transition(id, inspection.version, next, { plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : undefined }), id);
  const uploadMutation = useInspectionMutation(async ({ file, fields }: { file: File; fields?: { comparacionId?: string; eventoId?: string; itemId?: string; descripcion?: string } }) => inspeccionService.uploadEvidence(id, file, fields), id);
  const eventMutation = useInspectionMutation(async ({ input, file }: { input: Parameters<typeof inspeccionService.addEvent>[1]; file?: File }) => { const event = await inspeccionService.addEvent(id, input); if (file) await inspeccionService.uploadEvidence(id, file, { eventoId: event.id }); }, id);
  const pdfMutation = useInspectionMutation(async () => inspection && inspeccionService.downloadActPdf(id, inspection.numero), id);

  const save = async () => { if (!isOnline) return toast.info('Borrador guardado en el dispositivo', 'Se sincronizará cuando vuelva la conexión.'); try { await saveMutation.mutateAsync(undefined); if (draftKey) localStorage.removeItem(draftKey); toast.success('Inspección guardada', 'Comparación, checklist y observaciones quedaron sincronizados.'); } catch (error: any) { toast.error('No se pudo guardar', error?.response?.data?.message || 'Los cambios siguen guardados en este dispositivo.'); } };
  const transition = async (next: InspectionState) => { if (!isOnline) return toast.warning('Conexión requerida', 'El cierre requiere confirmación del servidor.'); try { await transitionMutation.mutateAsync(next); toast.success('Estado actualizado', next === 'NOTIFICADA' ? 'Acta aprobada; no se envió correo externo.' : LABELS[next]); } catch (error: any) { toast.error('Acción rechazada', error?.response?.data?.message || 'No se pudo cambiar el estado.'); } };
  const upload = async (file?: File, fields?: { comparacionId?: string; eventoId?: string; itemId?: string; descripcion?: string }, persistDraft = false) => {
    if (!file) return;
    if (!isOnline) return toast.warning('Carga pendiente', 'La carga requiere conexión.');
    if (fields?.itemId) setUploadingItemId(fields.itemId);
    try {
      if (persistDraft) {
        await saveMutation.mutateAsync(undefined);
        if (draftKey) localStorage.removeItem(draftKey);
      }
      await uploadMutation.mutateAsync({ file, fields });
      toast.success(fields?.itemId ? 'Foto vinculada al control' : 'Evidencia incorporada', file.name);
    } catch (error: any) {
      toast.error('Evidencia rechazada', error?.response?.data?.message || 'No se pudo cargar.');
    } finally {
      if (fields?.itemId) setUploadingItemId(null);
    }
  };
  const uploadFromInput = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(file); };
  const toggleRecording = async () => { if (recording && recorderRef.current) { recorderRef.current.stop(); setRecording(false); return; } if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast.warning('Audio no disponible', 'El navegador no permite grabar audio.'); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); chunksRef.current = []; recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data); recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }); await upload(new File([blob], `audio-inspeccion-${Date.now()}.webm`, { type: blob.type })); }; recorder.start(); recorderRef.current = recorder; setRecording(true); } catch { toast.error('Micrófono denegado', 'Habilite el permiso para incorporar audio.'); } };

  if (query.isLoading) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente…</p>;
  if (!inspection) return <Card><p className="font-semibold text-neutral-900">Inspección no encontrada</p></Card>;
  const actor = inspectionActor(inspection); const canEdit = ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado); const isAdmin = currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${inspection.tipoActor}`;
  const actorRoute = actor ? inspectionActorRoute(inspection.tipoActor, actor.id, mobile) : '';
  const completed = items.filter((item) => item.resultado !== 'PENDIENTE').length; const groups = Array.from(new Set(items.map((item) => item.categoria)));
  const primaryAction = inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA' ? { label: 'Iniciar inspección', state: 'EN_CAMPO' as InspectionState } : inspection.estado === 'EN_CAMPO' ? { label: 'Enviar a revisión', state: 'EN_REVISION' as InspectionState } : inspection.estado === 'EN_REVISION' && isAdmin ? { label: 'Aprobar acta', state: 'NOTIFICADA' as InspectionState } : null;
  const showActionBar = canEdit || (inspection.estado === 'EN_REVISION' && isAdmin) || Boolean(primaryAction);

  return <div className={`space-y-4 animate-fade-in ${showActionBar ? (hasMobileNav ? 'pb-36 sm:pb-24' : 'pb-24') : (hasMobileNav ? 'pb-20 sm:pb-0' : '')}`}>
    {!isOnline && <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"><CloudOff size={18} />Sin conexión · cambios guardados en este dispositivo</div>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button onClick={() => navigate(`${mobile ? '/mobile' : ''}/inspecciones`)} className="flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"><ArrowLeft size={18} />Volver al listado</button><div className="flex flex-wrap items-center gap-2"><Badge color={COLORS[inspection.estado] || 'neutral'} size="lg" dot>{LABELS[inspection.estado]}</Badge><Button variant="outline" size="sm" leftIcon={<Download size={16} />} isLoading={pdfMutation.isPending} onClick={() => pdfMutation.mutate(undefined)}>Exportar acta PDF</Button></div></div>
    <Card className="!p-4 sm:!p-5"><div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-primary-700">Expediente de inspección</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10213A]">{inspection.numero}</h2></div><label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:w-64">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(e) => setNumeroActa(e.target.value)} placeholder="Asignar número" className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm font-medium normal-case text-neutral-900 disabled:bg-neutral-50" /></label></div><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Meta icon={<ClipboardCheck />} label="Actor inspeccionado" value={actor?.razonSocial || ''} detail={`CUIT ${actor?.cuit || 's/d'}`} to={actor ? actorRoute : undefined} /><Meta icon={<UserRound />} label="Inspector" value={`${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`} /><div className="flex gap-3"><MapPin className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div className="min-w-0 flex-1"><p className="text-xs text-neutral-500">Ubicación</p>{canEdit ? <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" /> : <p className="font-bold text-[#10213A]">{ubicacion || 'Sin informar'}</p>}</div></div><Meta icon={<CalendarDays />} label="Inicio" value={inspectionDate(inspection.iniciadaAt, true)} /></div><div className="mt-4 border-t border-neutral-200 pt-4"><p className="text-xs leading-relaxed text-neutral-500 lg:text-right">Creada {inspectionDate(inspection.createdAt, true)} · Programada {inspectionDate(inspection.fechaProgramada, true)}<br className="hidden lg:block" /> Actualizada {inspectionDate(inspection.updatedAt, true)}{inspection.plazoRespuestaAt ? ` · Plazo ${inspectionDate(inspection.plazoRespuestaAt, true)}` : ''}</p></div></Card>
    {canEdit && <InspectionComparisonPanel inspectionId={inspection.id} comparisons={comparisons} editable onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} />}
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(330px,0.72fr)]"><div className="space-y-4">{!canEdit && <InspectionReport inspection={{ ...inspection, items, comparaciones: comparisons }} />}{canEdit && <Checklist inspectionId={inspection.id} groups={groups} items={items} completed={completed} editable setItems={setItems} uploadingItemId={uploadingItemId} onEvidence={(file, item) => upload(file, { itemId: item.id, descripcion: item.observacion?.trim() || `Evidencia vinculada al control ${item.codigo}` }, true)} />}</div><div className="space-y-4"><EvidenceCard inspection={inspection} editable={canEdit} recording={recording} onCamera={() => cameraRef.current?.click()} onFile={() => fileRef.current?.click()} onAudio={toggleRecording} /><input ref={cameraRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={uploadFromInput} /><input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf,audio/*" className="hidden" onChange={uploadFromInput} /><InspectionTimeline inspection={inspection} canComment={Boolean(isAdmin)} busy={eventMutation.isPending} onAdd={async (input, file) => { try { await eventMutation.mutateAsync({ input, file }); toast.success('Trazabilidad actualizada', input.tipo === 'NOTIFICACION_PREPARADA' ? 'Correo registrado como no enviado.' : 'Evento incorporado.'); } catch (error: any) { toast.error('No se pudo registrar', error?.response?.data?.message || 'Revise los datos.'); throw error; } }} /><Card><h3 className="font-extrabold text-[#10213A]">Observaciones generales</h3><textarea disabled={!canEdit} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={5} placeholder="Describa hallazgos, contexto y acciones requeridas…" className="mt-3 w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm leading-relaxed disabled:bg-neutral-50" /></Card>{(inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && <Card><h3 className="font-extrabold text-[#10213A]">Plazo de respuesta</h3><p className="mt-1 text-xs text-neutral-500">La aprobación no envía correos; deja el expediente preparado.</p><input type="datetime-local" value={plazoRespuestaAt} onChange={(e) => setPlazoRespuestaAt(e.target.value)} className="mt-3 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" /></Card>}</div></div>
    {showActionBar && <div data-testid="inspection-action-bar" className={`sticky ${hasMobileNav ? 'bottom-[calc(64px+env(safe-area-inset-bottom,0px))]' : 'bottom-0'} z-30 -mx-4 border-t border-neutral-200 bg-white px-3 py-3 shadow-[0_-3px_10px_rgba(16,33,58,0.06)] sm:mx-0 sm:rounded-xl sm:border`}><div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-2 [&>button]:min-w-0 [&>button]:px-2 sm:flex sm:justify-end sm:[&>button]:flex-none sm:[&>button]:px-5">{canEdit && <Button aria-label="Guardar borrador" variant="outline" leftIcon={<Save size={17} />} isLoading={saveMutation.isPending} onClick={save}><span className="sm:hidden">Guardar</span><span className="hidden sm:inline">Guardar borrador</span></Button>}{inspection.estado === 'EN_REVISION' && isAdmin && <Button aria-label="Devolver a campo" variant="outline" onClick={() => transition('EN_CAMPO')}><span className="sm:hidden">Devolver</span><span className="hidden sm:inline">Devolver a campo</span></Button>}{primaryAction && <Button aria-label={primaryAction.label} leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={primaryAction.state === 'NOTIFICADA' && !plazoRespuestaAt}><span className="sm:hidden">{primaryAction.state === 'EN_REVISION' ? 'Enviar' : primaryAction.state === 'EN_CAMPO' ? 'Iniciar' : 'Aprobar'}</span><span className="hidden sm:inline">{primaryAction.label}</span></Button>}</div></div>}
  </div>;
};

function Meta({ icon, label, value, detail, to }: { icon: React.ReactNode; label: string; value: string; detail?: string; to?: string }) { return <div className="flex gap-3"><span className="mt-0.5 shrink-0 text-neutral-500 [&>svg]:h-[19px] [&>svg]:w-[19px]">{icon}</span><div className="min-w-0"><p className="text-xs text-neutral-500">{label}</p>{to ? <Link to={to} className="rounded-sm font-bold text-[#10213A] transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Abrir ${label.toLowerCase()}: ${value}`}>{value}</Link> : <p className="font-bold text-[#10213A]">{value}</p>}{detail && <p className="text-xs text-neutral-500">{detail}</p>}</div></div>; }
function Checklist({ inspectionId, groups, items, completed, editable, setItems, uploadingItemId, onEvidence }: { inspectionId: string; groups: string[]; items: InspectionItem[]; completed: number; editable: boolean; setItems: React.Dispatch<React.SetStateAction<InspectionItem[]>>; uploadingItemId: string | null; onEvidence: (file: File, item: InspectionItem) => void }) {
  const nonCompliant = items.filter((item) => item.resultado === 'NO_CUMPLE').length;
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const updateItem = (id: string, patch: Partial<InspectionItem>) => setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  return <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
    <div className="border-b border-neutral-200 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div><h3 className="font-extrabold text-[#10213A]">Checklist regulatorio</h3><p className="mt-0.5 text-xs text-neutral-500">Valide cada control por separado y documente las no conformidades.</p></div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold">{nonCompliant > 0 && <span className="rounded-full bg-error-50 px-2.5 py-1 text-error-700">{nonCompliant} {nonCompliant === 1 ? 'falla' : 'fallas'}</span>}<span className="rounded-full bg-primary-50 px-2.5 py-1 text-primary-700">{completed}/{items.length}</span></div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-600 transition-all" style={{ width: `${Math.round((completed / Math.max(1, items.length)) * 100)}%` }} /></div>
    </div>
    {groups.map((group) => {
      const groupItems = items.filter((item) => item.categoria === group);
      const groupCompleted = groupItems.filter((item) => item.resultado !== 'PENDIENTE').length;
      const groupFails = groupItems.filter((item) => item.resultado === 'NO_CUMPLE').length;
      return <div key={group} className="border-b border-neutral-200 last:border-0">
        <div className="flex items-center justify-between gap-3 bg-neutral-50 px-4 py-3 sm:px-6">
          <p className="font-bold text-[#10213A]">{group}</p>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">{groupFails > 0 && <span className="text-error-700">{groupFails} sin cumplir</span>}<span>{groupCompleted}/{groupItems.length}</span></div>
        </div>
        {groupItems.map((item) => {
          const isFail = item.resultado === 'NO_CUMPLE';
          const itemEvidence = item.evidencias || [];
          const showObservation = isFail || Boolean(item.observacion) || itemEvidence.length > 0 || expandedNotes.includes(item.id);
          return <div key={item.id} data-result={item.resultado} className={`border-t border-neutral-100 px-4 py-4 first:border-0 sm:px-6 ${isFail ? 'border-l-[3px] border-l-error-500 bg-error-50/30 pl-[13px] sm:pl-[21px]' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.resultado === 'CUMPLE' ? 'bg-success-100 text-success-700' : isFail ? 'bg-error-100 text-error-700' : item.resultado === 'NO_APLICA' ? 'bg-neutral-200 text-neutral-700' : 'border border-neutral-300 bg-white text-neutral-300'}`}>{item.resultado === 'CUMPLE' ? <Check size={16} /> : isFail ? <XCircle size={16} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={16} /> : null}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-relaxed text-[#10213A]">{item.etiqueta}</p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{item.codigo}</p></div>
              {item.resultado === 'PENDIENTE' && <span className="shrink-0 rounded-full bg-warning-50 px-2 py-1 text-[10px] font-bold text-warning-800">Pendiente</span>}
            </div>
            {editable && <div className="mt-3 pl-0 sm:pl-10">
              <div role="group" aria-label={`Validación: ${item.etiqueta}`} className="grid grid-cols-3 gap-2">
                {RESULTS.map((option) => {
                  const selected = item.resultado === option.value;
                  return <button key={option.value} type="button" aria-pressed={selected} onClick={() => updateItem(item.id, { resultado: option.value })} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:text-sm ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}>{option.icon}<span className="truncate">{option.label}</span>{selected && <Check size={13} className="hidden sm:block" aria-hidden="true" />}</button>;
                })}
              </div>
              {!showObservation && <button type="button" onClick={() => setExpandedNotes((ids) => [...ids, item.id])} className="mt-2 rounded-md px-1 py-1 text-xs font-bold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">+ Agregar observación o foto</button>}
              {showObservation && <div className={`mt-3 border-l-2 pl-3 ${isFail ? 'border-error-300' : 'border-neutral-300'}`}>
                <label><span className={`mb-1 block text-xs font-bold ${isFail ? 'text-error-800' : 'text-neutral-700'}`}>{isFail ? 'Hallazgo y acción requerida' : 'Observación registrada'}</span><textarea aria-label={`Observación: ${item.etiqueta}`} value={item.observacion || ''} onChange={(event) => updateItem(item.id, { observacion: event.target.value })} rows={2} placeholder={isFail ? 'Describa qué no cumple, la evidencia y qué debe corregirse' : 'Observación del control'} className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ${isFail ? 'border-error-200 focus:border-error-500 focus:ring-error-100' : 'border-neutral-300 focus:border-primary-600 focus:ring-primary-100'}`} /></label>
                {itemEvidence.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{itemEvidence.map((evidence) => <figure key={evidence.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white"><InspectionEvidenceImage inspectionId={inspectionId} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} className="aspect-[4/3] w-full object-cover" /><figcaption className="truncate px-2 py-1.5 text-[11px] font-semibold text-neutral-600">{evidence.nombreOriginal}</figcaption></figure>)}</div>}
                <label className={`mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-300 hover:bg-primary-100'}`}>
                  {uploadingItemId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {uploadingItemId === item.id ? 'Guardando y subiendo…' : itemEvidence.length ? 'Agregar otra foto' : 'Adjuntar foto al comentario'}
                  <input aria-label={`Adjuntar foto: ${item.etiqueta}`} type="file" accept="image/jpeg,image/png" capture="environment" disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                </label>
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">La imagen también queda disponible en Evidencias del expediente.</p>
              </div>}
            </div>}
          </div>;
        })}
      </div>;
    })}
  </section>;
}
export function EvidenceCard({ inspection, editable, recording, onCamera, onFile, onAudio }: { inspection: NonNullable<ReturnType<typeof useInspection>['data']>; editable: boolean; recording: boolean; onCamera: () => void; onFile: () => void; onAudio: () => void }) {
  return <Card>
    <div className="flex items-center justify-between"><div><h3 className="font-extrabold text-[#10213A]">Evidencias ({inspection.evidencias.length})</h3><p className="mt-0.5 text-xs text-neutral-500">Archivo general del expediente</p></div><Paperclip size={18} className="text-neutral-400" /></div>
    {inspection.evidencias.length === 0 ? <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">Todavía no se incorporaron evidencias.</p> : <div className="mt-4 space-y-2">{inspection.evidencias.map((e) => {
      const linkedItem = e.itemId ? inspection.items.find((item) => item.id === e.itemId) : null;
      return <div key={e.id} className="flex items-center gap-3 overflow-hidden rounded-xl border border-neutral-200 bg-white p-2">{e.tipo === 'FOTO' ? <InspectionEvidenceImage inspectionId={inspection.id} evidenceId={e.id} alt={e.descripcion || e.nombreOriginal} className="h-20 w-24 shrink-0 rounded-lg object-cover" /> : <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${e.tipo === 'AUDIO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{e.tipo === 'AUDIO' ? <FileAudio size={20} /> : <FileText size={20} />}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#10213A]">{e.nombreOriginal}</p>{linkedItem && <p className="mt-1 w-fit rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-800">Checklist · {linkedItem.codigo}</p>}{e.descripcion && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{e.descripcion}</p>}<p className="mt-1 text-xs text-neutral-500">{(e.bytes / 1024 / 1024).toFixed(1)} MB · {new Date(e.createdAt).toLocaleString('es-AR')}</p></div></div>;
    })}</div>}
    {editable && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><Button className="w-full" variant="outline" size="sm" leftIcon={<Camera size={16} />} onClick={onCamera}>Foto general</Button><Button className="w-full" variant="outline" size="sm" leftIcon={<Paperclip size={16} />} onClick={onFile}>Archivo</Button><Button className="col-span-2 w-full sm:col-span-1" variant={recording ? 'danger' : 'outline'} size="sm" leftIcon={recording ? <Square size={15} /> : <Mic size={16} />} onClick={onAudio}>{recording ? 'Detener' : 'Audio'}</Button></div>}
  </Card>;
}

export default InspeccionExpedientePage;

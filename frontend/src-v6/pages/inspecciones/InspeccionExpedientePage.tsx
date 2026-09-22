import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AlertTriangle, ArchiveX, ArrowLeft, CalendarDays, Camera, Check, ChevronDown, ChevronUp, CircleMinus, ClipboardCheck, CloudOff, CloudUpload, Download, FileAudio, FileText, History, Loader2, MapPin, Mic, Paperclip, RotateCcw, Save, Send, ShieldCheck, Square, Trash2, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInspection, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import {
  listPendingInspectionEvidence,
  pendingEvidenceFile,
  queueInspectionEvidence,
  removePendingInspectionEvidence,
  updatePendingInspectionEvidence,
  type PendingInspectionEvidence,
  type PendingInspectionEvidenceFields,
} from '../../services/inspectionOfflineEvidence';
import type { InspectionActData, InspectionComparison, InspectionEvidence, InspectionItem, InspectionItemResult, InspectionState, InspectionTechnicalReport } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';
import { InspectionComparisonPanel } from './InspectionComparisonPanel';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { InspectionReport } from './InspectionReport';
import { InspectionTimeline } from './InspectionTimeline';
import { InspectionExchangePanel } from './InspectionExchangePanel';
import { InspectionDocumentsPanel } from './InspectionDocumentsPanel';
import { getInspectionDossierReadiness, type InspectionDossierReadiness } from './inspectionDossierReadiness';
import { inspectionActorRoute, inspectionDate, inspectionErrorMessage } from './inspectionPresentation';

const LABELS: Record<InspectionState, string> = { BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión', NOTIFICADA: 'Notificada', EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación', CERRADA_CONFORME: 'Cerrada conforme', DERIVADA_LEGALES: 'Derivada a legales', EN_TRAMITE_LEGAL: 'En trámite legal', DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
const COLORS: Partial<Record<InspectionState, BadgeColor>> = { BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning', NOTIFICADA: 'info', EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error', CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error', EN_TRAMITE_LEGAL: 'warning', DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral' };
const RESULTS: Array<{ value: InspectionItemResult; label: string; icon: React.ReactNode; active: string }> = [
  { value: 'CUMPLE', label: 'Cumple', icon: <Check size={16} />, active: 'border-success-600 bg-success-50 text-success-800' },
  { value: 'NO_CUMPLE', label: 'No cumple', icon: <XCircle size={16} />, active: 'border-error-600 bg-error-50 text-error-800' },
  { value: 'NO_APLICA', label: 'No aplica', icon: <CircleMinus size={16} />, active: 'border-neutral-500 bg-neutral-100 text-neutral-800' },
];
type Draft = { version: number; observaciones: string; numeroActa: string; ubicacion: string; plazoRespuestaAt: string; datosActa: InspectionActData; informeTecnico: InspectionTechnicalReport; items: InspectionItem[]; comparaciones: InspectionComparison[] };
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';

const InspeccionExpedientePage: React.FC = () => {
  const { id = '' } = useParams(); const navigate = useNavigate(); const location = useLocation(); const mobile = location.pathname.startsWith('/mobile'); const hasMobileNav = mobile || window.location.pathname.startsWith('/app/'); const { currentUser } = useAuth();
  const query = useInspection(id); const inspection = query.data;
  const [items, setItems] = useState<InspectionItem[]>([]); const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [observaciones, setObservaciones] = useState(''); const [numeroActa, setNumeroActa] = useState(''); const [ubicacion, setUbicacion] = useState(''); const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [datosActa, setDatosActa] = useState<InspectionActData>({}); const [informeTecnico, setInformeTecnico] = useState<InspectionTechnicalReport>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine); const [recording, setRecording] = useState(false); const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [pendingEvidence, setPendingEvidence] = useState<PendingInspectionEvidence[]>([]); const [syncingEvidence, setSyncingEvidence] = useState(false);
  const [staleDraft, setStaleDraft] = useState<Draft | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const fileRef = useRef<HTMLInputElement | null>(null); const cameraRef = useRef<HTMLInputElement | null>(null);
  const syncingRef = useRef(false);
  const syncEvidenceRef = useRef<() => Promise<void>>(async () => undefined);
  const draftKey = currentUser?.id && id ? `sitrep_inspection_draft_${currentUser.id}_${id}` : '';
  const isAdmin = Boolean(inspection && (currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${inspection.tipoActor}`));
  const isAssignedInspector = Boolean(inspection && currentUser && String(inspection.inspectorId) === String(currentUser.id));
  const canEdit = Boolean(inspection && ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado) && (isAdmin || isAssignedInspector));
  const canEditReport = Boolean(inspection && (canEdit || (inspection.estado === 'EN_REVISION' && (isAdmin || isAssignedInspector))));

  useEffect(() => { const on = () => setIsOnline(true); const off = () => setIsOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => {
    if (!inspection) return;
    const draft: Draft = { version: inspection.version, observaciones: inspection.observaciones || '', numeroActa: inspection.numeroActa || '', ubicacion: inspection.ubicacion || '', plazoRespuestaAt: localDate(inspection.plazoRespuestaAt), datosActa: inspection.datosActa || {}, informeTecnico: inspection.informeTecnico || {}, items: inspection.items, comparaciones: inspection.comparaciones || [] };
    setStaleDraft(null);
    if (draftKey) try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
      if (saved?.version === inspection.version) {
        const serverComparisonIds = new Set(draft.comparaciones.map((row) => row.id));
        const savedComparisonsAreCurrent = saved.comparaciones.length === draft.comparaciones.length
          && saved.comparaciones.every((row) => serverComparisonIds.has(row.id));
        Object.assign(draft, saved, { comparaciones: savedComparisonsAreCurrent ? saved.comparaciones : draft.comparaciones });
        setStaleDraft(null);
      } else if (saved && typeof saved.version === 'number') {
        // Never discard field work merely because another device advanced the
        // server version. The user decides whether to recover or discard it.
        setStaleDraft(saved);
      }
    } catch { setStaleDraft(null); }
    setItems(draft.items); setComparisons(draft.comparaciones); setObservaciones(draft.observaciones); setNumeroActa(draft.numeroActa); setUbicacion(draft.ubicacion); setPlazoRespuestaAt(draft.plazoRespuestaAt); setDatosActa(draft.datosActa); setInformeTecnico(draft.informeTecnico);
  }, [inspection, draftKey]);
  useEffect(() => { if (!draftKey || !inspection || !items.length || staleDraft || (!canEdit && !canEditReport)) return; const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify({ version: inspection.version, observaciones, numeroActa, ubicacion, plazoRespuestaAt, datosActa, informeTecnico, items, comparaciones: comparisons } satisfies Draft)), 350); return () => window.clearTimeout(timer); }, [canEdit, canEditReport, draftKey, inspection, observaciones, numeroActa, ubicacion, plazoRespuestaAt, datosActa, informeTecnico, items, comparisons, staleDraft]);

  const refreshPendingEvidence = useCallback(async () => {
    if (!id || !currentUser?.id) return;
    setPendingEvidence(await listPendingInspectionEvidence(id, String(currentUser.id)));
  }, [currentUser?.id, id]);
  useEffect(() => { void refreshPendingEvidence(); }, [refreshPendingEvidence]);

  const persistDraft = useCallback(async () => { if (!inspection) return; const meta = await inspeccionService.update(id, { version: inspection.version, observaciones: observaciones || null, numeroActa: numeroActa || null, ubicacion: ubicacion || null, plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : null, datosActa, informeTecnico }); const checked = await inspeccionService.updateItems(id, meta.version, items.map((item) => ({ id: item.id, resultado: item.resultado, observacion: item.observacion || null }))); return inspeccionService.updateComparisons(id, checked.version, comparisons.map((row) => ({ id: row.id, resultado: row.resultado, valorObservado: row.valorObservado || null, observacion: row.observacion || null }))); }, [comparisons, datosActa, id, informeTecnico, inspection, items, numeroActa, observaciones, plazoRespuestaAt, ubicacion]);
  const persistTechnicalReport = useCallback(async () => { if (!inspection) return; return inspeccionService.updateTechnicalReport(id, inspection.version, informeTecnico); }, [id, informeTecnico, inspection]);
  const persistChanges = useCallback(async () => canEdit ? persistDraft() : canEditReport ? persistTechnicalReport() : undefined, [canEdit, canEditReport, persistDraft, persistTechnicalReport]);
  const saveMutation = useInspectionMutation(persistChanges, id);
  const transitionMutation = useInspectionMutation(async ({ next, version }: { next: InspectionState; version: number }) => inspeccionService.transition(id, version, next, { plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : undefined }), id);
  const uploadMutation = useInspectionMutation(async ({ file, fields }: { file: File; fields?: PendingInspectionEvidenceFields & { clienteId?: string; capturadaAt?: string; clienteSha256?: string } }) => inspeccionService.uploadEvidence(id, file, fields), id);
  const annulMutation = useInspectionMutation(async ({ evidenceId, version, motivo }: { evidenceId: string; version: number; motivo: string }) => inspeccionService.annulEvidence(id, evidenceId, version, motivo), id);
  const eventMutation = useInspectionMutation(async ({ input, file }: { input: Parameters<typeof inspeccionService.addEvent>[1]; file?: File }) => { const event = await inspeccionService.addEvent(id, input); if (file) await inspeccionService.uploadEvidence(id, file, { eventoId: event.id }); }, id);
  const pdfMutation = useInspectionMutation(async (kind: 'acta' | 'informe-tecnico') => inspection && inspeccionService.downloadPdf(id, inspection.numero, kind), id);

  const syncEvidence = useCallback(async () => {
    if (!navigator.onLine || !id || !currentUser?.id || syncingRef.current) return;
    const entries = await listPendingInspectionEvidence(id, String(currentUser.id));
    let hasStoredDraft = false;
    if (draftKey && inspection) {
      try {
        const stored = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
        hasStoredDraft = stored?.version === inspection.version;
      } catch { /* a damaged draft is never auto-synchronized */ }
    }
    if (!entries.length && !hasStoredDraft) return;
    syncingRef.current = true; setSyncingEvidence(true);
    let synchronized = 0;
    try {
      if (hasStoredDraft) {
        await persistChanges();
        if (draftKey) localStorage.removeItem(draftKey);
      }
      for (const entry of entries) {
        try {
          await inspeccionService.uploadEvidence(id, pendingEvidenceFile(entry), {
            ...entry.fields,
            clienteId: entry.id,
            capturadaAt: entry.capturedAt,
            clienteSha256: entry.sha256 || undefined,
          });
          await removePendingInspectionEvidence(entry.id);
          synchronized += 1;
        } catch (error: unknown) {
          await updatePendingInspectionEvidence({ ...entry, attempts: entry.attempts + 1, lastError: inspectionErrorMessage(error, 'No se pudo sincronizar') });
          break;
        }
      }
      await refreshPendingEvidence();
      if (synchronized || hasStoredDraft) {
        await query.refetch();
        toast.success(synchronized ? 'Evidencias sincronizadas' : 'Borrador sincronizado', synchronized ? `${synchronized} ${synchronized === 1 ? 'captura quedó incorporada' : 'capturas quedaron incorporadas'} al expediente.` : 'Los cambios de campo quedaron guardados en el servidor.');
      }
    } finally {
      syncingRef.current = false; setSyncingEvidence(false);
    }
  }, [currentUser?.id, draftKey, id, inspection, persistChanges, query, refreshPendingEvidence]);
  useEffect(() => { syncEvidenceRef.current = syncEvidence; }, [syncEvidence]);
  useEffect(() => { if (isOnline) void syncEvidenceRef.current(); }, [currentUser?.id, id, isOnline]);

  const save = async () => { if (!isOnline) return toast.info('Borrador guardado en el dispositivo', 'Se sincronizará cuando vuelva la conexión.'); try { await saveMutation.mutateAsync(undefined); if (draftKey) localStorage.removeItem(draftKey); toast.success(canEdit ? 'Inspección guardada' : 'Informe técnico guardado', canEdit ? 'Comparación, checklist, acta e informe quedaron sincronizados.' : 'La evaluación técnica quedó versionada sin modificar el acta de campo.'); } catch (error: unknown) { toast.error('No se pudo guardar', inspectionErrorMessage(error, 'Los cambios siguen guardados en este dispositivo.')); } };
  const transition = async (next: InspectionState) => {
    if (!isOnline) return toast.warning('Conexión requerida', 'El cierre requiere confirmación del servidor.');
    if (pendingEvidence.length) return toast.warning('Sincronización pendiente', 'Espere a que todas las capturas queden incorporadas antes de cambiar el estado.');
    if (!inspection) return;
    try {
      const saved = canEdit || canEditReport ? await persistChanges() : null;
      if ((canEdit || canEditReport) && draftKey) localStorage.removeItem(draftKey);
      await transitionMutation.mutateAsync({ next, version: saved?.version ?? inspection.version });
      toast.success('Estado actualizado', next === 'NOTIFICADA' ? 'Expediente aprobado; no se envió correo externo.' : LABELS[next]);
    } catch (error: unknown) { toast.error('Acción rechazada', inspectionErrorMessage(error, 'No se pudo cambiar el estado.')); }
  };
  const upload = async (file?: File, fields: PendingInspectionEvidenceFields = {}, persistDraft = false) => {
    if (!file) return;
    if (!currentUser?.id) return toast.error('Sesión no disponible', 'No se pudo identificar al inspector.');
    if (file.size === 0) return toast.error('Archivo vacío', 'Seleccione otra imagen.');
    if (file.size > 25 * 1024 * 1024) return toast.error('Imagen demasiado pesada', 'El máximo permitido es 25 MB.');
    if ((fields.itemId || fields.comparacionId) && !file.type.startsWith('image/')) {
      return toast.error('Formato no compatible', 'Para este control seleccione una imagen JPG, PNG o WEBP.');
    }
    if (fields?.itemId) setUploadingItemId(fields.itemId);
    let pending: PendingInspectionEvidence | null = null;
    try {
      pending = await queueInspectionEvidence(id, String(currentUser.id), file, fields);
      await refreshPendingEvidence();
      if (!isOnline) {
        toast.success('Foto protegida en el dispositivo', 'Quedó vinculada al comentario y se sincronizará al recuperar conexión.');
        return;
      }
      if (persistDraft) {
        await saveMutation.mutateAsync(undefined);
        if (draftKey) localStorage.removeItem(draftKey);
      }
      const evidenceAlreadyPresent = Boolean(inspection?.evidencias.some((evidence) => evidence.sha256 === pending?.sha256));
      const uploadedEvidence = await uploadMutation.mutateAsync({ file, fields: { ...fields, clienteId: pending.id, capturadaAt: pending.capturedAt, clienteSha256: pending.sha256 || undefined } });
      // Además de la invalidación central, esperamos explícitamente la lectura fresca:
      // la miniatura y la versión del expediente deben quedar actualizadas antes de confirmar.
      await query.refetch();
      await removePendingInspectionEvidence(pending.id);
      await refreshPendingEvidence();
      toast.success(
        evidenceAlreadyPresent ? 'La imagen ya estaba incorporada' : fields?.itemId ? 'Foto vinculada al control' : 'Evidencia incorporada',
        uploadedEvidence.nombreOriginal,
      );
    } catch (error: unknown) {
      const networkFailure = !navigator.onLine || (isAxiosError(error) && !error.response);
      if (pending) {
        await updatePendingInspectionEvidence({ ...pending, attempts: pending.attempts + 1, lastError: inspectionErrorMessage(error, 'No se pudo sincronizar') }).catch(() => undefined);
        await refreshPendingEvidence();
      }
      if (pending && networkFailure) toast.warning('Conexión interrumpida', 'La captura quedó protegida y se reintentará sin duplicarla.');
      else if (pending) toast.error('Evidencia pendiente', 'La carga no fue aceptada, pero la imagen quedó protegida en este dispositivo para corregir o reintentar.');
      else toast.error('Evidencia rechazada', inspectionErrorMessage(error, 'No se pudo cargar.'));
    } finally {
      if (fields?.itemId) setUploadingItemId(null);
    }
  };
  const uploadFromInput = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(file); };
  const annulEvidence = async (evidenceId: string, motivo: string) => {
    if (!inspection) return;
    try {
      await annulMutation.mutateAsync({ evidenceId, version: inspection.version, motivo });
      await query.refetch();
      toast.success('Evidencia anulada', 'El archivo y su huella permanecen en la trazabilidad.');
    } catch (error: unknown) {
      toast.error('No se pudo anular', inspectionErrorMessage(error, 'Actualice el expediente e intente nuevamente.'));
      throw error;
    }
  };
  const toggleRecording = async () => { if (recording && recorderRef.current) { recorderRef.current.stop(); setRecording(false); return; } if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast.warning('Audio no disponible', 'El navegador no permite grabar audio.'); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); chunksRef.current = []; recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data); recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }); await upload(new File([blob], `audio-inspeccion-${Date.now()}.webm`, { type: blob.type })); }; recorder.start(); recorderRef.current = recorder; setRecording(true); } catch { toast.error('Micrófono denegado', 'Habilite el permiso para incorporar audio.'); } };

  const dossierReadiness = useMemo<InspectionDossierReadiness | null>(() => inspection ? getInspectionDossierReadiness(inspection, {
    numeroActa,
    plazoRespuestaAt,
    observaciones,
    datosActa,
    informeTecnico,
    items,
    comparaciones: comparisons,
  }) : null, [comparisons, datosActa, informeTecnico, inspection, items, numeroActa, observaciones, plazoRespuestaAt]);

  const recoverStaleDraft = () => {
    if (!inspection || !staleDraft) return;
    const savedItems = new Map((staleDraft.items || []).map((item) => [item.id, item]));
    const savedComparisons = new Map((staleDraft.comparaciones || []).map((row) => [row.id, row]));
    const recoveredItems = inspection.items.map((current) => {
      const saved = savedItems.get(current.id);
      return saved ? { ...current, resultado: saved.resultado, observacion: saved.observacion } : current;
    });
    const recoveredComparisons = inspection.comparaciones.map((current) => {
      const saved = savedComparisons.get(current.id);
      return saved ? { ...current, resultado: saved.resultado, valorObservado: saved.valorObservado, observacion: saved.observacion } : current;
    });
    const recovered: Draft = {
      version: inspection.version,
      observaciones: staleDraft.observaciones || '',
      numeroActa: staleDraft.numeroActa || '',
      ubicacion: staleDraft.ubicacion || '',
      plazoRespuestaAt: staleDraft.plazoRespuestaAt || '',
      datosActa: staleDraft.datosActa || {},
      informeTecnico: staleDraft.informeTecnico || {},
      items: recoveredItems,
      comparaciones: recoveredComparisons,
    };
    setObservaciones(recovered.observaciones); setNumeroActa(recovered.numeroActa); setUbicacion(recovered.ubicacion); setPlazoRespuestaAt(recovered.plazoRespuestaAt); setDatosActa(recovered.datosActa); setInformeTecnico(recovered.informeTecnico); setItems(recovered.items); setComparisons(recovered.comparaciones);
    if (draftKey) localStorage.setItem(draftKey, JSON.stringify(recovered));
    setStaleDraft(null);
    toast.warning('Borrador anterior recuperado', 'Revisá las diferencias con la versión del servidor antes de guardar.');
  };

  const discardStaleDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setStaleDraft(null);
    toast.info('Borrador anterior descartado', 'Se conserva la versión actualmente registrada en el servidor.');
  };

  if (query.isLoading) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente…</p>;
  if (!inspection) return <Card><p className="font-semibold text-neutral-900">Inspección no encontrada</p></Card>;
  const actor = inspectionActor(inspection);
  const actorRoute = actor ? inspectionActorRoute(inspection.tipoActor, actor.id, mobile) : '';
  const completed = items.filter((item) => item.resultado !== 'PENDIENTE').length; const groups = Array.from(new Set(items.map((item) => item.categoria)));
  const primaryAction = inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA' ? { label: 'Iniciar inspección', state: 'EN_CAMPO' as InspectionState } : inspection.estado === 'EN_CAMPO' ? { label: 'Enviar a revisión', state: 'EN_REVISION' as InspectionState } : inspection.estado === 'EN_REVISION' && isAdmin ? { label: 'Aprobar expediente', state: 'NOTIFICADA' as InspectionState } : null;
  const showActionBar = canEdit || canEditReport || Boolean(primaryAction);
  const showReadiness = !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'CANCELADA'].includes(inspection.estado);
  const showExchangePanel = !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'CANCELADA'].includes(inspection.estado);
  const approvalBlocked = inspection.estado === 'EN_REVISION' && (!dossierReadiness?.ready || Boolean(staleDraft));
  const stickyPosition = hasMobileNav ? 'sticky top-[calc(3.5rem+env(safe-area-inset-top))]' : 'sticky top-20';

  return <div className={`space-y-4 animate-fade-in ${hasMobileNav ? 'pb-20 sm:pb-0' : ''}`}>
    {(!isOnline || pendingEvidence.length > 0) && <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2">{isOnline ? <CloudUpload size={18} /> : <CloudOff size={18} />}{!isOnline ? 'Sin conexión · el borrador y las capturas quedan protegidos en este dispositivo' : `${pendingEvidence.length} ${pendingEvidence.length === 1 ? 'captura pendiente' : 'capturas pendientes'} de sincronización`}</span>{isOnline && pendingEvidence.length > 0 && <button type="button" onClick={() => void syncEvidence()} disabled={syncingEvidence} className="w-fit rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-60">{syncingEvidence ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}</div>}
    {staleDraft && <StaleDraftNotice serverVersion={inspection.version} draftVersion={staleDraft.version} onRecover={recoverStaleDraft} onDiscard={discardStaleDraft} />}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button onClick={() => navigate(`${mobile ? '/mobile' : ''}/inspecciones`)} className="flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"><ArrowLeft size={18} />Volver al listado</button><div className="flex flex-wrap items-center gap-2"><Badge color={COLORS[inspection.estado] || 'neutral'} size="lg" dot>{LABELS[inspection.estado]}</Badge><DropdownMenu><DropdownTrigger asChild><Button variant="outline" size="sm" leftIcon={<Download size={16} />} rightIcon={<ChevronDown size={14} />} isLoading={pdfMutation.isPending}>Exportar</Button></DropdownTrigger><DropdownContent className="w-72"><DropdownLabel>Documentos del expediente</DropdownLabel><DropdownItem icon={<ClipboardCheck size={16} />} onClick={() => pdfMutation.mutate('acta')}>Acta de inspección<span className="block text-[11px] font-normal text-neutral-500">Salida de campo levantada desde la tablet</span></DropdownItem><DropdownItem icon={<FileText size={16} />} onClick={() => pdfMutation.mutate('informe-tecnico')}>Informe técnico<span className="block text-[11px] font-normal text-neutral-500">Evaluación que acompaña al acta para dictamen</span></DropdownItem></DropdownContent></DropdownMenu></div></div>
    <Card className="!p-4 sm:!p-5"><div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-primary-700">Expediente de inspección</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10213A]">{inspection.numero}</h2></div><label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:w-64">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(e) => setNumeroActa(e.target.value)} placeholder="Asignar número" className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm font-medium normal-case text-neutral-900 disabled:bg-neutral-50" /></label></div><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Meta icon={<ClipboardCheck />} label="Actor inspeccionado" value={actor?.razonSocial || ''} detail={`CUIT ${actor?.cuit || 's/d'}`} to={actor ? actorRoute : undefined} /><Meta icon={<UserRound />} label="Inspector" value={`${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`} /><div className="flex gap-3"><MapPin className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div className="min-w-0 flex-1"><p className="text-xs text-neutral-500">Ubicación</p>{canEdit ? <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" /> : <p className="font-bold text-[#10213A]">{ubicacion || 'Sin informar'}</p>}</div></div><Meta icon={<CalendarDays />} label="Inicio" value={inspectionDate(inspection.iniciadaAt, true)} /></div><div className="mt-4 border-t border-neutral-200 pt-4"><p className="text-xs leading-relaxed text-neutral-500 lg:text-right">Creada {inspectionDate(inspection.createdAt, true)} · Programada {inspectionDate(inspection.fechaProgramada, true)}<br className="hidden lg:block" /> Actualizada {inspectionDate(inspection.updatedAt, true)}{inspection.plazoRespuestaAt ? ` · Plazo ${inspectionDate(inspection.plazoRespuestaAt, true)}` : ''}</p></div></Card>
    {showReadiness && dossierReadiness && <DossierReadinessPanel readiness={dossierReadiness} />}
    {showActionBar && <div data-testid="inspection-action-bar" className={`${stickyPosition} z-30 rounded-xl border border-neutral-200 bg-white/95 px-2 py-2 shadow-md backdrop-blur sm:px-4 sm:py-3`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="hidden sm:block"><p className="text-sm font-extrabold text-[#10213A]">Acciones del expediente</p><p className="mt-0.5 text-xs text-neutral-500">{staleDraft ? 'Resolvé el borrador anterior antes de guardar o cambiar de etapa.' : canEdit ? 'Guardá el avance antes de cambiar la etapa.' : 'El acta de campo está cerrada; sólo puede versionarse el informe técnico.'}</p></div><div className={`grid gap-2 [&>button]:min-w-0 [&>button]:px-2 sm:flex sm:justify-end sm:[&>button]:flex-none sm:[&>button]:px-5 ${inspection.estado === 'EN_REVISION' && isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>{(canEdit || canEditReport) && <Button aria-label={canEdit ? 'Guardar borrador' : 'Guardar informe técnico'} variant="outline" leftIcon={<Save size={17} />} isLoading={saveMutation.isPending} onClick={save} disabled={Boolean(staleDraft)}><span className="sm:hidden">Guardar</span><span className="hidden sm:inline">{canEdit ? 'Guardar borrador' : 'Guardar informe técnico'}</span></Button>}{inspection.estado === 'EN_REVISION' && isAdmin && <Button aria-label="Devolver a campo" variant="outline" onClick={() => transition('EN_CAMPO')} disabled={Boolean(staleDraft)}><span className="sm:hidden">Devolver</span><span className="hidden sm:inline">Devolver a campo</span></Button>}{primaryAction && <Button aria-label={primaryAction.label} aria-describedby={primaryAction.state === 'NOTIFICADA' ? 'approval-readiness-hint' : undefined} leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={Boolean(staleDraft) || (primaryAction.state === 'NOTIFICADA' && (!plazoRespuestaAt || approvalBlocked))}><span className="sm:hidden">{primaryAction.state === 'EN_REVISION' ? 'Enviar' : primaryAction.state === 'EN_CAMPO' ? 'Iniciar' : 'Aprobar'}</span><span className="hidden sm:inline">{primaryAction.label}</span></Button>}</div></div></div>}
    {canEdit && <InspectionComparisonPanel inspectionId={inspection.id} comparisons={comparisons} editable onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} />}
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(330px,0.72fr)]">
      <div className="space-y-4">
        {canEditReport && !canEdit && <InspectionDocumentsPanel actData={datosActa} report={informeTecnico} actEditable={false} reportEditable reportFirst onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />}
        {!canEdit && <InspectionReport inspection={{ ...inspection, items, comparaciones: comparisons, informeTecnico }} readiness={dossierReadiness || undefined} />}
        {canEdit && <Checklist inspectionId={inspection.id} groups={groups} items={items} completed={completed} editable setItems={setItems} uploadingItemId={uploadingItemId} pendingEvidence={pendingEvidence} onEvidence={(file, item) => upload(file, { itemId: item.id, descripcion: item.observacion?.trim() || `Evidencia vinculada al control ${item.codigo}` }, true)} onAnnul={annulEvidence} />}
        {(canEdit || !canEditReport) && <InspectionDocumentsPanel actData={datosActa} report={informeTecnico} actEditable={canEdit} reportEditable={canEditReport} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />}
        {showExchangePanel && <InspectionExchangePanel inspectionId={inspection.id} compact />}
      </div>
      <div className="space-y-4">
        <EvidenceCard inspection={inspection} pendingEvidence={pendingEvidence} editable={canEdit} recording={recording} onCamera={() => cameraRef.current?.click()} onFile={() => fileRef.current?.click()} onAudio={toggleRecording} onAnnul={annulEvidence} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadFromInput} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf,audio/*" className="hidden" onChange={uploadFromInput} />
        <InspectionTimeline inspection={inspection} canComment={Boolean(isAdmin)} busy={eventMutation.isPending} onAdd={async (input, file) => { try { await eventMutation.mutateAsync({ input, file }); toast.success('Registro actualizado', input.tipo === 'NOTIFICACION_PREPARADA' ? 'Borrador de notificación registrado como no enviado.' : 'Nota interna incorporada.'); } catch (error: unknown) { toast.error('No se pudo registrar', inspectionErrorMessage(error, 'Revise los datos.')); throw error; } }} />
        <Card><h3 className="font-extrabold text-[#10213A]">Observaciones generales</h3><textarea disabled={!canEdit} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={5} placeholder="Describa hallazgos, contexto y acciones requeridas…" className="mt-3 w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm leading-relaxed disabled:bg-neutral-50" /></Card>
        {(inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && <Card><h3 className="font-extrabold text-[#10213A]">Plazo de respuesta</h3><p className="mt-1 text-xs text-neutral-500">La aprobación no envía correos; deja el expediente preparado.</p><input aria-label="Plazo de respuesta" type="datetime-local" value={plazoRespuestaAt} onChange={(e) => setPlazoRespuestaAt(e.target.value)} className="mt-3 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" /></Card>}
      </div>
    </div>
  </div>;
};

function StaleDraftNotice({ serverVersion, draftVersion, onRecover, onDiscard }: { serverVersion: number; draftVersion: number; onRecover: () => void; onDiscard: () => void }) {
  return <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
    <div className="flex items-start gap-3">
      <History size={19} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">Hay un borrador anterior sin conciliar</p>
        <p className="mt-1 text-xs leading-relaxed">El dispositivo conserva cambios de la versión {draftVersion}; el servidor está en la versión {serverVersion}. No se descartó ni fusionó nada automáticamente.</p>
        <p className="mt-1 text-xs font-semibold">Si lo recuperás, revisá los datos antes de guardar: la versión del servidor seguirá intacta hasta esa acción.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onRecover} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-900 px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"><RotateCcw size={15} />Recuperar borrador anterior</button>
          <button type="button" onClick={onDiscard} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"><Trash2 size={15} />Descartar borrador anterior</button>
        </div>
      </div>
    </div>
  </section>;
}

function DossierReadinessPanel({ readiness }: { readiness: InspectionDossierReadiness }) {
  return <section data-testid="inspection-dossier-readiness" aria-live="polite" className={`rounded-2xl border px-4 py-4 sm:px-5 ${readiness.ready ? 'border-success-200 bg-success-50' : 'border-amber-300 bg-amber-50'}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${readiness.ready ? 'bg-success-100 text-success-800' : 'bg-amber-100 text-amber-900'}`}>{readiness.ready ? <ShieldCheck size={19} /> : <AlertTriangle size={19} />}</span>
        <div>
          <h3 className="font-extrabold text-[#10213A]">Preparación para aprobar</h3>
          <p id="approval-readiness-hint" className="mt-1 text-xs leading-relaxed text-neutral-700">{readiness.ready ? 'El dossier reúne los controles documentales definidos para esta etapa. La aprobación administrativa no reemplaza el dictamen de Legales.' : 'El expediente todavía no debe presentarse como final. Completá o devolvé a campo los puntos pendientes.'}</p>
        </div>
      </div>
      <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${readiness.ready ? 'bg-success-100 text-success-800' : 'bg-white text-amber-900 ring-1 ring-amber-300'}`}>{readiness.completed}/{readiness.total} completos</span>
    </div>
    {!readiness.ready && <div className="mt-3 border-t border-amber-200 pt-3"><p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Falta completar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{readiness.missing.map((item) => <li key={item} className="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-neutral-800"><CircleMinus size={14} className="mt-0.5 shrink-0 text-amber-700" />{item}</li>)}</ul></div>}
  </section>;
}

function Meta({ icon, label, value, detail, to }: { icon: React.ReactNode; label: string; value: string; detail?: string; to?: string }) { return <div className="flex gap-3"><span className="mt-0.5 shrink-0 text-neutral-500 [&>svg]:h-[19px] [&>svg]:w-[19px]">{icon}</span><div className="min-w-0"><p className="text-xs text-neutral-500">{label}</p>{to ? <Link to={to} className="rounded-sm font-bold text-[#10213A] transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Abrir ${label.toLowerCase()}: ${value}`}>{value}</Link> : <p className="font-bold text-[#10213A]">{value}</p>}{detail && <p className="text-xs text-neutral-500">{detail}</p>}</div></div>; }
function Checklist({ inspectionId, groups, items, completed, editable, setItems, uploadingItemId, pendingEvidence, onEvidence, onAnnul }: { inspectionId: string; groups: string[]; items: InspectionItem[]; completed: number; editable: boolean; setItems: React.Dispatch<React.SetStateAction<InspectionItem[]>>; uploadingItemId: string | null; pendingEvidence: PendingInspectionEvidence[]; onEvidence: (file: File, item: InspectionItem) => void; onAnnul: (evidenceId: string, reason: string) => Promise<void> }) {
  const nonCompliant = items.filter((item) => item.resultado === 'NO_CUMPLE').length;
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);
  const updateItem = (id: string, patch: Partial<InspectionItem>) => setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  return <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
    <div className="border-b border-neutral-200 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div><h3 className="font-extrabold text-[#10213A]">Checklist regulatorio</h3><p className="mt-0.5 text-xs text-neutral-500">Valide cada control por separado y documente las no conformidades.</p></div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold">{nonCompliant > 0 && <span className="rounded-full bg-error-50 px-2.5 py-1 text-error-700">{nonCompliant} {nonCompliant === 1 ? 'falla' : 'fallas'}</span>}<span className="rounded-full bg-primary-50 px-2.5 py-1 text-primary-700">{completed}/{items.length}</span></div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-600 transition-[width] duration-200" style={{ width: `${Math.round((completed / Math.max(1, items.length)) * 100)}%` }} /></div>
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
          const itemEvidence = [...(item.evidencias || [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
          const itemEvidenceExpanded = expandedEvidence.includes(item.id);
          const visibleItemEvidence = itemEvidenceExpanded ? itemEvidence : itemEvidence.slice(0, 4);
          const pendingItemEvidence = pendingEvidence.filter((evidence) => evidence.fields.itemId === item.id);
          const showObservation = isFail || Boolean(item.observacion) || itemEvidence.length > 0 || pendingItemEvidence.length > 0 || expandedNotes.includes(item.id);
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
                {itemEvidence.length > 0 && <div className="mt-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleItemEvidence.map((evidence) => <EvidenceTile key={evidence.id} inspectionId={inspectionId} evidence={evidence} editable={editable} onAnnul={onAnnul} />)}</div>{itemEvidence.length > 4 && <button type="button" onClick={() => setExpandedEvidence((ids) => itemEvidenceExpanded ? ids.filter((id) => id !== item.id) : [...ids, item.id])} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{itemEvidenceExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{itemEvidenceExpanded ? 'Mostrar menos' : `Ver las ${itemEvidence.length} evidencias`}</button>}</div>}
                {pendingItemEvidence.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{pendingItemEvidence.map((evidence) => <PendingEvidenceThumbnail key={evidence.id} evidence={evidence} />)}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-300 hover:bg-primary-100'}`}>
                    {uploadingItemId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    {uploadingItemId === item.id ? 'Subiendo…' : 'Tomar foto'}
                    <input aria-label={`Tomar foto: ${item.etiqueta}`} type="file" accept="image/*" capture="environment" disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                  <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-neutral-300 bg-white text-neutral-800 hover:border-primary-300 hover:bg-primary-50'}`}>
                    <Paperclip size={16} />
                    Elegir imagen
                    <input aria-label={`Adjuntar foto: ${item.etiqueta}`} type="file" accept="image/*" disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">Use la cámara o elija una imagen del dispositivo. Máximo 25 MB; también quedará en Evidencias del expediente.</p>
              </div>}
            </div>}
          </div>;
        })}
      </div>;
    })}
  </section>;
}
export function EvidenceCard({ inspection, pendingEvidence, editable, recording, onCamera, onFile, onAudio, onAnnul }: { inspection: NonNullable<ReturnType<typeof useInspection>['data']>; pendingEvidence: PendingInspectionEvidence[]; editable: boolean; recording: boolean; onCamera: () => void; onFile: () => void; onAudio: () => void; onAnnul: (evidenceId: string, reason: string) => Promise<void> }) {
  const [showAll, setShowAll] = useState(false);
  const activeCount = inspection.evidencias.filter((evidence) => !evidence.anuladaAt).length;
  const visible = showAll ? inspection.evidencias : inspection.evidencias.slice(0, 5);
  return <Card>
    <div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-[#10213A]">Evidencias ({activeCount}{pendingEvidence.length ? ` + ${pendingEvidence.length}` : ''})</h3><p className="mt-0.5 text-xs text-neutral-500">Archivo general del expediente{inspection.evidencias.some((evidence) => evidence.anuladaAt) ? ' · conserva anulaciones' : ''}{pendingEvidence.length ? ' · pendientes protegidos' : ''}</p></div><Paperclip size={18} className="shrink-0 text-neutral-400" /></div>
    {inspection.evidencias.length === 0 ? <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">Todavía no se incorporaron evidencias.</p> : <div className="mt-4 space-y-2">{visible.map((evidence) => {
      const linkedItem = evidence.itemId ? inspection.items.find((item) => item.id === evidence.itemId) : null;
      return <div key={evidence.id} className={`overflow-hidden rounded-xl border p-2 ${evidence.anuladaAt ? 'border-neutral-300 bg-neutral-100' : 'border-neutral-200 bg-white'}`}><div className="flex items-center gap-3">{evidence.tipo === 'FOTO' ? <div className="w-24 shrink-0"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} preview className={`h-20 w-full rounded-lg object-cover ${evidence.anuladaAt ? 'grayscale opacity-60' : ''}`} /></div> : <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${evidence.tipo === 'AUDIO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} ${evidence.anuladaAt ? 'opacity-50' : ''}`}>{evidence.tipo === 'AUDIO' ? <FileAudio size={20} /> : <FileText size={20} />}</span>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`min-w-0 break-all text-sm font-bold ${evidence.anuladaAt ? 'text-neutral-500 line-through' : 'text-[#10213A]'}`}>{evidence.nombreOriginal}</p>{evidence.anuladaAt && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700">Anulada</span>}</div>{linkedItem && <p className="mt-1 w-fit rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-800">Checklist · {linkedItem.codigo}</p>}{evidence.descripcion && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{evidence.descripcion}</p>}<p className="mt-1 text-xs text-neutral-500">{(evidence.bytes / 1024 / 1024).toFixed(1)} MB · {new Date(evidence.createdAt).toLocaleString('es-AR')}</p></div></div>{evidence.anuladaAt && <p className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-neutral-700"><span className="font-bold">Motivo de anulación:</span> {evidence.motivoAnulacion || 'Sin motivo informado'}</p>}{editable && !evidence.anuladaAt && <EvidenceAnnulControl evidence={evidence} onAnnul={onAnnul} />}</div>;
    })}{inspection.evidencias.length > 5 && <button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{showAll ? 'Mostrar menos' : `Ver las ${inspection.evidencias.length} evidencias`}</button>}</div>}
    {pendingEvidence.filter((entry) => !entry.fields.itemId).length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{pendingEvidence.filter((entry) => !entry.fields.itemId).map((entry) => <PendingEvidenceThumbnail key={entry.id} evidence={entry} />)}</div>}
    {editable && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><Button className="w-full" variant="outline" size="sm" leftIcon={<Camera size={16} />} onClick={onCamera}>Foto general</Button><Button className="w-full" variant="outline" size="sm" leftIcon={<Paperclip size={16} />} onClick={onFile}>Archivo</Button><Button className="col-span-2 w-full sm:col-span-1" variant={recording ? 'danger' : 'outline'} size="sm" leftIcon={recording ? <Square size={15} /> : <Mic size={16} />} onClick={onAudio}>{recording ? 'Detener' : 'Audio'}</Button></div>}
  </Card>;
}

function EvidenceTile({ inspectionId, evidence, editable, onAnnul }: { inspectionId: string; evidence: InspectionEvidence; editable: boolean; onAnnul: (evidenceId: string, reason: string) => Promise<void> }) {
  return <figure className={`overflow-hidden rounded-xl border ${evidence.anuladaAt ? 'border-neutral-300 bg-neutral-100' : 'border-neutral-200 bg-white'}`}>
    <InspectionEvidenceImage inspectionId={inspectionId} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} preview className={`aspect-[4/3] w-full object-cover ${evidence.anuladaAt ? 'grayscale opacity-60' : ''}`} />
    <figcaption className="px-2 py-2"><div className="flex items-start justify-between gap-1"><p className={`min-w-0 truncate text-[11px] font-semibold ${evidence.anuladaAt ? 'text-neutral-500 line-through' : 'text-neutral-700'}`}>{evidence.nombreOriginal}</p>{evidence.anuladaAt && <span className="shrink-0 text-[9px] font-bold uppercase text-neutral-600">Anulada</span>}</div>{evidence.anuladaAt && <p className="mt-1 text-[10px] leading-snug text-neutral-600">{evidence.motivoAnulacion}</p>}</figcaption>
    {editable && !evidence.anuladaAt && <div className="border-t border-neutral-100 px-2 pb-2"><EvidenceAnnulControl evidence={evidence} onAnnul={onAnnul} compact /></div>}
  </figure>;
}

function EvidenceAnnulControl({ evidence, onAnnul, compact = false }: { evidence: InspectionEvidence; onAnnul: (evidenceId: string, reason: string) => Promise<void>; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 10) return;
    setBusy(true);
    try {
      await onAnnul(evidence.id, reason.trim());
      setOpen(false);
      setReason('');
    } catch {
      // El toast global explica el error; se conserva el motivo para poder reintentar.
    } finally { setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-bold text-neutral-600 hover:bg-neutral-100 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${compact ? 'mt-2 px-1.5' : 'mt-2 px-2'}`}><ArchiveX size={14} />Anular con motivo</button>;
  return <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5"><label className="block text-[11px] font-bold text-amber-950">Motivo obligatorio<textarea aria-label={`Motivo para anular ${evidence.nombreOriginal}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={compact ? 2 : 3} placeholder="Explique por qué no debe considerarse esta evidencia" className="mt-1 w-full resize-y rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-amber-400" /></label><p className="mt-1 text-[10px] leading-relaxed text-amber-900">El archivo no se borra: queda marcado y auditado.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setOpen(false); setReason(''); }} className="min-h-8 rounded-md border border-neutral-300 bg-white px-2 text-[11px] font-bold text-neutral-700">Cancelar</button><button type="button" disabled={busy || reason.trim().length < 10} onClick={() => void submit()} className="min-h-8 rounded-md bg-error-700 px-2 text-[11px] font-bold text-white disabled:opacity-50">{busy ? 'Anulando…' : 'Confirmar anulación'}</button></div></div>;
}

function PendingEvidenceThumbnail({ evidence }: { evidence: PendingInspectionEvidence }) {
  const url = useMemo(() => URL.createObjectURL(evidence.file), [evidence.file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <figure data-testid="pending-inspection-evidence" className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50">
    {evidence.mimeType.startsWith('image/') && url ? <img src={url} alt={`Captura pendiente: ${evidence.fileName}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-amber-800"><FileText size={22} /></div>}
    <figcaption className="px-2 py-2"><p className="truncate text-[11px] font-bold text-[#10213A]">{evidence.fileName}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-800"><CloudUpload size={12} />Pendiente de sincronizar</p></figcaption>
  </figure>;
}

export default InspeccionExpedientePage;

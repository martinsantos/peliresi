import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArchiveX, ArrowLeft, Camera, Check, ChevronDown, ChevronUp, CircleMinus, ClipboardCheck, CloudOff, CloudUpload, Download, FileAudio, FileText, History, Loader2, Mic, Paperclip, RotateCcw, Save, Send, ShieldCheck, Square, Trash2, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInspection, useInspectionMutation } from '../../hooks/useInspecciones';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { inspeccionService } from '../../services/inspeccion.service';
import {
  listPendingInspectionEvidence,
  INSPECTION_EVIDENCE_ACCEPT,
  INSPECTION_PHOTO_ACCEPT,
  discardPendingInspectionEvidence,
  pendingEvidenceFile,
  queueInspectionEvidence,
  replacePendingInspectionEvidence,
  syncPendingInspectionEvidence,
  type PendingInspectionEvidence,
  type PendingInspectionEvidenceFields,
} from '../../services/inspectionOfflineEvidence';
import type { Inspection, InspectionActData, InspectionComparison, InspectionEvidence, InspectionItem, InspectionItemResult, InspectionState, InspectionTechnicalReport } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';
import { InspectionComparisonPanel } from './InspectionComparisonPanel';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { PendingEvidenceThumbnail, type PendingEvidenceActions } from './InspectionPendingEvidence';
import { InspectionReport } from './InspectionReport';
import { InspectionTimeline } from './InspectionTimeline';
import { InspectionExchangePanel } from './InspectionExchangePanel';
import { InspectionWorkspace, type InspectionWorkspaceStep } from './InspectionWorkspace';
import { InspectionVerificationBlock } from './InspectionVerificationBlock';
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
const COMPARISON_RESULT_LABELS: Record<string, string> = { COINCIDE: 'Coincide', DIFIERE: 'Difiere', NO_VERIFICADO: 'No verificado', NO_APLICA: 'No aplica' };
type Draft = { version: number; observaciones: string; numeroActa: string; ubicacion: string; plazoRespuestaAt: string; datosActa: InspectionActData; informeTecnico: InspectionTechnicalReport; items: InspectionItem[]; comparaciones: InspectionComparison[] };
type DraftSaveStatus = { tone: 'neutral' | 'warning' | 'success' | 'error'; message: string };
// Compare only fields that this form persists; evidence metadata can refresh independently.
const draftFingerprint = (draft: Draft) => JSON.stringify({ observaciones: draft.observaciones, numeroActa: draft.numeroActa, ubicacion: draft.ubicacion, plazoRespuestaAt: draft.plazoRespuestaAt, datosActa: draft.datosActa, informeTecnico: draft.informeTecnico, items: draft.items.map(({ id, resultado, observacion }) => ({ id, resultado, observacion: observacion || null })), comparaciones: draft.comparaciones.map(({ id, resultado, valorObservado, observacion }) => ({ id, resultado, valorObservado: valorObservado || null, observacion: observacion || null })) });
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
const draftFromInspection = (inspection: Inspection): Draft => ({ version: inspection.version, observaciones: inspection.observaciones || '', numeroActa: inspection.numeroActa || '', ubicacion: inspection.ubicacion || '', plazoRespuestaAt: localDate(inspection.plazoRespuestaAt), datosActa: inspection.datosActa || {}, informeTecnico: inspection.informeTecnico || {}, items: inspection.items, comparaciones: inspection.comparaciones || [] });

const InspeccionExpedientePage: React.FC = () => {
  const { id = '' } = useParams(); const navigate = useNavigate(); const location = useLocation(); const mobile = location.pathname.startsWith('/mobile'); const hasMobileNav = mobile || window.location.pathname.startsWith('/app/'); const { currentUser } = useAuth();
  const query = useInspection(id); const inspection = query.data;
  const [items, setItems] = useState<InspectionItem[]>([]); const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [observaciones, setObservaciones] = useState(''); const [numeroActa, setNumeroActa] = useState(''); const [ubicacion, setUbicacion] = useState(''); const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [datosActa, setDatosActa] = useState<InspectionActData>({}); const [informeTecnico, setInformeTecnico] = useState<InspectionTechnicalReport>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine); const [recording, setRecording] = useState(false); const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [pendingEvidenceEntries, setPendingEvidence] = useState<PendingInspectionEvidence[]>([]); const [syncingEvidence, setSyncingEvidence] = useState(false);
  const pendingEvidence = pendingEvidenceEntries.filter((entry) => entry.inspectionId === id && entry.userId === String(currentUser?.id));
  const [pendingEvidenceReadFailed, setPendingEvidenceReadFailed] = useState(true);
  const [staleDraft, setStaleDraft] = useState<Draft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [serverFingerprint, setServerFingerprint] = useState('');
  const serverFingerprintRef = useRef('');
  serverFingerprintRef.current = serverFingerprint;
  const [localFingerprint, setLocalFingerprint] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingDraftRef = useRef(false);
  const confirmedVersionRef = useRef(0);
  const hydratedCaseRef = useRef('');
  const hasOwnedDraftRef = useRef(false);
  const ownedDraftKeyRef = useRef('');
  const recoveredDraftNeedsSyncRef = useRef(false);
  const previousOnlineRef = useRef(isOnline);
  const currentDraftRef = useRef<Draft | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const fileRef = useRef<HTMLInputElement | null>(null); const cameraRef = useRef<HTMLInputElement | null>(null);
  const syncingRef = useRef(false);
  const transitionInFlight = useRef(false);
  const [changingStage, setChangingStage] = useState(false);
  const syncEvidenceRef = useRef<() => Promise<void>>(async () => undefined);
  const saveForSyncRef = useRef<() => Promise<boolean>>(async () => false);
  const evidenceScope = JSON.stringify([String(currentUser?.id || ''), id]);
  const evidenceScopeRef = useRef(evidenceScope);
  evidenceScopeRef.current = evidenceScope;
  useEffect(() => () => { evidenceScopeRef.current = ''; }, []);
  const draftKey = currentUser?.id && id ? `sitrep_inspection_draft_${currentUser.id}_${id}` : '';
  const isAdmin = Boolean(inspection && (currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${inspection.tipoActor}`));
  const isAssignedInspector = Boolean(inspection && currentUser && String(inspection.inspectorId) === String(currentUser.id));
  const fieldEditAllowed = Boolean(inspection && ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado) && (isAdmin || isAssignedInspector));
  const reportEditAllowed = Boolean(inspection && (fieldEditAllowed || (inspection.estado === 'EN_REVISION' && (isAdmin || isAssignedInspector))));
  const draftOwnership = useInspectionDraftOwnership(draftKey, fieldEditAllowed || reportEditAllowed);
  const canWriteDraft = draftOwnership.canWrite;
  const canEdit = fieldEditAllowed && draftOwnership.status === 'owned';
  const canEditReport = reportEditAllowed && draftOwnership.status === 'owned';
  const currentDraft: Draft | null = inspection ? { version: Math.max(inspection.version, confirmedVersionRef.current), observaciones, numeroActa, ubicacion, plazoRespuestaAt, datosActa, informeTecnico, items, comparaciones: comparisons } : null;
  currentDraftRef.current = currentDraft;
  const currentFingerprint = currentDraft ? draftFingerprint(currentDraft) : '';
  const storeDraft = useCallback((draft: Draft) => {
    if (!canWriteDraft()) return false;
    if (!draftKey) { setStorageFailed(true); return false; }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLocalFingerprint(draftFingerprint(draft));
      setStorageFailed(false);
      return true;
    } catch { setStorageFailed(true); return false; }
  }, [canWriteDraft, draftKey]);

  useEffect(() => { const on = () => setIsOnline(true); const off = () => setIsOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => {
    if (!inspection || savingDraftRef.current || syncingRef.current || transitionInFlight.current) return;
    const hydrationKey = `${draftKey}:${inspection.id}:${inspection.version}`;
    // Query refetches can replace the object without advancing its version.
    // Never apply that same server snapshot over unsaved field edits.
    if (hydratedCaseRef.current === hydrationKey) return;
    hydratedCaseRef.current = hydrationKey;
    const draft = draftFromInspection(inspection);
    recoveredDraftNeedsSyncRef.current = false;
    confirmedVersionRef.current = inspection.version;
    setServerFingerprint(draftFingerprint(draft));
    setStaleDraft(null);
    if (draftKey) try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
      if (saved?.version === inspection.version) {
        recoveredDraftNeedsSyncRef.current = draftFingerprint(saved) !== draftFingerprint(draft);
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
    } catch { setStaleDraft(null); setStorageFailed(true); }
    setItems(draft.items); setComparisons(draft.comparaciones); setObservaciones(draft.observaciones); setNumeroActa(draft.numeroActa); setUbicacion(draft.ubicacion); setPlazoRespuestaAt(draft.plazoRespuestaAt); setDatosActa(draft.datosActa); setInformeTecnico(draft.informeTecnico);
    // Ownership can move from checking to owned after the inspector starts
    // typing. That status change must never rehydrate stale server values over
    // the in-progress field draft.
  }, [inspection, draftKey]);
  useEffect(() => {
    if (ownedDraftKeyRef.current !== draftKey) { ownedDraftKeyRef.current = draftKey; hasOwnedDraftRef.current = false; }
    if (draftOwnership.status !== 'owned' || hasOwnedDraftRef.current || !inspection || !draftKey) return;
    hasOwnedDraftRef.current = true;
    // A read-only tab may have loaded an older device copy while the owner
    // continued working. On first ownership, take the latest protected copy.
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
      if (!saved || saved.version !== inspection.version) return;
      setItems(saved.items); setComparisons(saved.comparaciones); setObservaciones(saved.observaciones);
      setNumeroActa(saved.numeroActa); setUbicacion(saved.ubicacion); setPlazoRespuestaAt(saved.plazoRespuestaAt);
      setDatosActa(saved.datosActa); setInformeTecnico(saved.informeTecnico);
      setLocalFingerprint(draftFingerprint(saved));
    } catch { setStorageFailed(true); }
  }, [draftOwnership.status, inspection, draftKey]);
  useEffect(() => {
    if (!draftKey || !inspection || !items.length || staleDraft || (!canEdit && !canEditReport)) return;
    const timer = window.setTimeout(() => { if (currentDraftRef.current) storeDraft(currentDraftRef.current); }, 350);
    return () => window.clearTimeout(timer);
  }, [canEdit, canEditReport, draftKey, inspection, currentFingerprint, items.length, staleDraft, storeDraft]);
  useEffect(() => {
    const flush = () => { if (!staleDraft && currentDraftRef.current && (canEdit || canEditReport)) storeDraft(currentDraftRef.current); };
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHidden); };
  }, [canEdit, canEditReport, staleDraft, storeDraft]);

  const refreshPendingEvidence = useCallback(async () => {
    if (!id || !currentUser?.id) return;
    try {
      const entries = await listPendingInspectionEvidence(id, String(currentUser.id));
      if (evidenceScopeRef.current === evidenceScope) { setPendingEvidence(entries); setPendingEvidenceReadFailed(false); }
    } catch (error) {
      if (evidenceScopeRef.current === evidenceScope) setPendingEvidenceReadFailed(true);
      throw error;
    }
  }, [currentUser?.id, evidenceScope, id]);
  useEffect(() => { setPendingEvidence([]); setPendingEvidenceReadFailed(true); void refreshPendingEvidence().catch(() => toast.error('No se pudo leer la cola local', 'No se confirmó el estado de las capturas pendientes. Volvé a abrir el expediente antes de cambiar de etapa.')); }, [refreshPendingEvidence]);

  const persistDraft = useCallback(async () => {
    const draft = currentDraftRef.current;
    if (!draft || !canWriteDraft()) return;
    return inspeccionService.saveDraft(id, {
      version: draft.version, observaciones: draft.observaciones || null, numeroActa: draft.numeroActa || null,
      ubicacion: draft.ubicacion || null, plazoRespuestaAt: draft.plazoRespuestaAt ? new Date(draft.plazoRespuestaAt).toISOString() : null,
      datosActa: draft.datosActa, informeTecnico: draft.informeTecnico,
      items: draft.items.map((item) => ({ id: item.id, resultado: item.resultado, observacion: item.observacion || null })),
      comparaciones: draft.comparaciones.map((row) => ({ id: row.id, resultado: row.resultado, valorObservado: row.valorObservado || null, observacion: row.observacion || null })),
    });
  }, [canWriteDraft, id]);
  const persistTechnicalReport = useCallback(async () => { const draft = currentDraftRef.current; if (!draft || !canWriteDraft()) return; return inspeccionService.updateTechnicalReport(id, draft.version, draft.informeTecnico); }, [canWriteDraft, id]);
  const persistChanges = useCallback(async () => canEdit ? persistDraft() : canEditReport ? persistTechnicalReport() : undefined, [canEdit, canEditReport, persistDraft, persistTechnicalReport]);
  const saveMutation = useInspectionMutation(persistChanges, id);
  const transitionMutation = useInspectionMutation(async ({ next, version }: { next: InspectionState; version: number }) => inspeccionService.transition(id, version, next, { plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : undefined }), id);
  const uploadMutation = useInspectionMutation(async ({ file, fields }: { file: File; fields?: PendingInspectionEvidenceFields & { clienteId?: string; capturadaAt?: string; clienteSha256?: string } }) => inspeccionService.uploadEvidence(id, file, fields), id);
  const annulMutation = useInspectionMutation(async ({ evidenceId, version, motivo }: { evidenceId: string; version: number; motivo: string }) => inspeccionService.annulEvidence(id, evidenceId, version, motivo), id);
  const eventMutation = useInspectionMutation(async ({ input, file }: { input: Parameters<typeof inspeccionService.addEvent>[1]; file?: File }) => { const event = await inspeccionService.addEvent(id, input); if (file) await inspeccionService.uploadEvidence(id, file, { eventoId: event.id }); }, id);
  const pdfMutation = useInspectionMutation(async (kind: 'acta' | 'informe-tecnico') => inspection && inspeccionService.downloadPdf(id, inspection.numero, kind), id);

  const refreshAfterEvidence = useCallback(async () => {
    const refreshed = await query.refetch();
    if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
    if (!refreshed.data) throw new Error('La carga requiere una nueva lectura del servidor para confirmar su versión.');
    const fresh = refreshed.data;
    const latest = currentDraftRef.current;
    if (!latest) return;
    // Evidence can advance the case version without changing its field data.
    // Never rebase our draft over another inspector's concurrent field edit.
    if (draftFingerprint(draftFromInspection(fresh)) !== serverFingerprintRef.current) {
      setStaleDraft(latest);
      return;
    }
    const merged = { ...latest, version: fresh.version,
      items: latest.items.map((item) => ({ ...item, evidencias: fresh.items.find((row) => row.id === item.id)?.evidencias || item.evidencias })),
      comparaciones: latest.comparaciones.map((row) => ({ ...row, evidencias: fresh.comparaciones.find((entry) => entry.id === row.id)?.evidencias || row.evidencias })),
    };
    confirmedVersionRef.current = fresh.version;
    currentDraftRef.current = merged;
    storeDraft(merged);
    setItems(merged.items); setComparisons(merged.comparaciones);
  }, [canWriteDraft, evidenceScope, query, storeDraft]);

  const syncEvidence = useCallback(async (manual = false, onlyId?: string) => {
    if (!navigator.onLine || !id || !currentUser?.id || syncingRef.current || savingDraftRef.current || transitionInFlight.current || staleDraft || !canEdit || !canWriteDraft()) return;
    syncingRef.current = true; setSyncingEvidence(true);
    try {
    const entries = await listPendingInspectionEvidence(id, String(currentUser.id));
    const hasStoredDraft = Boolean(currentDraftRef.current?.items.length && serverFingerprintRef.current && draftFingerprint(currentDraftRef.current) !== serverFingerprintRef.current);
    if (!entries.length && !hasStoredDraft) return;
    let synchronized = 0;
      if (hasStoredDraft) {
        if (!await saveForSyncRef.current()) return;
      }
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      const result = await syncPendingInspectionEvidence({ inspectionId: id, userId: String(currentUser.id), manual, onlyId, isActive: () => evidenceScopeRef.current === evidenceScope && canWriteDraft(),
        upload: async (entry) => {
          await inspeccionService.uploadEvidence(id, pendingEvidenceFile(entry), {
            ...entry.fields,
            clienteId: entry.id,
            capturadaAt: entry.capturedAt,
            clienteSha256: entry.sha256 || undefined,
          });
        },
      });
      synchronized = result.synchronized;
      await refreshPendingEvidence();
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      if (synchronized || hasStoredDraft) {
        await refreshAfterEvidence();
        if (manual || synchronized) toast.success(synchronized ? 'Evidencias sincronizadas' : 'Borrador sincronizado', synchronized ? `${synchronized} ${synchronized === 1 ? 'captura quedó incorporada' : 'capturas quedaron incorporadas'} al expediente.` : 'Los cambios de campo quedaron guardados en el servidor.');
      }
      if (result.failed) toast.warning('Hay evidencias pendientes', 'Revisá el error de cada captura en Evidencias. Las demás cargas pudieron continuar.');
    } catch (error) {
      toast.error('Sincronización pendiente', error instanceof Error ? error.message : inspectionErrorMessage(error, 'No se pudo sincronizar. Las capturas permanecen en el dispositivo.'));
    } finally {
      syncingRef.current = false; setSyncingEvidence(false);
    }
  }, [canEdit, canWriteDraft, currentUser?.id, evidenceScope, id, refreshAfterEvidence, refreshPendingEvidence, staleDraft]);
  useEffect(() => { syncEvidenceRef.current = syncEvidence; }, [syncEvidence]);
  useEffect(() => {
    const reconnected = isOnline && !previousOnlineRef.current;
    previousOnlineRef.current = isOnline;
    if (!isOnline || !canEdit || (!reconnected && !recoveredDraftNeedsSyncRef.current)) return;
    recoveredDraftNeedsSyncRef.current = false;
    void syncEvidenceRef.current();
  }, [canEdit, currentUser?.id, id, isOnline]);

  const save = async (fromSync = false): Promise<boolean> => {
    const submitted = currentDraftRef.current;
    if (!submitted || !canWriteDraft() || staleDraft || savingDraftRef.current || (!fromSync && (syncingRef.current || transitionInFlight.current))) return false;
    const locallyProtected = storeDraft(submitted);
    if (!isOnline || !navigator.onLine) {
      if (locallyProtected) toast.info('Guardado solo en este dispositivo', 'El servidor aún no lo recibió. Se reintentará al recuperar conexión.');
      else toast.error('No se pudo guardar', 'Sin conexión y sin almacenamiento disponible. No cierre esta pantalla: el comentario sigue solo en memoria.');
      return false;
    }
    savingDraftRef.current = true;
    setSavingDraft(true);
    setSaveFailed(false);
    try {
      const saved = await saveMutation.mutateAsync(undefined);
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return false;
      if (!saved || typeof saved.version !== 'number') throw new Error('El servidor no confirmó una versión del expediente.');
      confirmedVersionRef.current = saved.version;
      setServerFingerprint(draftFingerprint(submitted));
      serverFingerprintRef.current = draftFingerprint(submitted);
      // A response/refetch must never replace changes made while the request was in flight.
      const latest = currentDraftRef.current || submitted;
      const newerChanges = draftFingerprint(latest) !== draftFingerprint(submitted);
      currentDraftRef.current = { ...latest, version: saved.version };
      storeDraft(currentDraftRef.current);
      if (!fromSync) toast.success('Cambios confirmados en el servidor', newerChanges ? 'Hay cambios posteriores pendientes de guardar.' : canEdit ? 'Se guardó el borrador completo. Las fotos pendientes se indican aparte.' : 'El informe técnico quedó versionado sin modificar el acta de campo.');
      return !newerChanges;
    } catch (error: unknown) {
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return false;
      setSaveFailed(true);
      const protectedNow = currentDraftRef.current ? storeDraft(currentDraftRef.current) : false;
      toast.error('No se confirmó el guardado', inspectionErrorMessage(error, protectedNow ? 'Los cambios están solo en este dispositivo. Reintente antes de finalizar.' : 'No cierre la pantalla: no hay una copia local confirmada.'));
      // A lost response or another device may have advanced the version. Keep
      // the draft and require reconciliation rather than silently overwriting.
      const refreshed = await query.refetch().catch(() => undefined);
      if (refreshed?.data && refreshed.data.version !== submitted.version && currentDraftRef.current) {
        confirmedVersionRef.current = refreshed.data.version;
        setStaleDraft(currentDraftRef.current);
      }
      return false;
    } finally { savingDraftRef.current = false; setSavingDraft(false); }
  };
  saveForSyncRef.current = () => save(true);
  const transition = async (next: InspectionState) => {
    if (!canWriteDraft() || syncingRef.current || savingDraftRef.current || staleDraft) return false;
    if (!isOnline) { toast.warning('Conexión requerida', 'El cambio de etapa requiere confirmación del servidor.'); return false; }
    if (pendingEvidenceReadFailed) { toast.warning('Cola local no verificada', 'No se pudo comprobar si hay capturas pendientes. Reintentá la lectura antes de cambiar de etapa.'); return false; }
    if (pendingEvidence.length) { toast.warning('Sincronización pendiente', 'Espere a que todas las capturas queden incorporadas antes de cambiar el estado.'); return false; }
    if (!inspection || transitionInFlight.current) return false;
    transitionInFlight.current = true;
    setChangingStage(true);
    try {
      if (!await save(true) || !canWriteDraft()) return false;
      await transitionMutation.mutateAsync({ next, version: confirmedVersionRef.current });
      // The field snapshot stays recoverable until the transition is confirmed.
      // A failed transition never removes the only local copy.
      if (canWriteDraft() && draftKey) localStorage.removeItem(draftKey);
      toast.success('Estado actualizado', next === 'NOTIFICADA' ? 'Expediente aprobado; no se envió correo externo.' : LABELS[next]);
      return true;
    } catch (error: unknown) { toast.error('Acción rechazada', inspectionErrorMessage(error, 'No se pudo cambiar el estado.')); return false; }
    finally { transitionInFlight.current = false; setChangingStage(false); }
  };
  const upload = async (file?: File, fields: PendingInspectionEvidenceFields = {}) => {
    if (!file) return;
    if (!canWriteDraft() || !canEdit) return;
    if (syncingRef.current || savingDraftRef.current || transitionInFlight.current) return toast.warning('Carga en curso', 'Esperá a que termine la operación antes de agregar otra captura.');
    if (!currentUser?.id) return toast.error('Sesión no disponible', 'No se pudo identificar al inspector.');
    syncingRef.current = true; setSyncingEvidence(true);
    if (currentDraftRef.current) storeDraft(currentDraftRef.current);
    if (fields?.itemId) setUploadingItemId(fields.itemId);
    let pending: PendingInspectionEvidence | null = null;
    try {
      pending = await queueInspectionEvidence(id, String(currentUser.id), file, fields);
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      await refreshPendingEvidence();
      if (!isOnline || !navigator.onLine) {
        toast.success('Foto protegida en el dispositivo', 'Quedó vinculada al comentario y se sincronizará al recuperar conexión.');
        return;
      }
      if (staleDraft || !await save(true) || !canWriteDraft()) return;
      const evidenceAlreadyPresent = Boolean(inspection?.evidencias.some((evidence) => evidence.sha256 === pending?.sha256));
      const result = await syncPendingInspectionEvidence({ inspectionId: id, userId: String(currentUser.id), manual: true, onlyId: pending.id, isActive: () => evidenceScopeRef.current === evidenceScope && canWriteDraft(),
        upload: (entry) => uploadMutation.mutateAsync({ file: pendingEvidenceFile(entry), fields: { ...entry.fields, clienteId: entry.id, capturadaAt: entry.capturedAt, clienteSha256: entry.sha256 || undefined } }),
      });
      // Además de la invalidación central, esperamos explícitamente la lectura fresca:
      // la miniatura y la versión del expediente deben quedar actualizadas antes de confirmar.
      await refreshAfterEvidence();
      await refreshPendingEvidence();
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      if (!result.synchronized) {
        toast.warning('Evidencia pendiente', 'Revisá el error de la captura para corregirla o reintentar. La copia local se conserva.');
        return;
      }
      toast.success(
        evidenceAlreadyPresent ? 'La imagen ya estaba incorporada' : fields?.itemId ? 'Foto vinculada al control' : 'Evidencia incorporada',
        file.name,
      );
    } catch (error: unknown) {
      if (pending) await refreshPendingEvidence().catch(() => undefined);
      toast.error(pending ? 'Evidencia pendiente' : 'Evidencia no guardada', error instanceof Error ? error.message : inspectionErrorMessage(error, 'No se pudo cargar. Conservá el archivo original y reintentá.'));
    } finally {
      syncingRef.current = false; setSyncingEvidence(false);
      if (fields?.itemId) setUploadingItemId(null);
    }
  };
  const pendingEvidenceActions: PendingEvidenceActions = {
    busy: syncingEvidence || savingDraft || changingStage,
    online: isOnline,
    onRetry: (evidenceId) => syncEvidence(true, evidenceId),
    onDiscard: async (evidenceId) => {
      if (!canWriteDraft() || syncingRef.current || evidenceScopeRef.current !== evidenceScope) throw new Error('Esperá a que finalice la operación o recuperá la edición en esta pestaña.');
      await discardPendingInspectionEvidence(id, String(currentUser?.id), evidenceId);
      await refreshPendingEvidence();
      toast.info('Copia pendiente descartada', 'Se quitó del dispositivo por tu confirmación. No se modificaron evidencias del servidor.');
    },
    onReplace: async (evidenceId, file) => {
      if (!canWriteDraft() || syncingRef.current || evidenceScopeRef.current !== evidenceScope) throw new Error('Esperá a que finalice la operación o recuperá la edición en esta pestaña.');
      await replacePendingInspectionEvidence(id, String(currentUser?.id), evidenceId, file);
      await refreshPendingEvidence();
      toast.info('Archivo corregido guardado en el dispositivo', 'Reintentá la carga para incorporarlo al expediente.');
    },
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
    if (!inspection || !staleDraft || !canWriteDraft()) return;
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
    storeDraft(recovered);
    setStaleDraft(null);
    toast.warning('Borrador anterior recuperado', 'Revisá las diferencias con la versión del servidor antes de guardar.');
  };

  const discardStaleDraft = () => {
    if (!canWriteDraft()) return;
    if (draftKey) localStorage.removeItem(draftKey);
    setStaleDraft(null);
    toast.info('Borrador anterior descartado', 'Se conserva la versión actualmente registrada en el servidor.');
  };

  if (query.isLoading) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente…</p>;
  if (!inspection) return <Card><p className="font-semibold text-neutral-900">Inspección no encontrada</p></Card>;
  const actor = inspectionActor(inspection);
  const actorRoute = actor ? inspectionActorRoute(inspection.tipoActor, actor.id, mobile) : '';
  const completed = items.filter((item) => item.resultado !== 'PENDIENTE').length; const groups = Array.from(new Set(items.map((item) => item.categoria)));
  const comparisonGroups = Array.from(new Set(comparisons.map((row) => row.categoria)));
  const orderedComparisons = comparisonGroups.flatMap((group) => comparisons.filter((row) => row.categoria === group));
  const orderedItems = groups.flatMap((group) => items.filter((item) => item.categoria === group));
  const primaryAction = inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA' ? { label: 'Iniciar inspección', state: 'EN_CAMPO' as InspectionState } : inspection.estado === 'EN_CAMPO' ? { label: 'Enviar a revisión', state: 'EN_REVISION' as InspectionState } : inspection.estado === 'EN_REVISION' && isAdmin ? { label: 'Aprobar expediente', state: 'NOTIFICADA' as InspectionState } : null;
  const showExchangePanel = !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'CANCELADA'].includes(inspection.estado);
  const approvalBlocked = inspection.estado === 'EN_REVISION' && (!dossierReadiness?.ready || Boolean(staleDraft));
  const guided = fieldEditAllowed || reportEditAllowed;
  const reviewedComparisons = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const reportFields = [informeTecnico.objetivo, informeTecnico.antecedentes, informeTecnico.evaluacion, informeTecnico.conclusion, informeTecnico.recomendacion];
  const reportCompleted = reportFields.filter((value) => value?.trim()).length;
  const flushDraft = () => {
    if (!draftKey || !guided || staleDraft || !canWriteDraft()) return;
    if (currentDraftRef.current && !storeDraft(currentDraftRef.current)) toast.warning('No se pudo guardar en este dispositivo', 'No cierre la pantalla. Guardá en el servidor antes de salir de la inspección.');
  };
  const saveStatus: DraftSaveStatus = savingDraft
    ? { tone: 'neutral', message: 'Guardando cambios en el servidor…' }
    : staleDraft
      ? { tone: 'error', message: 'Hay versiones en conflicto. Revisá el borrador anterior antes de guardar.' }
      : currentFingerprint === serverFingerprint
        ? { tone: 'success', message: 'Sin cambios pendientes en el borrador del servidor.' }
        : storageFailed
          ? { tone: 'error', message: 'No hay copia local confirmada. No cierres esta pantalla; guardá con conexión.' }
          : saveFailed
            ? { tone: 'error', message: 'No se confirmó el guardado en el servidor. Reintentá. Los cambios siguen en este dispositivo.' }
            : localFingerprint === currentFingerprint
              ? { tone: 'warning', message: 'Guardado solo en este dispositivo. Pendiente de confirmar en el servidor.' }
              : { tone: 'warning', message: 'Cambios pendientes de guardar.' };
  const saveDisabled = !canWriteDraft() || Boolean(staleDraft) || syncingEvidence || changingStage;
  const draftInspection = { ...inspection, items, comparaciones: comparisons, informeTecnico, datosActa, numeroActa, ubicacion, observaciones };
  const context = <div className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2"><Meta icon={<ClipboardCheck />} label="Actor inspeccionado" value={actor?.razonSocial || ''} detail={'CUIT ' + (actor?.cuit || 's/d')} /><Meta icon={<UserRound />} label="Inspector" value={inspection.inspector.nombre + ' ' + (inspection.inspector.apellido || '')} /></div>
    <div className="grid gap-5 border-t border-neutral-200 pt-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-neutral-700">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Asignar número" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-normal text-neutral-900 disabled:bg-neutral-50" /></label>
      <label className="text-sm font-semibold text-neutral-700">Ubicación<input disabled={!canEdit} value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Dirección o referencia del lugar" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-normal text-neutral-900 disabled:bg-neutral-50" /></label>
    </div>
    <dl className="grid gap-4 border-t border-neutral-200 pt-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-neutral-500">Programada</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.fechaProgramada, true)}</dd></div><div><dt className="text-xs text-neutral-500">Inicio de campo</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.iniciadaAt, true)}</dd></div></dl>
    {canEdit && primaryAction?.state === 'EN_CAMPO' && <p className="border-t border-neutral-200 pt-4 text-sm leading-relaxed text-neutral-600">Iniciar registra la hora de comienzo de la visita.</p>}
  </div>;
  const act = <><label className="block text-sm font-semibold text-neutral-700">Observaciones generales<textarea disabled={!canEdit} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={4} placeholder="Describí el contexto, los hallazgos y las acciones requeridas." className="mt-2 w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm font-normal leading-relaxed disabled:bg-neutral-50" /></label><InspectionDocumentsPanel section="acta" actData={datosActa} report={informeTecnico} actEditable={canEdit} reportEditable={false} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} /></>;
  const evidence = <EvidenceCard inspection={inspection} pendingEvidence={pendingEvidence} pendingActions={canEdit ? pendingEvidenceActions : undefined} editable={canEdit} recording={recording} onCamera={() => cameraRef.current?.click()} onFile={() => fileRef.current?.click()} onAudio={toggleRecording} onAnnul={annulEvidence} />;
  const report = <InspectionDocumentsPanel section="informe" actData={datosActa} report={informeTecnico} actEditable={false} reportEditable={canEditReport} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />;
  const readiness = <>{canEdit ? <FieldReadinessPanel state={inspection.estado} items={items} comparisons={comparisons} pendingEvidenceCount={pendingEvidence.length} /> : dossierReadiness && <DossierReadinessPanel readiness={dossierReadiness} />}
    {(inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && <label className="block text-sm font-semibold text-neutral-700">Plazo de respuesta<input aria-label="Plazo de respuesta" type="datetime-local" value={plazoRespuestaAt} onChange={(event) => setPlazoRespuestaAt(event.target.value)} className="mt-2 h-11 w-full max-w-sm rounded-lg border border-neutral-300 px-3 text-sm" /><span className="mt-2 block text-xs font-normal text-neutral-500">La aprobación no envía correos; deja el expediente preparado.</span></label>}
    {guided && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><h3 className="text-sm font-bold text-neutral-900">Cambio de etapa</h3><p className="mt-2 text-sm leading-relaxed text-neutral-600">{canEdit ? 'Enviar a revisión cierra la edición de campo. Los cambios y las evidencias deben estar guardados antes de continuar.' : 'El acta de campo está cerrada. Podés completar el informe técnico; los datos de campo requieren una devolución expresa.'}</p><div className="mt-4 flex flex-wrap gap-3">
      {inspection.estado === 'EN_REVISION' && isAdmin && <Button variant="outline" onClick={() => transition('EN_CAMPO')} disabled={!isOnline || Boolean(staleDraft) || transitionMutation.isPending}>Devolver a campo</Button>}
      {primaryAction && <Button aria-label={primaryAction.label} aria-describedby={primaryAction.state === 'NOTIFICADA' ? 'approval-readiness-hint' : undefined} leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft) || (primaryAction.state === 'NOTIFICADA' && (!plazoRespuestaAt || approvalBlocked))}>{primaryAction.label}</Button>}
    </div></div>}
    <InspectionReport inspection={draftInspection} readiness={canEdit ? undefined : dossierReadiness || undefined} />
  </>;
  const steps: InspectionWorkspaceStep[] = guided ? [
    { id: 'resumen', label: 'Preparar la inspección', title: 'Preparar la inspección', description: 'Confirmá a quién vas a inspeccionar, dónde y con qué número de acta.', detail: numeroActa || 'Acta sin numerar', complete: Boolean(numeroActa.trim() && ubicacion.trim()), content: context, nextAction: primaryAction?.state === 'EN_CAMPO' ? <Button leftIcon={<ShieldCheck size={17} />} isLoading={changingStage} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft)} onClick={async () => { if (await transition('EN_CAMPO')) navigate({ pathname: location.pathname, search: location.search, hash: '#declaracion' }); }}>Iniciar y continuar</Button> : undefined },
    { id: 'declaracion', label: 'Declarado vs. verificado', title: 'Declarado vs. verificado', description: 'Revisá lo declarado y anotá lo que encontrás en campo.', detail: reviewedComparisons + ' de ' + comparisons.length + ' contrastados', complete: comparisons.length > 0 && reviewedComparisons === comparisons.length, anchors: orderedComparisons.map((row) => ({ id: row.codigo, label: row.etiqueta, group: row.categoria, reviewed: row.resultado !== 'PENDIENTE', detail: row.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (COMPARISON_RESULT_LABELS[row.resultado] || row.resultado) })), content: <InspectionComparisonPanel embedded inspectionId={inspection.id} comparisons={comparisons} editable={canEdit} onSave={save} saving={savingDraft} saveStatus={saveStatus} saveDisabled={saveDisabled} onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} /> },
    { id: 'checklist', label: 'Checklist regulatorio', title: 'Checklist regulatorio', description: 'Verificá cada control por separado. Abrilo para indicar el resultado, comentar y adjuntar fotos.', detail: completed + ' de ' + items.length + ' controles', complete: items.length > 0 && completed === items.length, anchors: orderedItems.map((item) => ({ id: item.codigo, label: item.etiqueta, group: item.categoria, reviewed: item.resultado !== 'PENDIENTE', detail: item.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (RESULTS.find((result) => result.value === item.resultado)?.label || item.resultado) })), content: <Checklist inspectionId={inspection.id} groups={groups} items={items} completed={completed} editable={canEdit} setItems={setItems} onSave={save} saving={savingDraft} saveStatus={saveStatus} saveDisabled={saveDisabled} uploadingItemId={uploadingItemId} pendingEvidence={pendingEvidence} onEvidence={(file, item) => upload(file, { itemId: item.id, descripcion: item.observacion?.trim() || 'Evidencia vinculada al control ' + item.codigo })} onAnnul={annulEvidence} /> },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Todas las evidencias del expediente. Las fotos de un hallazgo se agregan desde su control.', detail: pendingEvidence.length ? pendingEvidence.length + ' por sincronizar' : inspection.evidencias.filter((entry) => !entry.anuladaAt).length + ' archivos', content: evidence },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registrá lo constatado, quién intervino y las formalidades. Una negativa o imposibilidad se documenta; no se presume.', detail: canEdit ? 'Registro de campo' : 'Campo cerrado · consulta', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Fundamentá la evaluación. Este documento complementa el acta de campo y no la reemplaza.', detail: reportCompleted + ' de 5 apartados' + (reportCompleted === 5 && !informeTecnico.expedienteElectronico?.trim() ? ' · falta expediente electrónico' : ''), complete: reportCompleted === 5 && Boolean(informeTecnico.expedienteElectronico?.trim()), content: report },
    { id: 'revision', label: 'Revisar y enviar', title: 'Revisar y enviar', description: 'Verificá los pendientes y el informe consolidado antes de cambiar de etapa. Recorrer los pasos no aprueba ni envía la inspección.', detail: LABELS[inspection.estado], complete: dossierReadiness?.ready, content: readiness },
  ] : [
    { id: 'resumen', label: 'Resultado de la inspección', title: 'Resultado de la inspección', description: 'Hallazgos, controles y documentación del expediente.', detail: LABELS[inspection.estado], content: <>{context}<InspectionReport inspection={draftInspection} readiness={dossierReadiness || undefined} /></> },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registro de campo cerrado. Consulta de los hechos y formalidades.', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Evaluación técnica que acompaña el acta.', content: report },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Archivos y fotografías, conservando su relación con los hallazgos.', content: evidence },
  ];
  const reference: InspectionWorkspaceStep[] = [
    ...(showExchangePanel ? [{ id: 'intercambios', label: 'Comunicaciones y respuestas', title: 'Comunicaciones y respuestas', description: 'Intercambios auditados con el inspeccionado y documentación de cada intervención.', content: <InspectionExchangePanel inspectionId={inspection.id} /> }] : []),
    { id: 'trazabilidad', label: 'Trazabilidad', title: 'Trazabilidad', description: 'Quién hizo cada intervención, cuándo y con qué documentación.', content: <InspectionTimeline inspection={inspection} canComment={Boolean(isAdmin)} busy={eventMutation.isPending} onAdd={async (input, file) => { try { await eventMutation.mutateAsync({ input, file }); toast.success('Registro actualizado', input.tipo === 'NOTIFICACION_PREPARADA' ? 'Borrador de notificación registrado como no enviado.' : 'Nota interna incorporada.'); } catch (error: unknown) { toast.error('No se pudo registrar', inspectionErrorMessage(error, 'Revise los datos.')); throw error; } }} /> },
    { id: 'verificacion', label: 'Verificación QR', title: 'Verificación QR', description: 'Referencia verificable de la versión registrada en el servidor.', content: <InspectionVerificationBlock verification={inspection.verificacion} /> },
  ];
  return <div className={'min-w-0 space-y-4 ' + (hasMobileNav ? 'pb-20 sm:pb-0' : '')}>
    <header className="space-y-3">
      <button onClick={() => { flushDraft(); navigate((mobile ? '/mobile' : '') + '/inspecciones'); }} className="flex min-h-10 w-fit items-center gap-2 rounded-lg px-1 text-sm font-semibold text-neutral-600 hover:text-primary-700"><ArrowLeft size={17} />Volver al listado</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">{inspection.numero}</h1><Badge color={COLORS[inspection.estado] || 'neutral'} dot>{LABELS[inspection.estado]}</Badge></div>
          {actor && <Link to={actorRoute} onClick={flushDraft} aria-label={'Abrir actor inspeccionado: ' + actor.razonSocial} className="mt-1.5 block w-fit rounded-sm text-sm font-semibold text-neutral-700 !no-underline hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{actor.razonSocial}</Link>}
          <p className="mt-1 text-xs text-neutral-500">Actualizada {inspectionDate(inspection.updatedAt, true)} · Versión {inspection.version}</p>
        </div>
        <DropdownMenu><DropdownTrigger asChild><Button variant="outline" size="sm" leftIcon={<Download size={16} />} rightIcon={<ChevronDown size={14} />} isLoading={pdfMutation.isPending}>Exportar</Button></DropdownTrigger><DropdownContent className="w-72"><DropdownLabel>Documentos del expediente</DropdownLabel><DropdownItem icon={<ClipboardCheck size={16} />} onClick={() => pdfMutation.mutate('acta')}>Acta de inspección<span className="block text-[11px] font-normal text-neutral-500">Registro de campo</span></DropdownItem><DropdownItem icon={<FileText size={16} />} onClick={() => pdfMutation.mutate('informe-tecnico')}>Informe técnico<span className="block text-[11px] font-normal text-neutral-500">Evaluación para dictamen</span></DropdownItem></DropdownContent></DropdownMenu>
      </div>
    </header>
    {guided && draftOwnership.status !== 'owned' && <div role="status" data-testid="inspection-editor-ownership" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-bold">{draftOwnership.status === 'blocked' ? 'Otra pestaña está editando este expediente' : draftOwnership.status === 'checking' ? 'Comprobando la edición segura…' : 'Edición no disponible en este navegador'}</p>
      <p>{draftOwnership.status === 'blocked' ? 'Esta vista es de consulta para no sobrescribir tu trabajo. Cerrá la otra pestaña y reintentá aquí.' : draftOwnership.status === 'checking' ? 'Podés recorrer el expediente mientras se verifica que ninguna otra pestaña esté editando.' : 'Para proteger el borrador, usá un navegador actualizado con soporte de bloqueo entre pestañas. Los datos guardados no se borraron.'}</p>
      {draftOwnership.status !== 'checking' && <Button variant="outline" onClick={draftOwnership.retry}>Reintentar edición</Button>}
    </div>}
    {pendingEvidenceReadFailed && guided && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>No se confirmó la lectura de las capturas locales. El cambio de etapa queda bloqueado.</p><button type="button" className="mt-2 min-h-11 font-semibold" onClick={() => void refreshPendingEvidence().catch(() => toast.error('Cola local no disponible', 'Conservá tus archivos originales y no cierres la pantalla.'))}>Reintentar lectura de capturas</button></div>}
    {(!isOnline || pendingEvidence.length > 0 || storageFailed) && <div role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2">{isOnline ? <CloudUpload size={18} className="shrink-0" /> : <CloudOff size={18} className="shrink-0" />}{storageFailed ? 'No hay copia local confirmada; no cierres esta pantalla. Guardá en el servidor con conexión.' : !isOnline ? 'Sin conexión · revisá la confirmación de guardado local junto a cada comentario. Las capturas pendientes se muestran por separado.' : pendingEvidence.length + ' capturas pendientes de sincronización'}</span>{isOnline && pendingEvidence.length > 0 && <button type="button" onClick={() => void syncEvidence(true)} disabled={syncingEvidence || !canWriteDraft()} className="min-h-11 w-fit rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold disabled:opacity-60">{syncingEvidence ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}</div>}
    {recording && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800"><span>Grabando audio de campo</span><Button variant="danger" size="sm" onClick={toggleRecording} leftIcon={<Square size={14} />}>Detener grabación</Button></div>}
    {staleDraft && <StaleDraftNotice serverVersion={inspection.version} draftVersion={staleDraft.version} onRecover={recoverStaleDraft} onDiscard={discardStaleDraft} />}
    <fieldset disabled={savingDraft || syncingEvidence || changingStage} className="min-w-0"><InspectionWorkspace steps={steps} reference={reference} guided={guided} defaultStep={canEditReport && !canEdit ? 'informe-tecnico' : 'resumen'} onBeforeNavigate={flushDraft} saveAction={guided && saveStatus.tone !== 'success' ? <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2"><DraftSaveFeedback status={saveStatus} /><Button variant="outline" leftIcon={<Save size={16} />} isLoading={savingDraft} disabled={saveDisabled} onClick={() => { void save(); }}>{canEdit ? 'Guardar cambios' : 'Guardar informe'}</Button></div> : undefined} /></fieldset>
    <input ref={cameraRef} aria-label="Tomar foto general" type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" className="hidden" onChange={uploadFromInput} />
    <input ref={fileRef} aria-label="Adjuntar archivo general" type="file" accept={INSPECTION_EVIDENCE_ACCEPT} className="hidden" onChange={uploadFromInput} />
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

/** Mirrors EN_REVISION transition guards; approval and legal readiness belong to the following stage. */
export function FieldReadinessPanel({ state, items, comparisons, pendingEvidenceCount }: {
  state: InspectionState;
  items: Pick<InspectionItem, 'obligatorio' | 'resultado'>[];
  comparisons: Pick<InspectionComparison, 'resultado'>[];
  pendingEvidenceCount: number;
}) {
  const checks = [
    { ready: state === 'EN_CAMPO', label: 'Inspección iniciada en campo' },
    { ready: items.every((item) => !item.obligatorio || item.resultado !== 'PENDIENTE'), label: 'Checklist obligatorio completo' },
    { ready: comparisons.length > 0 && comparisons.every((row) => row.resultado !== 'PENDIENTE'), label: 'Todos los datos declarados contrastados' },
    { ready: pendingEvidenceCount === 0, label: 'Sin capturas pendientes de sincronizar' },
  ];
  const complete = checks.filter((check) => check.ready).length;
  const ready = complete === checks.length;
  return <section data-testid="inspection-field-readiness" aria-live="polite" className={`rounded-xl border p-4 sm:p-5 ${ready ? 'border-success-200 bg-success-50' : 'border-amber-300 bg-amber-50'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-extrabold text-[#10213A]">Preparación para enviar a revisión</h3><p className="mt-2 text-sm leading-relaxed text-neutral-700">{ready ? 'Los controles previos al envío están completos. Revisá el acta y sus evidencias antes de cerrar la edición de campo.' : 'Completá estos controles para enviar el trabajo de campo a revisión administrativa.'}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-800">{complete}/{checks.length} completos</span></div>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map((check) => <li key={check.label} className="flex items-start gap-2 rounded-lg bg-white/80 p-3 text-xs font-semibold text-neutral-800">{check.ready ? <Check size={15} className="shrink-0 text-success-700" /> : <CircleMinus size={15} className="shrink-0 text-amber-700" />}<span>{check.label}</span></li>)}</ul>
    <p className="mt-3 text-xs leading-relaxed text-neutral-700">El cierre de campo se registra al confirmar el envío. El plazo de respuesta y la aprobación documental corresponden a la etapa siguiente; enviar a revisión no notifica al inspeccionado.</p>
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
function DraftSaveFeedback({ status }: { status: DraftSaveStatus }) {
  const color = status.tone === 'error' ? 'text-error-800' : status.tone === 'warning' ? 'text-warning-900' : status.tone === 'success' ? 'text-success-800' : 'text-neutral-600';
  return <p role="status" aria-live="polite" className={'text-xs leading-relaxed ' + color}>{status.message}</p>;
}

function Checklist({ inspectionId, groups, items, completed, editable, setItems, uploadingItemId, pendingEvidence, onEvidence, onAnnul, onSave, saving, saveStatus, saveDisabled }: { inspectionId: string; groups: string[]; items: InspectionItem[]; completed: number; editable: boolean; setItems: React.Dispatch<React.SetStateAction<InspectionItem[]>>; uploadingItemId: string | null; pendingEvidence: PendingInspectionEvidence[]; onEvidence: (file: File, item: InspectionItem) => void; onAnnul: (evidenceId: string, reason: string) => Promise<void>; onSave: () => Promise<boolean>; saving: boolean; saveStatus: DraftSaveStatus; saveDisabled: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nonCompliant = items.filter((item) => item.resultado === 'NO_CUMPLE').length;
  const orderedItems = groups.flatMap((group) => items.filter((item) => item.categoria === group));
  const [expandedItem, setExpandedItem] = useState<string>();
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.split('/')[1] || ''); } catch { /* invalid anchors do not discard the draft */ }
  const linkedItem = location.hash.startsWith('#checklist/') ? items.find((item) => item.codigo === linkedCode) : undefined;
  const linkedItemId = linkedItem?.id;
  const activeItem = linkedItem?.id ?? expandedItem ?? items.find((item) => item.resultado === 'PENDIENTE')?.id ?? items[0]?.id;
  const remaining = orderedItems.filter((item) => item.resultado === 'PENDIENTE');
  const nextPendingAfter = (item?: InspectionItem) => {
    const position = item ? orderedItems.indexOf(item) : -1;
    return orderedItems.slice(position + 1).find((entry) => entry.resultado === 'PENDIENTE')
      || orderedItems.slice(0, position).find((entry) => entry.resultado === 'PENDIENTE');
  };
  const itemStatus = (item: InspectionItem) => item.resultado === 'PENDIENTE' ? 'Pendiente' : item.resultado === 'CUMPLE' ? 'Revisado · Cumple' : item.resultado === 'NO_CUMPLE' ? 'Revisado · No cumple' : 'Revisado · No aplica';
  const openControl = (item?: InspectionItem) => {
    setExpandedItem(item?.id || '');
    navigate({ pathname: location.pathname, search: location.search, hash: item ? '#checklist/' + encodeURIComponent(item.codigo) : '#checklist' }, { replace: true });
  };
  useEffect(() => {
    if (!linkedItemId) return;
    const frame = requestAnimationFrame(() => document.getElementById('control-' + linkedItemId)?.scrollIntoView?.({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [linkedItemId, location.hash]);
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);
  const updateItem = (id: string, patch: Partial<InspectionItem>) => setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  return <section className="rounded-xl border border-neutral-200 bg-white">
    <div className="border-b border-neutral-200 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-neutral-700">{completed} de {items.length} revisados</p>
        {nonCompliant > 0 && <span className="shrink-0 rounded-full bg-error-50 px-2.5 py-1 text-xs font-bold text-error-700">{nonCompliant} {nonCompliant === 1 ? 'no cumple' : 'no cumplen'}</span>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-600 transition-[width] duration-200" style={{ width: `${Math.round((completed / Math.max(1, items.length)) * 100)}%` }} /></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold text-neutral-700">Ir a un control<select aria-label="Ir a un control" value={activeItem || ''} onChange={(event) => openControl(items.find((item) => item.id === event.target.value))} className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-sm font-normal"><option value="">Índice de controles</option>{groups.map((group) => <optgroup key={group} label={group}>{items.filter((item) => item.categoria === group).map((item) => <option key={item.id} value={item.id}>{orderedItems.indexOf(item) + 1}. {item.codigo} · {itemStatus(item)} · {item.etiqueta}</option>)}</optgroup>)}</select></label>
        <Button variant="outline" disabled={!nextPendingAfter(items.find((item) => item.id === activeItem))} onClick={() => openControl(nextPendingAfter(items.find((item) => item.id === activeItem)))}>{nextPendingAfter(items.find((item) => item.id === activeItem)) ? 'Ir al siguiente pendiente (' + remaining.length + ')' : remaining.length ? 'Último control pendiente' : 'Todos revisados'}</Button>
      </div>
    </div>
    {groups.map((group) => {
      const groupItems = items.filter((item) => item.categoria === group);
      const groupCompleted = groupItems.filter((item) => item.resultado !== 'PENDIENTE').length;
      const groupFails = groupItems.filter((item) => item.resultado === 'NO_CUMPLE').length;
      return <div key={group} className="border-b border-neutral-200 last:border-0">
        <div style={{ top: 'var(--inspection-middle-top, 0px)' }} className="sticky z-10 flex min-h-11 items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 sm:px-6">
          <p className="font-bold text-[#10213A]">{group}</p>
          <div className="text-right text-xs font-semibold text-neutral-600"><span>{groupCompleted}/{groupItems.length} revisados</span><span className={groupCompleted === groupItems.length ? 'text-success-800' : 'text-warning-800'}> · {groupItems.length - groupCompleted} pendientes</span>{groupFails > 0 && <span className="text-error-800"> · {groupFails} {groupFails === 1 ? 'no cumple' : 'no cumplen'}</span>}</div>
        </div>
        {groupItems.map((item) => {
          const isFail = item.resultado === 'NO_CUMPLE';
          const itemEvidence = [...(item.evidencias || [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
          const itemEvidenceExpanded = expandedEvidence.includes(item.id);
          const visibleItemEvidence = itemEvidenceExpanded ? itemEvidence : itemEvidence.slice(0, 4);
          const pendingItemEvidence = pendingEvidence.filter((evidence) => evidence.fields.itemId === item.id);
          const showObservation = isFail || Boolean(item.observacion) || itemEvidence.length > 0 || pendingItemEvidence.length > 0 || expandedNotes.includes(item.id);
          const expanded = activeItem === item.id;
          const inlineSave = editable && <div data-testid={'inspection-item-save-' + item.id} className="mt-3 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><DraftSaveFeedback status={saveStatus} /><Button leftIcon={<Save size={16} />} isLoading={saving} disabled={saveDisabled} onClick={() => { void onSave(); }}>Guardar cambios</Button></div>{pendingItemEvidence.length > 0 && <p className="text-xs font-semibold text-warning-900">{pendingItemEvidence.length} {pendingItemEvidence.length === 1 ? 'foto pendiente' : 'fotos pendientes'} de sincronizar.</p>}</div>;
          return <div key={item.id} id={'control-' + item.id} data-inspection-anchor={'checklist/' + item.codigo} data-result={item.resultado} style={{ scrollMarginTop: 'var(--inspection-anchor-offset, 8rem)' }} className={`border-t border-neutral-100 px-3 py-1 first:border-0 sm:px-5 ${isFail ? 'border-l-[3px] border-l-error-500 bg-error-50/30' : ''}`}>
            <button type="button" aria-expanded={expanded} aria-controls={'control-detail-' + item.id} onClick={() => openControl(expanded ? undefined : item)} className="flex min-h-16 w-full items-start gap-3 rounded-lg py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.resultado === 'CUMPLE' ? 'bg-success-100 text-success-700' : isFail ? 'bg-error-100 text-error-700' : item.resultado === 'NO_APLICA' ? 'bg-neutral-200 text-neutral-700' : 'border border-neutral-300 bg-white text-neutral-600'}`}>{item.resultado === 'CUMPLE' ? <Check size={16} /> : isFail ? <XCircle size={16} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={16} /> : <span className="text-xs font-bold">{orderedItems.indexOf(item) + 1}</span>}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-relaxed text-[#10213A]">{item.etiqueta}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-neutral-500">{item.codigo}</span><span data-testid={'inspection-item-status-' + item.id} className={'rounded-md px-2 py-1 text-xs font-semibold ' + (item.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-900' : isFail ? 'bg-error-50 text-error-800' : item.resultado === 'CUMPLE' ? 'bg-success-50 text-success-800' : 'bg-neutral-100 text-neutral-700')}>{itemStatus(item)}</span>{item.observacion && <span className="text-xs text-neutral-600">Observación</span>}{itemEvidence.length + pendingItemEvidence.length > 0 && <span className="text-xs text-neutral-600">{itemEvidence.length + pendingItemEvidence.length} adjuntos</span>}</div></div>
              {expanded ? <ChevronUp size={17} className="mt-1 shrink-0 text-neutral-500" /> : <ChevronDown size={17} className="mt-1 shrink-0 text-neutral-500" />}
            </button>
            {expanded && <div id={'control-detail-' + item.id} className="pb-5 pl-0 sm:pl-10">
              <div role="group" aria-label={`Validación: ${item.etiqueta}`} className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {RESULTS.map((option) => {
                  const selected = item.resultado === option.value;
                  return <button key={option.value} type="button" disabled={!editable} aria-pressed={selected} onClick={() => updateItem(item.id, { resultado: option.value })} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}>{option.icon}<span>{option.label}</span></button>;
                })}
              </div>
              {!showObservation && editable && <button type="button" onClick={() => setExpandedNotes((ids) => [...ids, item.id])} className="mt-2 min-h-11 rounded-md px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Agregar observación o foto</button>}
              {showObservation && <div className={`mt-3 border-l-2 pl-3 ${isFail ? 'border-error-300' : 'border-neutral-300'}`}>
                <label><span className={`mb-1 block text-xs font-bold ${isFail ? 'text-error-800' : 'text-neutral-700'}`}>{isFail ? 'Hallazgo y acción requerida' : 'Observación registrada'}</span><textarea disabled={!editable} aria-label={`Observación: ${item.etiqueta}`} value={item.observacion || ''} onChange={(event) => updateItem(item.id, { observacion: event.target.value })} rows={2} placeholder={isFail ? 'Describa qué no cumple, la evidencia y qué debe corregirse' : 'Observación del control'} className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ${isFail ? 'border-error-200 focus:border-error-500 focus:ring-error-100' : 'border-neutral-300 focus:border-primary-600 focus:ring-primary-100'}`} /></label>
                {inlineSave}
                {itemEvidence.length > 0 && <div className="mt-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleItemEvidence.map((evidence) => <EvidenceTile key={evidence.id} inspectionId={inspectionId} evidence={evidence} editable={editable} onAnnul={onAnnul} />)}</div>{itemEvidence.length > 4 && <button type="button" onClick={() => setExpandedEvidence((ids) => itemEvidenceExpanded ? ids.filter((id) => id !== item.id) : [...ids, item.id])} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{itemEvidenceExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{itemEvidenceExpanded ? 'Mostrar menos' : `Ver las ${itemEvidence.length} evidencias`}</button>}</div>}
                {pendingItemEvidence.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{pendingItemEvidence.map((evidence) => <PendingEvidenceThumbnail key={evidence.id} evidence={evidence} />)}</div>}
                {editable && <div className="mt-3 flex flex-wrap gap-2">
                  <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-300 hover:bg-primary-100'}`}>
                    {uploadingItemId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    {uploadingItemId === item.id ? 'Subiendo…' : 'Tomar foto'}
                    <input aria-label={`Tomar foto: ${item.etiqueta}`} type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                  <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-neutral-300 bg-white text-neutral-800 hover:border-primary-300 hover:bg-primary-50'}`}>
                    <Paperclip size={16} />
                    Elegir imagen
                    <input aria-label={`Adjuntar foto: ${item.etiqueta}`} type="file" accept={INSPECTION_PHOTO_ACCEPT} disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                </div>}
                {editable && <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">Máximo 25 MB. La foto quedará vinculada a este control.</p>}
              </div>}
              {!showObservation && inlineSave}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3"><a href="#checklist" onClick={(event) => { event.preventDefault(); document.getElementById('checklist')?.scrollIntoView({ block: 'start' }); }} className="rounded-md px-2 py-2 text-xs font-semibold text-neutral-600 !no-underline hover:bg-neutral-100">Volver al índice de controles</a><button type="button" disabled={!nextPendingAfter(item)} onClick={() => openControl(nextPendingAfter(item))} className="min-h-11 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-bold text-primary-800 disabled:bg-neutral-50 disabled:text-neutral-500">{nextPendingAfter(item) ? 'Siguiente pendiente' : remaining.length ? 'Último control pendiente' : 'Checklist revisado'}</button></div>
            </div>}
          </div>;
        })}
      </div>;
    })}
  </section>;
}
export function EvidenceCard({ inspection, pendingEvidence, pendingActions, editable, recording, onCamera, onFile, onAudio, onAnnul }: { inspection: NonNullable<ReturnType<typeof useInspection>['data']>; pendingEvidence: PendingInspectionEvidence[]; pendingActions?: PendingEvidenceActions; editable: boolean; recording: boolean; onCamera: () => void; onFile: () => void; onAudio: () => void; onAnnul: (evidenceId: string, reason: string) => Promise<void> }) {
  const [showAll, setShowAll] = useState(false);
  const activeCount = inspection.evidencias.filter((evidence) => !evidence.anuladaAt).length;
  const visible = showAll ? inspection.evidencias : inspection.evidencias.slice(0, 5);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="hidden text-sm font-semibold text-neutral-700 lg:block">{activeCount} {activeCount === 1 ? 'archivo' : 'archivos'}{pendingEvidence.length ? ` · ${pendingEvidence.length} por sincronizar` : ''}</p>
      {editable && <div className="flex flex-wrap gap-2">
        <Button size="sm" leftIcon={<Camera size={16} />} onClick={onCamera}>Tomar foto</Button>
        {recording ? <Button variant="danger" size="sm" leftIcon={<Square size={15} />} onClick={onAudio}>Detener audio</Button> : <DropdownMenu><DropdownTrigger asChild><Button variant="outline" size="sm" rightIcon={<ChevronDown size={15} />}>Más opciones</Button></DropdownTrigger><DropdownContent align="end"><DropdownItem icon={<Paperclip size={16} />} onClick={onFile}>Elegir archivo</DropdownItem><DropdownItem icon={<Mic size={16} />} onClick={onAudio}>Grabar audio</DropdownItem></DropdownContent></DropdownMenu>}
      </div>}
    </div>
    {inspection.evidencias.length === 0 ? <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">Aún no hay archivos en este expediente.</p> : <div className="space-y-2">{visible.map((evidence) => {
      const linkedItem = evidence.itemId ? inspection.items.find((item) => item.id === evidence.itemId) : null;
      return <div key={evidence.id} className={`overflow-hidden rounded-xl border p-3 ${evidence.anuladaAt ? 'border-neutral-300 bg-neutral-100' : 'border-neutral-200 bg-white'}`}><div className="flex items-center gap-3">{evidence.tipo === 'FOTO' ? <div className="w-20 shrink-0 sm:w-24"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} preview className={`h-20 w-full rounded-lg object-cover ${evidence.anuladaAt ? 'grayscale opacity-60' : ''}`} /></div> : <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${evidence.tipo === 'AUDIO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} ${evidence.anuladaAt ? 'opacity-50' : ''}`}>{evidence.tipo === 'AUDIO' ? <FileAudio size={20} /> : <FileText size={20} />}</span>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`min-w-0 break-words text-sm font-bold ${evidence.anuladaAt ? 'text-neutral-500 line-through' : 'text-[#10213A]'}`}>{evidence.nombreOriginal}</p>{evidence.anuladaAt && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700">Anulada</span>}</div>{linkedItem && <p className="mt-1 w-fit rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-800">Checklist · {linkedItem.codigo}</p>}{evidence.descripcion && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{evidence.descripcion}</p>}<p className="mt-1 text-xs text-neutral-500">{(evidence.bytes / 1024 / 1024).toFixed(1)} MB · {new Date(evidence.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p></div></div>{evidence.anuladaAt && <p className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-neutral-700"><span className="font-bold">Motivo de anulación:</span> {evidence.motivoAnulacion || 'Sin motivo informado'}</p>}{editable && !evidence.anuladaAt && <EvidenceAnnulControl evidence={evidence} onAnnul={onAnnul} />}</div>;
    })}{inspection.evidencias.length > 5 && <button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{showAll ? 'Mostrar menos' : `Ver las ${inspection.evidencias.length} evidencias`}</button>}</div>}
    {pendingEvidence.length > 0 && <section aria-label="Capturas pendientes" className="mt-4"><p className="mb-3 text-sm font-semibold text-amber-950">Cada captura pendiente debe incorporarse o resolverse expresamente antes de cambiar de etapa.</p><div className="grid gap-3 sm:grid-cols-2">{pendingEvidence.map((entry) => <PendingEvidenceThumbnail key={entry.id} evidence={entry} actions={pendingActions} />)}</div></section>}
  </div>;
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

export default InspeccionExpedientePage;

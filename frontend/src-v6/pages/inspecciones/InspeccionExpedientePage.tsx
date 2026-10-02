import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { warmInspectionShell } from '../../services/warmInspectionShell';

import { isAxiosError } from 'axios';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArchiveX, ArrowLeft, Camera, Check, ChevronDown, ChevronUp, CircleMinus, ClipboardCheck, CloudOff, CloudUpload, Download, Eye, FileAudio, FileText, History, Loader2, Mic, Paperclip, Play, RotateCcw, Save, Search, Send, ShieldCheck, Square, Trash2, UserRound, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInspection, useInspectionMutation } from '../../hooks/useInspecciones';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { inspeccionService } from '../../services/inspeccion.service';
import { isOfflineNetworkError } from '../../services/offlineSession';
import { saveInspectionResume } from '../../services/inspectionResume';
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
import { revealInspectionAnchor, preserveInspectionAnchor } from './inspectionScroll';
import { InspectionOrganizationPanel } from './InspectionOrganizationPanel';
import { InspectionVerificationBlock } from './InspectionVerificationBlock';
import { InspectionDocumentsPanel } from './InspectionDocumentsPanel';
import { getInspectionDossierReadiness, type InspectionDossierReadiness } from './inspectionDossierReadiness';
import { inspectionActorRoute, inspectionDate, inspectionErrorMessage, isTrainingActNumber } from './inspectionPresentation';
import { OfflineDictation } from './OfflineDictation';
import { appendDictatedText } from './appendDictatedText';

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
const orderedDraftFields = (fields: InspectionActData | InspectionTechnicalReport) => Object.fromEntries(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)));
// Compare only fields that this form persists; evidence metadata can refresh independently.
const draftFingerprint = (draft: Draft) => JSON.stringify({ observaciones: draft.observaciones, numeroActa: draft.numeroActa, ubicacion: draft.ubicacion, plazoRespuestaAt: draft.plazoRespuestaAt, datosActa: orderedDraftFields(draft.datosActa), informeTecnico: orderedDraftFields(draft.informeTecnico), items: draft.items.map(({ id, resultado, observacion }) => ({ id, resultado, observacion: observacion || null })), comparaciones: draft.comparaciones.map(({ id, resultado, valorObservado, observacion }) => ({ id, resultado, valorObservado: valorObservado || null, observacion: observacion || null })) });
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
const draftFromInspection = (inspection: Inspection): Draft => ({ version: inspection.version, observaciones: inspection.observaciones || '', numeroActa: inspection.numeroActa || '', ubicacion: inspection.ubicacion || '', plazoRespuestaAt: localDate(inspection.plazoRespuestaAt), datosActa: inspection.datosActa || {}, informeTecnico: inspection.informeTecnico || {}, items: inspection.items, comparaciones: inspection.comparaciones || [] });
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const itemResults = new Set<InspectionItemResult>(['PENDIENTE', 'CUMPLE', 'NO_CUMPLE', 'NO_APLICA']);
const comparisonResults = new Set<InspectionComparison['resultado']>(['PENDIENTE', 'COINCIDE', 'DIFIERE', 'NO_VERIFICADO', 'NO_APLICA']);

// Older device drafts can lack checklist arrays. Keep their original localStorage
// value untouched until the inspector explicitly recovers or discards it.
function reconcileStoredDraft(value: unknown, server: Draft): { draft: Draft; compatible: boolean } {
  const source = isRecord(value) ? value : {};
  const itemOverrides = Array.isArray(source.items) ? source.items.filter((entry): entry is Record<string, unknown> => isRecord(entry) && typeof entry.id === 'string' && itemResults.has(entry.resultado as InspectionItemResult)) : [];
  const comparisonOverrides = Array.isArray(source.comparaciones) ? source.comparaciones.filter((entry): entry is Record<string, unknown> => isRecord(entry) && typeof entry.id === 'string' && comparisonResults.has(entry.resultado as InspectionComparison['resultado'])) : [];
  const serverItems = new Map(server.items.map((item) => [item.id, item]));
  const serverComparisons = new Map(server.comparaciones.map((row) => [row.id, row]));
  const items = itemOverrides.flatMap((entry) => {
    const current = serverItems.get(entry.id as string);
    return current ? [{ ...current, resultado: entry.resultado as InspectionItemResult, observacion: typeof entry.observacion === 'string' ? entry.observacion : null }] : [];
  });
  const comparaciones = comparisonOverrides.flatMap((entry) => {
    const current = serverComparisons.get(entry.id as string);
    return current ? [{ ...current, resultado: entry.resultado as InspectionComparison['resultado'], valorObservado: typeof entry.valorObservado === 'string' ? entry.valorObservado : null, observacion: typeof entry.observacion === 'string' ? entry.observacion : null }] : [];
  });
  const draft: Draft = {
    version: typeof source.version === 'number' && Number.isInteger(source.version) ? source.version : server.version,
    observaciones: typeof source.observaciones === 'string' ? source.observaciones : server.observaciones,
    numeroActa: typeof source.numeroActa === 'string' ? source.numeroActa : server.numeroActa,
    ubicacion: typeof source.ubicacion === 'string' ? source.ubicacion : server.ubicacion,
    plazoRespuestaAt: typeof source.plazoRespuestaAt === 'string' ? source.plazoRespuestaAt : server.plazoRespuestaAt,
    datosActa: isRecord(source.datosActa) ? source.datosActa as InspectionActData : server.datosActa,
    informeTecnico: isRecord(source.informeTecnico) ? source.informeTecnico as InspectionTechnicalReport : server.informeTecnico,
    items,
    comparaciones,
  };
  const completeShape = ['observaciones', 'numeroActa', 'ubicacion', 'plazoRespuestaAt'].every((field) => typeof source[field] === 'string')
    && isRecord(source.datosActa) && isRecord(source.informeTecnico)
    && Array.isArray(source.items) && itemOverrides.length === server.items.length && items.length === server.items.length
    && Array.isArray(source.comparaciones) && comparisonOverrides.length === server.comparaciones.length && comparaciones.length === server.comparaciones.length
    && new Set(items.map((item) => item.id)).size === server.items.length
    && new Set(comparaciones.map((row) => row.id)).size === server.comparaciones.length;
  // The server may commit before the tab receives the save acknowledgment.
  // Reopening an identical, complete local copy needs no human reconciliation.
  // Partial legacy drafts and any real field difference still require consent.
  const alreadySaved = completeShape && typeof source.version === 'number'
    && source.version < server.version && draftConflicts(server, draft).length === 0;
  const compatible = completeShape && (source.version === server.version || alreadySaved);
  if (alreadySaved) draft.version = server.version;
  return { draft, compatible };
}

type DraftConflict = { key: string; label: string; serverValue: string; localValue: string };
const conflictValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
function draftConflicts(server: Draft, local: Draft): DraftConflict[] {
  const conflicts: DraftConflict[] = [];
  const add = (key: string, label: string, serverValue: unknown, localValue: unknown) => {
    if (JSON.stringify(serverValue ?? null) === JSON.stringify(localValue ?? null)) return;
    conflicts.push({ key, label, serverValue: conflictValue(serverValue), localValue: conflictValue(localValue) });
  };
  add('field:observaciones', 'Observaciones generales', server.observaciones, local.observaciones);
  add('field:numeroActa', 'Número de acta', server.numeroActa, local.numeroActa);
  add('field:ubicacion', 'Ubicación', server.ubicacion, local.ubicacion);
  add('field:plazoRespuestaAt', 'Plazo de respuesta', server.plazoRespuestaAt, local.plazoRespuestaAt);
  for (const key of new Set([...Object.keys(server.datosActa), ...Object.keys(local.datosActa)])) add(`act:${key}`, `Acta · ${key}`, server.datosActa[key as keyof InspectionActData], local.datosActa[key as keyof InspectionActData]);
  for (const key of new Set([...Object.keys(server.informeTecnico), ...Object.keys(local.informeTecnico)])) add(`report:${key}`, `Informe · ${key}`, server.informeTecnico[key as keyof InspectionTechnicalReport], local.informeTecnico[key as keyof InspectionTechnicalReport]);
  const localItems = new Map(local.items.map((item) => [item.id, item]));
  server.items.forEach((item) => { const saved = localItems.get(item.id); if (saved) add(`item:${item.id}`, `Control · ${item.etiqueta}`, { resultado: item.resultado, observacion: item.observacion || '' }, { resultado: saved.resultado, observacion: saved.observacion || '' }); });
  const localComparisons = new Map(local.comparaciones.map((row) => [row.id, row]));
  server.comparaciones.forEach((row) => { const saved = localComparisons.get(row.id); if (saved) add(`comparison:${row.id}`, `Contraste · ${row.etiqueta}`, { resultado: row.resultado, valor: row.valorObservado || '', observacion: row.observacion || '' }, { resultado: saved.resultado, valor: saved.valorObservado || '', observacion: saved.observacion || '' }); });
  return conflicts;
}

const InspeccionExpedientePage: React.FC = () => {
  const { id = '' } = useParams(); const navigate = useNavigate(); const location = useLocation(); const mobile = location.pathname.startsWith('/mobile'); const { currentUser } = useAuth();
  const query = useInspection(id); const inspection = query.data;
  const [items, setItems] = useState<InspectionItem[]>([]); const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [observaciones, setObservaciones] = useState(''); const [numeroActa, setNumeroActa] = useState(''); const [ubicacion, setUbicacion] = useState(''); const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [datosActa, setDatosActa] = useState<InspectionActData>({}); const [informeTecnico, setInformeTecnico] = useState<InspectionTechnicalReport>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine); const [recording, setRecording] = useState(false); const [dictating, setDictating] = useState(false); const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
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
  const [organizationPending, setOrganizationPending] = useState(false);
  const syncEvidenceRef = useRef<() => Promise<void>>(async () => undefined);
  const saveForSyncRef = useRef<() => Promise<boolean>>(async () => false);
  const evidenceScope = JSON.stringify([String(currentUser?.id || ''), id]);
  const evidenceScopeRef = useRef(evidenceScope);
  evidenceScopeRef.current = evidenceScope;
  useEffect(() => { void warmInspectionShell(); }, []);
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
      const raw = localStorage.getItem(draftKey);
      if (raw !== null) {
        const stored = reconcileStoredDraft(JSON.parse(raw), draft);
        if (stored.compatible) {
          recoveredDraftNeedsSyncRef.current = draftFingerprint(stored.draft) !== draftFingerprint(draft);
          Object.assign(draft, stored.draft);
        } else {
          // Incompatible/older shape stays available for explicit recovery.
          setStaleDraft(stored.draft);
        }
      }
    } catch { setStaleDraft({ ...draft, items: [], comparaciones: [] }); setStorageFailed(true); }
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
      const raw = localStorage.getItem(draftKey);
      if (raw === null) return;
      const saved = reconcileStoredDraft(JSON.parse(raw), draftFromInspection(inspection));
      if (!saved.compatible) { setStaleDraft(saved.draft); return; }
      setItems(saved.draft.items); setComparisons(saved.draft.comparaciones); setObservaciones(saved.draft.observaciones);
      setNumeroActa(saved.draft.numeroActa); setUbicacion(saved.draft.ubicacion); setPlazoRespuestaAt(saved.draft.plazoRespuestaAt);
      setDatosActa(saved.draft.datosActa); setInformeTecnico(saved.draft.informeTecnico);
      setLocalFingerprint(draftFingerprint(saved.draft));
    } catch { setStaleDraft({ ...draftFromInspection(inspection), items: [], comparaciones: [] }); setStorageFailed(true); }
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
  useEffect(() => {
    const protectUpdate = (event: Event) => {
      if (!inspection || !(fieldEditAllowed || reportEditAllowed)) return;
      const update = event as CustomEvent<{ reason?: string }>;
      const dirty = Boolean(serverFingerprint && currentFingerprint !== serverFingerprint);
      const pendingFiles = pendingEvidence.length > 0 || uploadingItemId !== null || syncingEvidence;
      if (!dirty && !pendingFiles && !recording && !dictating && !storageFailed && !staleDraft && !pendingEvidenceReadFailed && !savingDraft && !changingStage) return;
      if (dirty && !staleDraft && currentDraftRef.current && canWriteDraft()) storeDraft(currentDraftRef.current);
      event.preventDefault();
      update.detail.reason = dictating ? 'Detené el dictado antes de actualizar. Las frases reconocidas ya se guardaron como texto.'
        : recording ? 'Detené y guardá el audio antes de actualizar.'
        : storageFailed ? 'No hay copia local confirmada. Guardá con conexión antes de actualizar.'
          : pendingFiles || pendingEvidenceReadFailed ? 'Hay capturas por confirmar. Sincronizalas o resolvé su estado antes de actualizar.'
            : staleDraft ? 'Resolvé el conflicto entre versiones antes de actualizar.'
              : 'Guardá los cambios en el servidor antes de actualizar.';
    };
    window.addEventListener('sitrep:before-app-update', protectUpdate);
    return () => window.removeEventListener('sitrep:before-app-update', protectUpdate);
  }, [inspection, fieldEditAllowed, reportEditAllowed, serverFingerprint, currentFingerprint, pendingEvidence.length, uploadingItemId, syncingEvidence, recording, dictating, storageFailed, staleDraft, pendingEvidenceReadFailed, savingDraft, changingStage, canWriteDraft, storeDraft]);

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
  const pdfMutation = useInspectionMutation(async (kind: 'acta' | 'informe-tecnico' | 'expediente') => inspection && inspeccionService.downloadPdf(id, inspection.numero, kind), id);

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
        toast.success('Archivo protegido en el dispositivo', fields?.itemId
          ? 'Quedó vinculado a este control y se sincronizará al recuperar conexión.'
          : 'Se sincronizará al recuperar conexión.');
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
        evidenceAlreadyPresent ? 'El archivo ya estaba incorporado' : fields?.itemId ? 'Archivo vinculado al control' : 'Evidencia incorporada',
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
  const toggleRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.warning('Audio no disponible', 'El navegador no permite grabar audio.');
      return;
    }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let interrupted = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (!interrupted && event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        interrupted = true;
        stream?.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setRecording(false);
        toast.error('Grabación interrumpida', 'El audio no se guardó. Volvé a grabar.');
      };
      recorder.onstop = async () => {
        if (interrupted) return;
        stream?.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          toast.error('Audio vacío', 'No se capturó sonido. Volvé a grabar antes de salir.');
          return;
        }
        await upload(new File([blob], `audio-inspeccion-${Date.now()}.webm`, { type: blob.type }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      toast.error('No se pudo iniciar el micrófono', 'Revisá los permisos y volvé a intentar.');
    }
  };

  const dossierReadiness = useMemo<InspectionDossierReadiness | null>(() => inspection ? getInspectionDossierReadiness(inspection, {
    numeroActa,
    plazoRespuestaAt,
    observaciones,
    datosActa,
    informeTecnico,
    items,
    comparaciones: comparisons,
  }) : null, [comparisons, datosActa, informeTecnico, inspection, items, numeroActa, observaciones, plazoRespuestaAt]);

  const recoverStaleDraft = (selectedKeys: string[]) => {
    if (!inspection || !staleDraft || !canWriteDraft()) return;
    const selected = new Set(selectedKeys);
    const server = draftFromInspection(inspection);
    const savedItems = new Map((staleDraft.items || []).map((item) => [item.id, item]));
    const savedComparisons = new Map((staleDraft.comparaciones || []).map((row) => [row.id, row]));
    const recoveredItems = inspection.items.map((current) => {
      const saved = savedItems.get(current.id);
      return saved && selected.has(`item:${current.id}`) ? { ...current, resultado: saved.resultado, observacion: saved.observacion } : current;
    });
    const recoveredComparisons = inspection.comparaciones.map((current) => {
      const saved = savedComparisons.get(current.id);
      return saved && selected.has(`comparison:${current.id}`) ? { ...current, resultado: saved.resultado, valorObservado: saved.valorObservado, observacion: saved.observacion } : current;
    });
    const datosActa = { ...server.datosActa };
    for (const [key, value] of Object.entries(staleDraft.datosActa || {})) if (selected.has(`act:${key}`)) (datosActa as Record<string, unknown>)[key] = value;
    const informeTecnico = { ...server.informeTecnico };
    for (const [key, value] of Object.entries(staleDraft.informeTecnico || {})) if (selected.has(`report:${key}`)) (informeTecnico as Record<string, unknown>)[key] = value;
    const recovered: Draft = {
      version: inspection.version,
      observaciones: selected.has('field:observaciones') ? staleDraft.observaciones || '' : server.observaciones,
      numeroActa: selected.has('field:numeroActa') ? staleDraft.numeroActa || '' : server.numeroActa,
      ubicacion: selected.has('field:ubicacion') ? staleDraft.ubicacion || '' : server.ubicacion,
      plazoRespuestaAt: selected.has('field:plazoRespuestaAt') ? staleDraft.plazoRespuestaAt || '' : server.plazoRespuestaAt,
      datosActa,
      informeTecnico,
      items: recoveredItems,
      comparaciones: recoveredComparisons,
    };
    setObservaciones(recovered.observaciones); setNumeroActa(recovered.numeroActa); setUbicacion(recovered.ubicacion); setPlazoRespuestaAt(recovered.plazoRespuestaAt); setDatosActa(recovered.datosActa); setInformeTecnico(recovered.informeTecnico); setItems(recovered.items); setComparisons(recovered.comparaciones);
    storeDraft(recovered);
    setStaleDraft(null);
    toast.warning('Conflicto conciliado', selected.size ? `${selected.size} cambios del dispositivo quedaron listos para revisar y guardar.` : 'Se mantuvo la versión del servidor.');
  };

  const discardStaleDraft = () => {
    if (!canWriteDraft()) return;
    if (draftKey) localStorage.removeItem(draftKey);
    setStaleDraft(null);
    toast.info('Borrador anterior descartado', 'Se conserva la versión actualmente registrada en el servidor.');
  };

  if (query.isLoading) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente…</p>;
  if (query.isError) {
    const status = isAxiosError(query.error) ? query.error.response?.status : undefined;
    const offlineMissing = isOfflineNetworkError(query.error);
    const title = status === 404 ? 'Expediente no encontrado' : status === 403 ? 'Sin acceso a este expediente' : offlineMissing ? 'Sin conexión y sin copia local' : 'No se pudo abrir el expediente';
    const detail = status === 404 ? 'Comprobá el enlace o regresá al listado.' : status === 403 ? 'Tu cuenta no tiene permiso para consultar esta inspección.' : offlineMissing ? 'Para usarlo sin conexión, primero abrí el expediente en este dispositivo mientras tengas red.' : 'No se pudo recuperar la información. El trabajo guardado en este dispositivo no fue eliminado.';
    return <Card role="alert" className="mx-auto max-w-xl p-6"><h2 className="text-lg font-bold text-neutral-900">{title}</h2><p className="mt-2 text-sm text-neutral-600">{detail}</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void query.refetch()}>Reintentar</Button><Button variant="outline" onClick={() => navigate((mobile ? '/mobile' : '') + '/inspecciones')}>Volver al listado</Button></div></Card>;
  }
  if (!inspection) return <Card><p className="font-semibold text-neutral-900">Inspección no encontrada</p></Card>;
  const actor = inspectionActor(inspection);
  const inspectionType = inspectionTypeOf(inspection);
  const environmentalInspection = inspectionType === 'PETROLEO' || inspectionType === 'AIRE';
  const actorRoute = actor ? inspectionActorRoute(inspection.tipoActor, actor.id, mobile) : '';
  const completed = items.filter((item) => item.resultado !== 'PENDIENTE').length; const groups = Array.from(new Set(items.map((item) => item.categoria)));
  const fieldCategoryPriority = ['Establecimiento', 'Gestion de residuos', 'Residuos', 'Operacion', 'Operación', 'Flota', 'Seguridad', 'Trazabilidad', 'Habilitacion', 'Habilitación', 'Documentacion', 'Documentación', 'Actividad', 'Identidad', 'Contacto'];
  const categoryPosition = (category: string) => {
    const index = fieldCategoryPriority.indexOf(category);
    return index < 0 ? fieldCategoryPriority.length : index;
  };
  const comparisonGroups = Array.from(new Set(comparisons.map((row) => row.categoria))).sort((left, right) => categoryPosition(left) - categoryPosition(right));
  const orderedComparisons = comparisonGroups.flatMap((group) => comparisons.filter((row) => row.categoria === group));
  const fieldGroups = [...groups].sort((left, right) => categoryPosition(left) - categoryPosition(right));
  const orderedItems = fieldGroups.flatMap((group) => items.filter((item) => item.categoria === group));
  const primaryAction = inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA' ? { label: 'Iniciar inspección', state: 'EN_CAMPO' as InspectionState } : inspection.estado === 'EN_CAMPO' ? { label: 'Enviar a revisión', state: 'EN_REVISION' as InspectionState } : inspection.estado === 'EN_REVISION' && isAdmin && inspection.tipoActor ? { label: 'Aprobar expediente', state: 'NOTIFICADA' as InspectionState } : null;
  const showExchangePanel = !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'CANCELADA'].includes(inspection.estado);
  const approvalBlocked = inspection.estado === 'EN_REVISION' && (!dossierReadiness?.ready || Boolean(staleDraft));
  const guided = fieldEditAllowed || reportEditAllowed;
  const reviewedComparisons = comparisons.filter((row) => row.resultado !== 'PENDIENTE').length;
  const reportFields = [informeTecnico.objetivo, informeTecnico.antecedentes, informeTecnico.evaluacion, informeTecnico.conclusion, informeTecnico.recomendacion];
  const reportCompleted = reportFields.filter((value) => value?.trim()).length;
  const flushDraft = () => {
    if (!draftKey || !guided || staleDraft || !canWriteDraft()) return true;
    if (currentDraftRef.current && !storeDraft(currentDraftRef.current)) {
      toast.warning('No se pudo guardar en este dispositivo', 'No cierre la pantalla. Guardá en el servidor antes de salir de la inspección.');
      return currentFingerprint === serverFingerprint;
    }
    return true;
  };
  const saveStatus: DraftSaveStatus = guided && draftOwnership.status !== 'owned'
    ? { tone: 'neutral', message: draftOwnership.status === 'blocked' ? 'Solo consulta: otra pestaña tiene el borrador.' : draftOwnership.status === 'checking' ? 'Comprobando disponibilidad del borrador…' : 'Edición no disponible en este navegador.' }
    : savingDraft
    ? { tone: 'neutral', message: 'Guardando cambios en el servidor…' }
    : staleDraft
      ? { tone: 'error', message: 'Hay versiones en conflicto. Revisá el borrador anterior antes de guardar.' }
      : currentFingerprint === serverFingerprint
        ? { tone: 'success', message: 'Guardado en servidor.' }
        : storageFailed
          ? { tone: 'error', message: 'No hay copia local confirmada. No cierres esta pantalla; guardá con conexión.' }
          : saveFailed
            ? { tone: 'error', message: 'No se confirmó el guardado. Reintentá; la copia local sigue disponible.' }
            : localFingerprint === currentFingerprint
              ? { tone: 'warning', message: 'Solo en este dispositivo · falta guardar en servidor.' }
              : { tone: 'warning', message: 'Falta guardar en servidor.' };
  const saveDisabled = !canWriteDraft() || Boolean(staleDraft) || syncingEvidence || changingStage;
  const draftInspection = { ...inspection, items, comparaciones: comparisons, informeTecnico, datosActa, numeroActa, ubicacion, observaciones };
  const context = <div className="space-y-6">
    <InspectionOrganizationPanel key={`${inspection.id}:${inspection.version}`} onPendingChange={setOrganizationPending} inspection={inspection} admin={isAdmin} backPath={`${mobile ? '/mobile' : ''}/inspecciones`} disabled={!isOnline || currentFingerprint !== serverFingerprint || Boolean(staleDraft) || pendingEvidence.length > 0 || recording || savingDraft || syncingEvidence || !canWriteDraft()} />
    <div className="grid gap-5 sm:grid-cols-2"><Meta icon={<ClipboardCheck />} label={environmentalInspection ? INSPECTION_TYPES[inspectionType].label : inspection.tipoActor ? 'Actor inspeccionado' : 'Denuncia / hallazgo'} value={actor?.razonSocial || 'Sin responsable identificado'} to={actorRoute || undefined} onNavigate={flushDraft} returnTo={location.pathname + location.search + location.hash} detail={actor?.cuit ? 'CUIT ' + actor.cuit : undefined} /><Meta icon={<UserRound />} label="Inspector" value={inspection.inspector.nombre + ' ' + (inspection.inspector.apellido || '')} /></div>
    <div className="grid gap-5 border-t border-neutral-200 pt-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-neutral-700">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Asignar número" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-normal text-neutral-900 disabled:bg-neutral-50" /></label>
      <label className="text-sm font-semibold text-neutral-700">Ubicación<input disabled={!canEdit} value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Dirección o referencia del lugar" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-normal text-neutral-900 disabled:bg-neutral-50" /></label>
    </div>
    <dl className="grid gap-4 border-t border-neutral-200 pt-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-neutral-500">Programada</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.fechaProgramada, true)}</dd></div><div><dt className="text-xs text-neutral-500">Inicio de campo</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.iniciadaAt, true)}</dd></div></dl>
  </div>;
  const observationLabel = environmentalInspection ? `Registro de ${INSPECTION_TYPES[inspectionType].label.toLocaleLowerCase('es-AR')}` : inspection.tipoActor ? 'Registro de lo observado' : 'Descripción de la denuncia o hallazgo';
  const act = <div className="mx-auto max-w-3xl space-y-6">
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="inspection-observations" className="text-base font-bold text-neutral-900">{observationLabel}</label>
        {canEdit && <OfflineDictation compact active={location.hash.startsWith('#acta')} onActiveChange={setDictating} onText={(text) => { const current = currentDraftRef.current; if (!current) return; const next = { ...current, observaciones: appendDictatedText(current.observaciones, text) }; currentDraftRef.current = next; setObservaciones(next.observaciones); storeDraft(next); }} />}
      </div>
      <textarea id="inspection-observations" disabled={!canEdit} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={4} placeholder="Qué observaste, dónde y en qué condiciones. Podés escribir o dictar." className="block w-full resize-y rounded-lg border border-neutral-400 p-3 text-base font-normal leading-relaxed text-neutral-900 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" />
    </div>
    <InspectionDocumentsPanel actorType={environmentalInspection ? null : inspection.tipoActor} section="acta" actData={datosActa} report={informeTecnico} actEditable={canEdit} reportEditable={false} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />
  </div>;
  const evidence = <EvidenceCard inspection={inspection} pendingEvidence={pendingEvidence} pendingActions={canEdit ? pendingEvidenceActions : undefined} editable={canEdit} recording={recording} onCamera={() => cameraRef.current?.click()} onFile={() => fileRef.current?.click()} onAudio={toggleRecording} onAnnul={annulEvidence} />;
  const report = <InspectionDocumentsPanel section="informe" actData={datosActa} report={informeTecnico} actEditable={false} reportEditable={canEditReport} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />;
  const readiness = <>{canEdit ? <FieldReadinessPanel requiresComparison={Boolean(inspection.tipoActor)} state={inspection.estado} items={items} comparisons={comparisons} pendingEvidenceCount={pendingEvidence.length} /> : inspection.tipoActor && dossierReadiness ? <DossierReadinessPanel readiness={dossierReadiness} /> : null}
    {inspection.tipoActor && (inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && <label className="block text-sm font-semibold text-neutral-700">Plazo de respuesta<input aria-label="Plazo de respuesta" type="datetime-local" value={plazoRespuestaAt} onChange={(event) => setPlazoRespuestaAt(event.target.value)} className="mt-2 h-11 w-full max-w-sm rounded-lg border border-neutral-300 px-3 text-sm" /><span className="mt-2 block text-xs font-normal text-neutral-500">La aprobación no envía correos; deja el expediente preparado.</span></label>}
    {guided && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><h3 className="text-sm font-bold text-neutral-900">{inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'Hallazgo en revisión · sin responsable identificado' : 'Cambio de etapa'}</h3><p role={inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'status' : undefined} className="mt-2 text-sm leading-relaxed text-neutral-600">{canEdit ? 'Enviar a revisión cierra la edición de campo. Los cambios y las evidencias deben estar guardados antes de continuar.' : inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'No hay destinatario para notificar ni plazo que fijar. Podés completar el informe técnico. Si identificás al responsable, devolvé a campo, vinculalo en Visita y contrastá sus datos antes de aprobar.' : 'El acta de campo está cerrada. Podés completar el informe técnico; los datos de campo requieren una devolución expresa.'}</p><div className="mt-4 flex flex-wrap gap-3">
      {inspection.estado === 'EN_REVISION' && isAdmin && canWriteDraft() && <Button variant="outline" onClick={() => transition('EN_CAMPO')} disabled={!isOnline || Boolean(staleDraft) || transitionMutation.isPending}>Devolver a campo</Button>}
      {primaryAction && canWriteDraft() && <Button aria-label={primaryAction.label} aria-describedby={primaryAction.state === 'NOTIFICADA' ? 'approval-readiness-hint' : undefined} leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft) || (primaryAction.state === 'NOTIFICADA' && (!plazoRespuestaAt || approvalBlocked))}>{primaryAction.label}</Button>}
    </div></div>}
    <InspectionReport inspection={draftInspection} readiness={canEdit || !inspection.tipoActor ? undefined : dossierReadiness || undefined} />
  </>;
  const steps: InspectionWorkspaceStep[] = guided ? [
    { id: 'resumen', label: 'Preparar la inspección', title: 'Preparar la inspección', description: 'Confirmá a quién vas a inspeccionar, dónde y con qué número de acta.', detail: numeroActa || 'Acta sin numerar', complete: Boolean(numeroActa.trim() && ubicacion.trim()), content: context, nextAction: primaryAction?.state === 'EN_CAMPO' && canWriteDraft() ? <Button size="lg" className="min-h-14 w-full sm:w-auto" leftIcon={<Play size={22} aria-hidden="true" />} isLoading={changingStage} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft)} onClick={async () => { if (await transition('EN_CAMPO')) navigate({ pathname: location.pathname, search: location.search, hash: inspection.tipoActor ? '#checklist' : '#acta' }); }}>Iniciar visita</Button> : undefined },
    { id: 'checklist', label: 'Recorrido de campo', title: 'Recorrido de campo', description: 'Empezá por instalaciones, residuos u operación; registrá cada hallazgo y su evidencia en el lugar.', detail: completed + ' de ' + items.length + ' controles', complete: items.length > 0 && completed === items.length, anchors: orderedItems.map((item) => ({ id: item.codigo, label: item.etiqueta, group: item.categoria, reviewed: item.resultado !== 'PENDIENTE', detail: item.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (RESULTS.find((result) => result.value === item.resultado)?.label || item.resultado) })), content: <Checklist inspectionId={inspection.id} groups={fieldGroups} items={items} completed={completed} editable={canEdit} setItems={setItems} uploadingItemId={uploadingItemId} pendingEvidence={pendingEvidence} onEvidence={(file, item) => upload(file, { itemId: item.id, descripcion: item.observacion?.trim() || 'Evidencia vinculada al control ' + item.codigo })} onAnnul={annulEvidence} onDictationActiveChange={setDictating} onDictatedText={(itemId, text) => { const current = currentDraftRef.current; if (!current) return; const next = { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, observacion: appendDictatedText(item.observacion || '', text) } : item) }; currentDraftRef.current = next; setItems(next.items); storeDraft(next); }} /> },
    { id: 'declaracion', label: 'Contraste con registros', title: 'Contraste con registros', description: 'Contrastá lo observado con la fotografía declarada. Los datos administrativos quedan al final como contexto.', detail: inspection.tipoActor ? reviewedComparisons + ' de ' + comparisons.length + ' contrastados' : 'Sin declaración vinculada', complete: !inspection.tipoActor || (comparisons.length > 0 && reviewedComparisons === comparisons.length), anchors: orderedComparisons.map((row) => ({ id: row.codigo, label: row.etiqueta, group: row.categoria, reviewed: row.resultado !== 'PENDIENTE', detail: row.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (COMPARISON_RESULT_LABELS[row.resultado] || row.resultado) })), content: !inspection.tipoActor ? <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">Este hallazgo todavía no tiene responsable identificado. Podés registrar lo observado y enviarlo a revisión sin contrastar una declaración. Si identificás al responsable, vinculalo desde «Preparar la inspección»; se incorporarán sus datos declarados.</p> : <InspectionComparisonPanel embedded inspectionId={inspection.id} comparisons={orderedComparisons} declaredDocuments={inspection.declaradoSnapshot?.documents} editable={canEdit} onSave={save} saving={savingDraft} saveStatus={saveStatus} saveDisabled={saveDisabled} onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} /> },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Todas las evidencias del expediente. Las fotos de un hallazgo se agregan desde su control.', detail: pendingEvidence.length ? pendingEvidence.length + ' por sincronizar' : inspection.evidencias.filter((entry) => !entry.anuladaAt).length + ' archivos', content: evidence },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registrá lo constatado, quién intervino y las formalidades. Una negativa o imposibilidad se documenta; no se presume.', detail: canEdit ? 'Registro de campo' : 'Campo cerrado · consulta', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Fundamentá la evaluación. Este documento complementa el acta de campo y no la reemplaza.', detail: reportCompleted + ' de 5 apartados' + (reportCompleted === 5 && !informeTecnico.expedienteElectronico?.trim() ? ' · falta expediente electrónico' : ''), complete: reportCompleted === 5 && Boolean(informeTecnico.expedienteElectronico?.trim()), content: report },
    { id: 'revision', label: inspection.tipoActor ? 'Revisar y enviar' : 'Revisar hallazgo', title: inspection.tipoActor ? 'Revisar y enviar' : 'Revisar hallazgo', description: inspection.tipoActor ? 'Verificá los pendientes y el informe consolidado antes de cambiar de etapa. Recorrer los pasos no aprueba ni envía la inspección.' : 'Conservá el informe y las evidencias. La notificación requiere identificar primero a un destinatario.', detail: LABELS[inspection.estado], complete: Boolean(inspection.tipoActor && dossierReadiness?.ready), content: readiness },
  ] : [
    { id: 'resumen', label: 'Resultado de la inspección', title: 'Resultado de la inspección', description: 'Hallazgos, controles y documentación del expediente.', detail: LABELS[inspection.estado], content: <>{context}<InspectionReport inspection={draftInspection} readiness={dossierReadiness || undefined} /></> },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registro de campo cerrado. Consulta de los hechos y formalidades.', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Evaluación técnica que acompaña el acta.', content: report },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Archivos y fotografías, conservando su relación con los hallazgos.', content: evidence },
  ];
  if (!inspection.tipoActor) {
    const declaration = steps.findIndex((step) => step.id === 'declaracion');
    if (declaration >= 0) steps.splice(declaration, 1);
  }
  const reference: InspectionWorkspaceStep[] = [
    ...(showExchangePanel ? [{ id: 'intercambios', label: 'Comunicaciones y respuestas', title: 'Comunicaciones y respuestas', description: 'Intercambios auditados con el inspeccionado y documentación de cada intervención.', content: <InspectionExchangePanel inspectionId={inspection.id} /> }] : []),
    { id: 'trazabilidad', label: 'Trazabilidad', title: 'Trazabilidad', description: 'Quién hizo cada intervención, cuándo y con qué documentación.', content: <InspectionTimeline inspection={inspection} canComment={Boolean(isAdmin)} busy={eventMutation.isPending} onAdd={async (input, file) => { try { await eventMutation.mutateAsync({ input, file }); toast.success('Registro actualizado', input.tipo === 'NOTIFICACION_PREPARADA' ? 'Borrador de notificación registrado como no enviado.' : 'Nota interna incorporada.'); } catch (error: unknown) { toast.error('No se pudo registrar', inspectionErrorMessage(error, 'Revise los datos.')); throw error; } }} /> },
    { id: 'verificacion', label: 'Verificación QR', title: 'Verificación QR', description: 'Referencia verificable de la versión registrada en el servidor.', content: <InspectionVerificationBlock verification={inspection.verificacion} /> },
  ];
  const fieldSaveStatus: DraftSaveStatus = organizationPending && saveStatus.tone === 'success'
    ? { tone: 'warning', message: 'Organización sin confirmar' }
    : saveStatus;
  const fieldSaveDetail = storageFailed ? 'Conservá esta pantalla abierta.'
    : organizationPending ? 'Usá Confirmar organización antes de salir.'
    : pendingEvidenceReadFailed ? 'Capturas locales sin verificar.'
    : pendingEvidence.length ? `${pendingEvidence.length} capturas por enviar${!isOnline ? ' · sin conexión' : ''}`
      : !isOnline ? 'Sin conexión · podés seguir registrando.'
        : '';
  const pauseFieldWork = () => {
    if (recording || dictating || uploadingItemId || syncingEvidence || savingDraft || changingStage || pendingEvidenceReadFailed) return;
    if (organizationPending && !window.confirm('Los cambios de organización todavía no están guardados. ¿Salir sin confirmarlos? Los datos de campo se conservan por separado.')) return;
    if (!staleDraft && currentDraftRef.current && canWriteDraft() && !storeDraft(currentDraftRef.current)) {
      toast.error('No se pudo proteger el borrador', 'Conservá esta pantalla abierta y guardá con conexión.');
      return;
    }
    // A quick exit can beat the scroll observer. Record the actual open control
    // synchronously, including a control that has just stopped being pending.
    const control = Array.from(document.querySelectorAll<HTMLElement>('[data-inspection-anchor^="checklist/"]'))
      .find((element) => element.getClientRects().length > 0 && element.querySelector('button[aria-expanded="true"]'));
    const anchor = control?.dataset.inspectionAnchor;
    if (anchor && currentUser?.id) {
      const item = items.find((entry) => 'checklist/' + entry.codigo === anchor);
      saveInspectionResume(currentUser.id, inspection.id, '#' + anchor, 'Recorrido de campo · ' + (item?.etiqueta || anchor));
    }
    navigate((mobile ? '/mobile' : '') + '/inspecciones');
  };
  return <div className="inspection-case flex h-full min-h-0 min-w-0 flex-col gap-3">
    <header className="relative flex shrink-0 items-start gap-2">
      <Button variant="ghost" size="sm" aria-label="Volver al listado" title="Volver al listado" leftIcon={<ArrowLeft size={18} />} onClick={() => { if (dictating) return; if (guided && canWriteDraft()) { pauseFieldWork(); return; } if (!flushDraft()) return; navigate((mobile ? '/mobile' : '') + '/inspecciones'); }} disabled={dictating} className="h-11 w-11 shrink-0 px-0"><span className="sr-only">Volver al listado</span></Button>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h1 className="text-base sm:text-2xl font-bold text-neutral-900 break-words">{inspection.numero}</h1><Badge variant="soft" color={COLORS[inspection.estado] || 'neutral'}>{LABELS[inspection.estado]}</Badge>{isTrainingActNumber(inspection.numeroActa) && <Badge color="warning">Capacitación · datos sintéticos</Badge>}</div>
          {actor && <Link to={actorRoute} state={{ inspectionReturn: location.pathname + location.search + location.hash }} onClick={(event) => { if (dictating) { event.preventDefault(); return; } if (!flushDraft()) event.preventDefault(); }} aria-label={'Abrir actor inspeccionado: ' + actor.razonSocial} className="mt-1 block max-w-full rounded-sm break-words text-sm font-semibold text-neutral-700 !no-underline hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{actor.razonSocial}</Link>}
          <p className="mt-1 hidden text-xs text-neutral-500 lg:block">Actualizada {inspectionDate(inspection.updatedAt, true)} · Versión {inspection.version}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" aria-label="Descargar expediente" title="Descargar expediente" className="max-lg:w-11 max-lg:px-0" leftIcon={<Download size={18} />} isLoading={pdfMutation.isPending} onClick={() => pdfMutation.mutate('expediente')}><span className="sr-only lg:not-sr-only">Descargar expediente</span></Button>
          <DropdownMenu>
            <DropdownTrigger asChild><Button variant="ghost" size="sm" aria-label="Otras descargas" rightIcon={<ChevronDown size={16} />} isLoading={pdfMutation.isPending}><span className="sr-only">Documentos por separado</span></Button></DropdownTrigger>
            <DropdownContent className="w-72">
              <DropdownLabel>Versión guardada en el servidor</DropdownLabel>
              <DropdownItem icon={<FileText size={16} />} onClick={() => pdfMutation.mutate('expediente')}>Expediente completo · PDF<span className="block text-[11px] font-normal text-neutral-500">Acta, evaluación y fotos en un documento</span></DropdownItem>
              <DropdownLabel>Documentos por separado</DropdownLabel>
              <DropdownItem icon={<ClipboardCheck size={16} />} onClick={() => pdfMutation.mutate('acta')}>Acta de inspección<span className="block text-[11px] font-normal text-neutral-500">Registro de campo</span></DropdownItem>
              <DropdownItem icon={<FileText size={16} />} onClick={() => pdfMutation.mutate('informe-tecnico')}>Informe técnico<span className="block text-[11px] font-normal text-neutral-500">Evaluación para dictamen</span></DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    {(query.offlineCacheProblem || (guided && draftOwnership.status !== 'owned') || (pendingEvidenceReadFailed && guided) || !isOnline || pendingEvidence.length > 0 || storageFailed) && <details data-testid="inspection-storage-status" className="rounded-lg border border-neutral-200 bg-white px-4 text-sm">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 font-medium text-neutral-700"><span>{storageFailed ? 'Guardado local no confirmado · no cierres esta pantalla' : guided && draftOwnership.status !== 'owned' ? draftOwnership.status === 'blocked' ? 'Solo lectura · otra pestaña está editando' : draftOwnership.status === 'checking' ? 'Comprobando disponibilidad de edición' : 'Solo lectura · edición no disponible en este navegador' : query.offlineCacheProblem ? 'No se pudo preparar la copia sin conexión.' : pendingEvidenceReadFailed && guided ? 'Capturas locales sin verificar · cierre de campo no disponible' : !isOnline ? 'Sin conexión · trabajando en este dispositivo' : pendingEvidence.length + ' capturas pendientes de enviar'}</span><ChevronDown size={16} className="shrink-0" /></summary>
      <div className="space-y-2 pb-2">
    {query.offlineCacheProblem && <div role="alert" className="border-t border-neutral-200 py-3 text-sm text-amber-950">
      <p className="font-bold">No se pudo preparar la copia sin conexión.</p>
      <p className="mt-1">El expediente está disponible desde SITREP, pero este dispositivo todavía no confirmó su copia local. Antes de trabajar sin señal, cerrá otras pestañas de SITREP y reintentá. No se borraron datos del dispositivo.</p>
      <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Reintentar copia local</Button>
    </div>}
    {guided && draftOwnership.status !== 'owned' && <div role="status" data-testid="inspection-editor-ownership" className="space-y-2 border-t border-neutral-200 py-3 text-sm text-amber-950">
      <p className="font-bold">{draftOwnership.status === 'blocked' ? 'Otra pestaña está editando este expediente' : draftOwnership.status === 'checking' ? 'Comprobando la edición segura…' : 'Edición no disponible en este navegador'}</p>
      <p>{draftOwnership.status === 'blocked' ? 'Esta vista es de consulta para no sobrescribir tu trabajo. Cerrá la otra pestaña y reintentá aquí.' : draftOwnership.status === 'checking' ? 'Podés recorrer el expediente mientras se verifica que ninguna otra pestaña esté editando.' : 'Para proteger el borrador, usá un navegador actualizado con soporte de bloqueo entre pestañas. Los datos guardados no se borraron.'}</p>
      {draftOwnership.status === 'blocked' && <p className="font-semibold">Solo consulta: otra pestaña tiene el borrador. No hay cambios para guardar desde esta vista.</p>}
      {draftOwnership.status !== 'checking' && <Button variant="outline" onClick={draftOwnership.retry}>Reintentar edición</Button>}
    </div>}
    {pendingEvidenceReadFailed && guided && <div role="status" className="border-t border-neutral-200 py-3 text-sm text-amber-950"><p>No se confirmó la lectura de las capturas locales. El cambio de etapa queda bloqueado.</p><button type="button" className="mt-2 min-h-11 font-semibold" onClick={() => void refreshPendingEvidence().catch(() => toast.error('Cola local no disponible', 'Conservá tus archivos originales y no cierres la pantalla.'))}>Reintentar lectura de capturas</button></div>}
    {(!isOnline || pendingEvidence.length > 0 || storageFailed) && <div role="status" className="flex flex-col gap-2 border-t border-neutral-200 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2">{isOnline ? <CloudUpload size={18} className="shrink-0" /> : <CloudOff size={18} className="shrink-0" />}{storageFailed ? 'No hay copia local confirmada; no cierres esta pantalla. Guardá en el servidor con conexión.' : !isOnline ? 'Sin conexión · revisá la confirmación de guardado local junto a cada comentario. Las capturas pendientes se muestran por separado.' : pendingEvidence.length + ' capturas pendientes de sincronización'}</span>{isOnline && pendingEvidence.length > 0 && <button type="button" onClick={() => void syncEvidence(true)} disabled={syncingEvidence || !canWriteDraft()} className="min-h-11 w-fit rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold disabled:opacity-60">{syncingEvidence ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}</div>}

      </div>
    </details>}
    {recording && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800"><span>Grabando audio de campo</span><Button variant="danger" size="sm" onClick={toggleRecording} leftIcon={<Square size={14} />}>Detener grabación</Button></div>}
    {staleDraft && <StaleDraftNotice serverVersion={inspection.version} draftVersion={staleDraft.version} conflicts={draftConflicts(draftFromInspection(inspection), staleDraft)} onRecover={recoverStaleDraft} onDiscard={discardStaleDraft} />}
    <fieldset disabled={changingStage} className="min-h-0 min-w-0 flex-1"><InspectionWorkspace key={id} steps={steps} reference={reference} guided={guided} defaultStep={canEditReport && !canEdit ? 'informe-tecnico' : inspection.estado === 'EN_CAMPO' && fieldEditAllowed ? inspection.tipoActor ? 'checklist' : 'acta' : 'resumen'} resumeIdentity={currentUser?.id ? { userId: currentUser.id, inspectionId: inspection.id } : undefined} onBeforeNavigate={flushDraft} saveAction={guided && canWriteDraft() ?
      <div data-testid="inspection-field-save-bar" className="flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"><DraftSaveFeedback status={fieldSaveStatus} />{(dictating || fieldSaveDetail) && <p className="mt-1 text-xs leading-snug text-neutral-600">{dictating ? 'Dictado en curso · detenelo antes de salir.' : fieldSaveDetail}</p>}</div>
        <Button aria-label={canEdit ? 'Guardar cambios' : 'Guardar informe'} className="shrink-0 max-sm:px-3" leftIcon={<Save size={16} />} isLoading={savingDraft} disabled={saveDisabled || dictating || recording || saveStatus.tone === 'success'} onClick={() => { void save(); }}><span className="sm:hidden">Guardar</span><span className="hidden sm:inline">{canEdit ? 'Guardar cambios' : 'Guardar informe'}</span></Button>
        <Button variant="ghost" title="Salir y retomar" className="h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-3" aria-label="Guardar y salir de la inspección" leftIcon={<ArrowLeft size={18} />} disabled={recording || dictating || uploadingItemId !== null || syncingEvidence || savingDraft || changingStage || pendingEvidenceReadFailed} onClick={pauseFieldWork}><span className="hidden sm:inline">Salir y retomar</span></Button>
      </div> : undefined} /></fieldset>
    <input ref={cameraRef} aria-label="Tomar foto general" type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" className="hidden" onChange={uploadFromInput} />
    <input ref={fileRef} aria-label="Adjuntar archivo general" type="file" accept={INSPECTION_EVIDENCE_ACCEPT} className="hidden" onChange={uploadFromInput} />
  </div>;
};

function StaleDraftNotice({ serverVersion, draftVersion, conflicts, onRecover, onDiscard }: { serverVersion: number; draftVersion: number; conflicts: DraftConflict[]; onRecover: (selectedKeys: string[]) => void; onDiscard: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  return <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
    <div className="flex items-start gap-3">
      <History size={19} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">Hay un borrador anterior sin conciliar</p>
        <p className="mt-1 text-xs leading-relaxed">{draftVersion === serverVersion ? 'El dispositivo conserva un borrador de formato anterior o incompleto.' : `El dispositivo conserva cambios de la versión ${draftVersion}; el servidor está en la versión ${serverVersion}.`} No se descartó ni fusionó nada automáticamente.</p>
        <p className="mt-1 text-xs font-semibold">Elegí campo por campo qué cambios del dispositivo querés conservar. Lo no seleccionado mantiene el valor del servidor.</p>
        {conflicts.length > 0 ? <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2">{conflicts.map((conflict) => <label key={conflict.key} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-amber-50"><input type="checkbox" checked={selected.includes(conflict.key)} onChange={() => toggle(conflict.key)} className="mt-1 h-4 w-4 accent-amber-900" /><span className="min-w-0 text-xs"><strong className="block text-sm">{conflict.label}</strong><span className="mt-1 block text-neutral-600">Servidor: {conflict.serverValue}</span><span className="block font-semibold text-amber-900">Dispositivo: {conflict.localValue}</span></span></label>)}</div> : <p className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs">No se detectaron valores diferentes; el conflicto corresponde al formato anterior del borrador.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onRecover(selected)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-900 px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"><RotateCcw size={15} />Aplicar selección ({selected.length})</button>
          <button type="button" onClick={onDiscard} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"><Trash2 size={15} />Descartar borrador anterior</button>
        </div>
      </div>
    </div>
  </section>;
}

/** Mirrors EN_REVISION transition guards; approval and legal readiness belong to the following stage. */
export function FieldReadinessPanel({ state, items, comparisons, pendingEvidenceCount, requiresComparison = true }: {
  state: InspectionState;
  items: Pick<InspectionItem, 'obligatorio' | 'resultado'>[];
  comparisons: Pick<InspectionComparison, 'resultado'>[];
  pendingEvidenceCount: number;
  requiresComparison?: boolean;
}) {
  const checks = [
    { ready: state === 'EN_CAMPO', label: 'Inspección iniciada en campo' },
    { ready: items.every((item) => !item.obligatorio || item.resultado !== 'PENDIENTE'), label: 'Checklist obligatorio completo' },
    { ready: !requiresComparison || (comparisons.length > 0 && comparisons.every((row) => row.resultado !== 'PENDIENTE')), label: requiresComparison ? 'Todos los datos declarados contrastados' : 'Sin sujeto identificado: no hay declaración para contrastar' },
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

function Meta({ icon, label, value, detail, to, onNavigate, returnTo }: { icon: React.ReactNode; label: string; value: string; detail?: string; to?: string; onNavigate?: () => boolean; returnTo?: string }) { return <div className="flex gap-3"><span className="mt-0.5 shrink-0 text-neutral-500 [&>svg]:h-[19px] [&>svg]:w-[19px]">{icon}</span><div className="min-w-0"><p className="text-xs text-neutral-500">{label}</p>{to ? <Link to={to} state={{ inspectionReturn: returnTo }} onClick={event => { if (onNavigate?.() === false) event.preventDefault(); }} className="rounded-sm font-bold text-[#10213A] transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Abrir ${label.toLowerCase()}: ${value}`}>{value}</Link> : <p className="font-bold text-[#10213A]">{value}</p>}{detail && <p className="text-xs text-neutral-500">{detail}</p>}</div></div>; }
function DraftSaveFeedback({ status }: { status: DraftSaveStatus }) {
  const color = status.tone === 'error' ? 'text-error-800' : status.tone === 'success' ? 'text-success-800' : 'text-neutral-700';
  const compact = status.tone === 'success' ? 'Guardado en SITREP' : status.message === 'Guardando cambios en el servidor…' ? 'Guardando…' : status.message.startsWith('Solo en este dispositivo') ? 'Copia en este dispositivo' : status.message === 'Falta guardar en servidor.' ? 'Cambios sin confirmar' : status.message;
  return <p role="status" aria-label={status.message} aria-live="polite" className={'text-sm font-medium leading-snug ' + color}>{compact !== status.message ? <><span className="sm:hidden" aria-hidden="true">{compact}</span><span className="max-sm:sr-only">{status.message}</span></> : status.message}</p>;
}

function ChecklistJumpIndex({ items, activeId, onSelect }: { items: InspectionItem[]; activeId?: string; onSelect: (item: InspectionItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const active = items.find((item) => item.id === activeId);
  const matches = items.filter((item) => `${item.etiqueta} ${item.codigo} ${item.categoria}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) { setOpen(false); setQuery(''); }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      setQuery('');
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [open]);
  const select = (item: InspectionItem) => { setOpen(false); setQuery(''); onSelect(item); };
  const status = (item: InspectionItem) => item.resultado === 'PENDIENTE' ? 'Pendiente' : item.resultado === 'CUMPLE' ? 'Cumple' : item.resultado === 'NO_CUMPLE' ? 'No cumple' : 'No aplica';
  return <div ref={containerRef} className="min-w-0 flex-1">
    <button ref={triggerRef} type="button" aria-label={`Ir a un control: ${active?.etiqueta || 'Buscar control'}`} aria-expanded={open} aria-controls="checklist-jump-index" onClick={() => { if (open) setQuery(''); setOpen((value) => !value); }} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-semibold text-[#10213A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
      <span className="flex min-w-0 items-center gap-2"><Search size={17} className="shrink-0 text-primary-700" aria-hidden="true" /><span className="truncate">{active?.etiqueta || 'Ir a un control'}</span></span>{open ? <ChevronUp size={17} className="shrink-0 text-neutral-500" /> : <ChevronDown size={17} className="shrink-0 text-neutral-500" />}
    </button>
    <div id="checklist-jump-index" hidden={!open} className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {open && <><label className="flex min-h-11 items-center gap-2 border-b border-neutral-200 px-3"><Search size={17} className="shrink-0 text-neutral-500" aria-hidden="true" /><span className="sr-only">Buscar control</span><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o código" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-[#10213A] outline-none placeholder:text-neutral-500" /></label>
        <nav aria-label="Índice de controles" className="max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain py-1">{matches.length ? matches.map((item) => <button key={item.id} type="button" aria-current={activeId === item.id ? 'location' : undefined} onClick={() => select(item)} className={`flex min-h-12 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${activeId === item.id ? 'bg-primary-50' : ''}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">{items.indexOf(item) + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-snug text-[#10213A]">{item.etiqueta}</span><span className="block text-xs text-neutral-600">{item.categoria} · {item.codigo}</span></span><span className={`shrink-0 text-xs font-semibold ${item.resultado === 'NO_CUMPLE' ? 'text-error-700' : item.resultado === 'CUMPLE' ? 'text-success-800' : 'text-neutral-600'}`}>{status(item)}</span></button>) : <p className="px-4 py-4 text-sm text-neutral-600">No hay controles con ese nombre.</p>}</nav></>}
    </div>
  </div>;
}

function Checklist({ inspectionId, groups, items, completed, editable, setItems, uploadingItemId, pendingEvidence, onEvidence, onAnnul, onDictatedText, onDictationActiveChange }: { inspectionId: string; groups: string[]; items: InspectionItem[]; completed: number; editable: boolean; setItems: React.Dispatch<React.SetStateAction<InspectionItem[]>>; uploadingItemId: string | null; pendingEvidence: PendingInspectionEvidence[]; onEvidence: (file: File, item: InspectionItem) => void; onAnnul: (evidenceId: string, reason: string) => Promise<void>; onDictatedText: (itemId: string, text: string) => void; onDictationActiveChange: (active: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nonCompliant = items.filter((item) => item.resultado === 'NO_CUMPLE').length;
  const orderedItems = groups.flatMap((group) => items.filter((item) => item.categoria === group));
  const [expandedItem, setExpandedItem] = useState<string>();
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.split('/')[1] || ''); } catch { /* invalid anchors do not discard the draft */ }
  const linkedItem = location.hash.startsWith('#checklist/') ? items.find((item) => item.codigo === linkedCode) : undefined;
  const linkedItemId = linkedItem?.id;
  const activeItem = linkedItem?.id ?? expandedItem ?? orderedItems.find((item) => item.resultado === 'PENDIENTE')?.id ?? orderedItems[0]?.id;
  const [showOverview, setShowOverview] = useState(true);
  const remaining = orderedItems.filter((item) => item.resultado === 'PENDIENTE');
  const nextPendingAfter = (item?: InspectionItem) => {
    const position = item ? orderedItems.indexOf(item) : -1;
    return orderedItems.slice(position + 1).find((entry) => entry.resultado === 'PENDIENTE')
      || orderedItems.slice(0, position).find((entry) => entry.resultado === 'PENDIENTE');
  };
  const itemStatus = (item: InspectionItem) => item.resultado === 'PENDIENTE' ? 'Pendiente' : item.resultado === 'CUMPLE' ? 'Revisado · Cumple' : item.resultado === 'NO_CUMPLE' ? 'Revisado · No cumple' : 'Revisado · No aplica';
  const preserveAnchor = useRef<(() => void) | null>(null);
  const pendingScrollHash = useRef<string | null>(null);
  const handledScrollHash = useRef<string | null>(null);
  const openControl = (item?: InspectionItem, align = true) => {
    preserveAnchor.current = !align ? preserveInspectionAnchor(document.getElementById('control-' + (item?.id || activeItem))) : null;
    pendingScrollHash.current = item ? '#checklist/' + encodeURIComponent(item.codigo) : '#checklist';
    setExpandedItem(item?.id || '');
    navigate({ pathname: location.pathname, search: location.search, hash: item ? '#checklist/' + encodeURIComponent(item.codigo) : '#checklist' }, { replace: true });
  };
  useLayoutEffect(() => {
    // Router navigation can commit after local accordion state. Do not consume
    // preservation in the first commit and then run a second hash auto-scroll.
    if (pendingScrollHash.current !== null && pendingScrollHash.current !== location.hash) return;
    if (pendingScrollHash.current === null && handledScrollHash.current === location.hash) return;
    pendingScrollHash.current = null;
    handledScrollHash.current = location.hash;
    if (preserveAnchor.current) { preserveAnchor.current(); preserveAnchor.current = null; return; }
    if (!linkedItemId) return;
    const frame = requestAnimationFrame(() => revealInspectionAnchor(document.getElementById('control-' + linkedItemId)));
    return () => cancelAnimationFrame(frame);
  }, [linkedItemId, location.hash, expandedItem]);
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);
  const updateItem = (id: string, patch: Partial<InspectionItem>) => {
    // Keep the initial pending control in place after a decision; advancing is explicit.
    setExpandedItem(id);
    setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  return <section className="bg-white">
    <div className="border-b border-neutral-300 pb-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-primary-900"><Eye size={20} aria-hidden="true" />Recorrido de campo</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-700">Revisá el lugar y registrá lo que encontrás.</p>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-neutral-700">{completed} de {items.length} revisados</p>
        {nonCompliant > 0 && <span className="shrink-0 rounded-full bg-error-50 px-2.5 py-1 text-xs font-bold text-error-700">{nonCompliant} {nonCompliant === 1 ? 'no cumple' : 'no cumplen'}</span>}
      </div>
      <div role="progressbar" aria-label="Controles revisados" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={completed} aria-valuetext={`${completed} de ${items.length} revisados; no indica cumplimiento`} className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-primary-700" style={{ width: `${Math.round((completed / Math.max(1, items.length)) * 100)}%` }} /></div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <ChecklistJumpIndex items={orderedItems} activeId={activeItem} onSelect={openControl} />
        <Button className="max-lg:hidden" variant="outline" disabled={!nextPendingAfter(items.find((item) => item.id === activeItem))} onClick={() => openControl(nextPendingAfter(items.find((item) => item.id === activeItem)))}>{nextPendingAfter(items.find((item) => item.id === activeItem)) ? 'Ir al siguiente pendiente (' + remaining.length + ')' : remaining.length ? 'Último control pendiente' : 'Todos revisados'}</Button>
      </div>
    </div>
    {groups.map((group) => {
      const groupItems = items.filter((item) => item.categoria === group);
      const groupCompleted = groupItems.filter((item) => item.resultado !== 'PENDIENTE').length;
      const groupFails = groupItems.filter((item) => item.resultado === 'NO_CUMPLE').length;
      return <div key={group} className={`mt-5 ${!showOverview && !groupItems.some((item) => item.id === activeItem) ? 'max-lg:hidden' : ''}`}>
        <div style={{ top: 'var(--inspection-middle-top, 0px)' }} className="sticky z-10 flex min-h-12 items-center justify-between gap-3 rounded-t-lg border border-neutral-300 bg-neutral-100 px-3 py-2 sm:px-5">
          <p className="font-bold text-[#10213A]">{group}</p>
          <div className="text-right text-xs font-semibold text-neutral-600"><span>{groupCompleted}/{groupItems.length} revisados</span>{groupCompleted < groupItems.length && <span className="text-warning-800"> · {groupItems.length - groupCompleted} pendientes</span>}{groupFails > 0 && <span className="text-error-800"> · {groupFails} {groupFails === 1 ? 'no cumple' : 'no cumplen'}</span>}</div>
        </div>
        {groupItems.map((item) => {
          const isFail = item.resultado === 'NO_CUMPLE';
          const itemEvidence = [...(item.evidencias || [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
          const itemEvidenceExpanded = expandedEvidence.includes(item.id);
          const visibleItemEvidence = itemEvidenceExpanded ? itemEvidence : itemEvidence.slice(0, 4);
          const pendingItemEvidence = pendingEvidence.filter((evidence) => evidence.fields.itemId === item.id);
          const showObservation = editable || isFail || Boolean(item.observacion) || itemEvidence.length > 0 || pendingItemEvidence.length > 0;
          const expanded = activeItem === item.id;
          return <div key={item.id} id={'control-' + item.id} data-inspection-anchor={'checklist/' + item.codigo} data-result={item.resultado} style={{ scrollMarginTop: 'var(--inspection-anchor-offset, 8rem)' }} className={`mt-2 rounded-lg border border-l-4 px-3 py-1 sm:px-5 ${!showOverview && !expanded ? 'max-lg:hidden' : ''} ${isFail ? 'border-error-300 border-l-error-600 bg-error-50/30' : expanded ? 'border-primary-300 border-l-primary-700 bg-primary-50/50' : 'border-neutral-300 border-l-neutral-300 bg-white'}`}>
            <button type="button" aria-expanded={expanded} aria-controls={'control-detail-' + item.id} onClick={() => { if (expanded && !showOverview && window.innerWidth < 1024) return; openControl(expanded ? undefined : item, false); }} className="flex min-h-16 w-full items-start gap-3 rounded-lg py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.resultado === 'CUMPLE' ? 'bg-success-100 text-success-700' : isFail ? 'bg-error-100 text-error-700' : item.resultado === 'NO_APLICA' ? 'bg-neutral-200 text-neutral-700' : 'border border-neutral-300 bg-white text-neutral-600'}`}>{item.resultado === 'CUMPLE' ? <Check size={16} /> : isFail ? <XCircle size={16} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={16} /> : <span className="text-xs font-bold">{orderedItems.indexOf(item) + 1}</span>}</div>
              <div className="min-w-0 flex-1"><p className="text-base font-semibold leading-relaxed text-[#10213A]">{item.etiqueta}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-neutral-500">{item.codigo}</span><span data-testid={'inspection-item-status-' + item.id} className={'rounded-md px-2 py-1 text-xs font-semibold ' + (item.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-900' : isFail ? 'bg-error-50 text-error-800' : item.resultado === 'CUMPLE' ? 'bg-success-50 text-success-800' : 'bg-neutral-100 text-neutral-700')}>{itemStatus(item)}</span>{item.observacion && <span className="text-xs text-neutral-600">Observación</span>}{itemEvidence.length + pendingItemEvidence.length > 0 && <span className="text-xs text-neutral-600">{itemEvidence.length + pendingItemEvidence.length} adjuntos</span>}</div></div>
              {expanded ? <ChevronUp size={17} className="mt-1 shrink-0 text-neutral-500" /> : <ChevronDown size={17} className="mt-1 shrink-0 text-neutral-500" />}
            </button>
            {expanded && <div id={'control-detail-' + item.id} className="pb-5 pl-0 sm:pl-10">
              <div role="group" aria-label={`Validación: ${item.etiqueta}`} className="grid grid-cols-3 gap-2">
                {RESULTS.map((option) => {
                  const selected = item.resultado === option.value;
                  return <button key={option.value} type="button" disabled={!editable} aria-pressed={selected} onClick={() => updateItem(item.id, { resultado: option.value })} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:flex-row sm:gap-1.5 sm:text-sm ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}>{option.icon}<span>{option.label}</span></button>;
                })}
              </div>
              {showObservation && <div className={`mt-3 border-l-2 pl-3 ${isFail ? 'border-error-300' : 'border-neutral-300'}`}>
                <label><span className={`mb-1 block text-sm font-bold ${isFail ? 'text-error-900' : 'text-neutral-900'}`}>{isFail ? 'Hallazgo: qué no cumple' : 'Observación de este control'}</span><textarea disabled={!editable} aria-label={`Observación: ${item.etiqueta}`} value={item.observacion || ''} onChange={(event) => updateItem(item.id, { observacion: event.target.value })} rows={2} placeholder={isFail ? 'Qué encontraste, dónde y qué evidencia lo respalda' : 'Qué observaste en este control'} className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 ${isFail ? 'border-error-300 focus:border-error-600 focus:ring-error-100' : 'border-neutral-400 focus:border-primary-700 focus:ring-primary-100'}`} /></label>
                {editable && <div className="mt-2"><OfflineDictation buttonLabel="Dictar observación" active={expanded && location.hash.startsWith('#checklist')} onActiveChange={onDictationActiveChange} onText={(text) => onDictatedText(item.id, text)} /></div>}
                {itemEvidence.length > 0 && <div className="mt-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleItemEvidence.map((evidence) => <EvidenceTile key={evidence.id} inspectionId={inspectionId} evidence={evidence} editable={editable} onAnnul={onAnnul} />)}</div>{itemEvidence.length > 4 && <button type="button" onClick={() => setExpandedEvidence((ids) => itemEvidenceExpanded ? ids.filter((id) => id !== item.id) : [...ids, item.id])} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{itemEvidenceExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{itemEvidenceExpanded ? 'Mostrar menos' : `Ver las ${itemEvidence.length} evidencias`}</button>}</div>}
                {pendingItemEvidence.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{pendingItemEvidence.map((evidence) => <PendingEvidenceThumbnail key={evidence.id} evidence={evidence} />)}</div>}
                {editable && <div className="mt-3 flex flex-wrap gap-2">
                  <label className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-primary-200 bg-primary-50 text-primary-800 hover:border-primary-300 hover:bg-primary-100'}`}>
                    {uploadingItemId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    {uploadingItemId === item.id ? 'Subiendo…' : 'Tomar foto'}
                    <input aria-label={`Tomar foto: ${item.etiqueta}`} type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                  <label className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${uploadingItemId === item.id ? 'cursor-wait border-neutral-200 bg-neutral-100 text-neutral-500' : 'border-neutral-300 bg-white text-neutral-800 hover:border-primary-300 hover:bg-primary-50'}`}>
                    <Paperclip size={16} />
                    Elegir imagen
                    <input aria-label={`Adjuntar foto: ${item.etiqueta}`} type="file" accept={INSPECTION_PHOTO_ACCEPT} disabled={uploadingItemId !== null} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onEvidence(file, item); }} />
                  </label>
                </div>}
                {editable && <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">Máximo 25 MB. La foto quedará vinculada a este control.</p>}
              </div>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3"><a href="#checklist" onClick={(event) => { event.preventDefault(); revealInspectionAnchor(document.getElementById('checklist')); }} className="rounded-md px-2 py-2 text-xs font-semibold text-neutral-600 !no-underline hover:bg-neutral-100">Volver al índice de controles</a><button type="button" disabled={!nextPendingAfter(item)} onClick={() => openControl(nextPendingAfter(item))} className="min-h-11 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-bold text-primary-800 disabled:bg-neutral-50 disabled:text-neutral-500">{nextPendingAfter(item) ? 'Siguiente pendiente' : remaining.length ? 'Último control pendiente' : 'Checklist revisado'}</button></div>
            </div>}
          </div>;
        })}
      </div>;
    })}
    <button type="button" aria-expanded={showOverview} onClick={() => setShowOverview((value) => !value)} className="min-h-12 w-full border-t border-neutral-200 px-4 text-sm font-semibold text-primary-800 lg:hidden">{showOverview ? 'Volver al control actual' : `Ver los ${items.length} controles`}</button>
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
        <Button variant={recording ? 'danger' : 'outline'} size="sm" leftIcon={recording ? <Square size={15} /> : <Mic size={16} />} onClick={onAudio}>{recording ? 'Detener audio' : 'Grabar audio'}</Button>
        <Button variant="outline" size="sm" leftIcon={<Paperclip size={16} />} onClick={onFile}>Elegir archivo</Button>
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
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-bold text-neutral-600 hover:bg-neutral-100 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${compact ? 'mt-2 px-1.5' : 'mt-2 px-2'}`}><ArchiveX size={14} />Anular con motivo</button>;
  return <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5"><label className="block text-[11px] font-bold text-amber-950">Motivo obligatorio<textarea aria-label={`Motivo para anular ${evidence.nombreOriginal}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={compact ? 2 : 3} placeholder="Explique por qué no debe considerarse esta evidencia" className="mt-1 w-full resize-y rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-amber-400" /></label><p className="mt-1 text-[10px] leading-relaxed text-amber-900">El archivo no se borra: queda marcado y auditado.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setOpen(false); setReason(''); }} className="min-h-8 rounded-md border border-neutral-300 bg-white px-2 text-[11px] font-bold text-neutral-700">Cancelar</button><button type="button" disabled={busy || reason.trim().length < 10} onClick={() => void submit()} className="min-h-8 rounded-md bg-error-700 px-2 text-[11px] font-bold text-white disabled:opacity-50">{busy ? 'Anulando…' : 'Confirmar anulación'}</button></div></div>;
}

export default InspeccionExpedientePage;
import { INSPECTION_TYPES, inspectionTypeOf } from '../../types/inspection';

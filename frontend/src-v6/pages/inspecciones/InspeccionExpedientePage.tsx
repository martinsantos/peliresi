import { nextInspectionTask, inspectionTaskLabel } from './inspectionJourney';
import { canonicalInspectionValue } from './canonicalInspectionValue';
import { InspectionActAccessPanel } from './InspectionActAccessPanel';
import { InspectionPhotoDescriptions } from './InspectionPhotoDescriptions';
import { InspectionSignaturePanel } from './InspectionSignaturePanel';
import { InspectionFieldModel } from './InspectionFieldModel';
import { inspectionContextKey, inspectionFieldDraftKey, inspectionReturnTarget, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { workspaceRoleLabel } from '../../utils/workspaceNavigation';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { warmInspectionShell } from '../../services/warmInspectionShell';

import { isAxiosError } from 'axios';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArchiveX, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ChevronUp, CircleMinus, ClipboardCheck, CloudOff, CloudUpload, Download, Eye, FileAudio, FileText, History, Loader2, Mic, Paperclip, Play, RotateCcw, Save, Search, Send, ShieldCheck, Square, Trash2, UserRound, XCircle } from 'lucide-react';
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
import { InspectionFieldSheet, type InspectionFieldBlock } from './InspectionFieldSheet';
import { revealInspectionAnchor, preserveInspectionAnchor } from './inspectionScroll';
import { InspectionOrganizationPanel } from './InspectionOrganizationPanel';
import { InspectionVerificationBlock } from './InspectionVerificationBlock';
import { InspectionDocumentsPanel } from './InspectionDocumentsPanel';
import { getInspectionDossierReadiness, type InspectionDossierReadiness } from './inspectionDossierReadiness';
import { INSPECTION_PHASES, inspectionPhaseOf } from './inspectionProcess';
import { inspectionActorRoute, inspectionDate, inspectionErrorMessage, isTrainingActNumber } from './inspectionPresentation';
import { OfflineDictation } from './OfflineDictation';
import { appendDictatedText } from './appendDictatedText';
import { InspectionLocationField } from './InspectionLocationField';
import { InspectionLegacyRecovery } from './InspectionLegacyRecovery';
import { inspectionLocationSuggestions } from './inspectionLocations';
import { readInspectionFieldCheckpoint, writeInspectionFieldCheckpoint } from '../../services/inspectionFieldCheckpoint';

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
const orderedDraftFields = canonicalInspectionValue;
// Compare only fields that this form persists; evidence metadata can refresh independently.
const draftFingerprint = (draft: Draft) => JSON.stringify({ observaciones: draft.observaciones, numeroActa: draft.numeroActa, ubicacion: draft.ubicacion, plazoRespuestaAt: draft.plazoRespuestaAt, datosActa: orderedDraftFields(draft.datosActa), informeTecnico: orderedDraftFields(draft.informeTecnico), items: draft.items.map(({ id, resultado, observacion }) => ({ id, resultado, observacion: observacion || null })), comparaciones: draft.comparaciones.map(({ id, resultado, valorObservado, observacion }) => ({ id, resultado, valorObservado: valorObservado || null, observacion: observacion || null })) });
const AUTOSAVE_DELAY_MS = 1500;
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
  // Android can stop Chrome before a later localStorage commit reaches disk.
  // A complete old snapshot with no edits relative to its recorded server base
  // is not an unsent draft. Use the current server copy, never its old fields.
  // Legacy/partial copies, future versions and any real edit still fail closed.
  const unchangedSnapshot = completeShape && typeof source.version === 'number'
    && Number.isInteger(source.version) && source.version > 0 && source.version < server.version
    && typeof source.baseFingerprint === 'string' && source.baseFingerprint === draftFingerprint(draft);
  if (unchangedSnapshot) return { draft: server, compatible: true };
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
    if (JSON.stringify(canonicalInspectionValue(serverValue ?? null)) === JSON.stringify(canonicalInspectionValue(localValue ?? null))) return;
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
  const { id = '' } = useParams();
  const { currentUser } = useAuth();
  const owner = inspectionWorkspaceOwner(currentUser);
  return <ScopedInspectionExpediente key={inspectionContextKey(currentUser?.id || '', owner, id)} owner={owner} />;
};

const ScopedInspectionExpediente: React.FC<{ owner: string }> = ({ owner }) => {
  const { id = '' } = useParams(); const navigate = useNavigate(); const location = useLocation(); const mobile = location.pathname.startsWith('/mobile'); const { currentUser } = useAuth();
  const workspaceReturn = inspectionReturnTarget(location.state, inspectionWorkspaceOwner(currentUser), mobile);
  const returnToWorkspace = () => navigate(workspaceReturn.to, workspaceReturn.state ? { state: workspaceReturn.state } : undefined);
  const query = useInspection(id); const inspection = query.data;
  const [items, setItems] = useState<InspectionItem[]>([]); const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [observaciones, setObservaciones] = useState(''); const [numeroActa, setNumeroActa] = useState(''); const [ubicacion, setUbicacion] = useState(''); const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [datosActa, setDatosActa] = useState<InspectionActData>({}); const [informeTecnico, setInformeTecnico] = useState<InspectionTechnicalReport>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine); const [recording, setRecording] = useState(false); const [dictating, setDictating] = useState(false); const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [pendingEvidenceEntries, setPendingEvidence] = useState<PendingInspectionEvidence[]>([]); const [syncingEvidence, setSyncingEvidence] = useState(false);
  const pendingEvidence = pendingEvidenceEntries.filter((entry) => entry.inspectionId === id && entry.userId === String(currentUser?.id) && entry.owner === owner);
  const [pendingEvidenceReadFailed, setPendingEvidenceReadFailed] = useState(true);
  const [staleDraft, setStaleDraft] = useState<Draft | null>(null);
  const [legacyReview, setLegacyReview] = useState(false);
  const [recoveringDraft, setRecoveringDraft] = useState(false);
  const manualRecoveryRef = useRef(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [leavingDraft, setLeavingDraft] = useState(false);
  const [serverFingerprint, setServerFingerprint] = useState('');
  const serverFingerprintRef = useRef('');
  serverFingerprintRef.current = serverFingerprint;
  const [localFingerprint, setLocalFingerprint] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const [draftReadyKey, setDraftReadyKey] = useState('');
  const [draftReadAttempt, setDraftReadAttempt] = useState(0);
  const checkpointSequenceRef = useRef(0);
  const checkpointTimeRef = useRef(0);
  const checkpointConfirmationRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const [saveFailed, setSaveFailed] = useState(false);
  const savingDraftRef = useRef(false);
  const confirmedVersionRef = useRef(0);
  const hydratedCaseRef = useRef('');
  const loadedDraftScopeRef = useRef('');
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
  const evidenceScope = inspectionContextKey(currentUser?.id || '', owner, id);
  const evidenceScopeRef = useRef(evidenceScope);
  evidenceScopeRef.current = evidenceScope;
  useEffect(() => { void warmInspectionShell(); }, []);
  useEffect(() => () => { evidenceScopeRef.current = ''; }, []);
  const draftKey = inspectionFieldDraftKey(currentUser?.id || '', owner, id);
  const isAdmin = Boolean(inspection && (currentUser?.esJefeInspecciones || currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${inspection.tipoActor}`));
  const isAssignedInspector = Boolean(inspection && currentUser?.esInspector && String(inspection.inspectorId) === String(currentUser.id));
  const fieldEditAllowed = Boolean(!query.isError && inspection && ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado) && (isAdmin || isAssignedInspector));
  const reportEditAllowed = Boolean(!query.isError && inspection && (fieldEditAllowed || (inspection.estado === 'EN_REVISION' && (isAdmin || isAssignedInspector))));
  // Field states open as one page, the field sheet. The full dossier stays one explicit link away.
  const dossierView = new URLSearchParams(location.search).get('vista') === 'expediente';
  const sheet = fieldEditAllowed && !dossierView;
  const draftOwnership = useInspectionDraftOwnership(draftKey, fieldEditAllowed || reportEditAllowed);
  const canWriteDraft = draftOwnership.canWrite;
  const hydrationKey = `${draftKey}:${inspection?.id || ''}:${inspection?.version || 0}:${draftOwnership.status}`;
  const readyKey = `${draftKey}:${inspection?.id || ''}:${draftOwnership.status}`;
  const draftReady = draftReadyKey === readyKey;
  const canEdit = fieldEditAllowed && draftOwnership.status === 'owned' && draftReady && !staleDraft;
  const canEditReport = reportEditAllowed && draftOwnership.status === 'owned' && draftReady && !staleDraft;
  const currentDraft: Draft | null = inspection ? { version: Math.max(inspection.version, confirmedVersionRef.current), observaciones, numeroActa, ubicacion, plazoRespuestaAt, datosActa, informeTecnico, items, comparaciones: comparisons } : null;
  currentDraftRef.current = currentDraft;
  const currentFingerprint = currentDraft ? draftFingerprint(currentDraft) : '';
  const storeDraft = useCallback((draft: Draft) => {
    if (!canWriteDraft()) return false;
    if (!draftKey) { setStorageFailed(true); return false; }
    try {
      // Persist provenance together with the fields, not in a second key that
      // could reach disk at a different time or belong to another inspection.
      checkpointTimeRef.current = Math.max(Date.now(), checkpointTimeRef.current + 1);
      const raw = JSON.stringify({ ...draft, baseFingerprint: serverFingerprintRef.current, checkpointAt: checkpointTimeRef.current, manualReview: manualRecoveryRef.current });
      localStorage.setItem(draftKey, raw);
      const sequence = ++checkpointSequenceRef.current;
      const scope = evidenceScopeRef.current;
      checkpointConfirmationRef.current = writeInspectionFieldCheckpoint(draftKey, raw).then(() => {
        if (evidenceScopeRef.current === scope && checkpointSequenceRef.current === sequence) {
          setLocalFingerprint(draftFingerprint(draft)); setStorageFailed(false);
        }
        return true;
      }).catch(() => {
        if (evidenceScopeRef.current === scope && checkpointSequenceRef.current === sequence) setStorageFailed(true);
        return false;
      });
      return true;
    } catch { setStorageFailed(true); checkpointConfirmationRef.current = Promise.resolve(false); return false; }
  }, [canWriteDraft, draftKey]);

  useEffect(() => { const on = () => setIsOnline(true); const off = () => setIsOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => {
    if (!inspection || savingDraftRef.current || syncingRef.current || transitionInFlight.current) return;
    if (draftOwnership.status !== 'owned') loadedDraftScopeRef.current = '';
    // Query refetches can replace the object without advancing its version.
    // Never apply that same server snapshot over unsaved field edits.
    if (hydratedCaseRef.current === hydrationKey) return;
    let active = true;
    const hydrate = async () => {
    const draft = draftFromInspection(inspection);
    try {
    const continuing = loadedDraftScopeRef.current === draftKey && draftOwnership.status === 'owned';
    const durable = !continuing && draftKey ? await readInspectionFieldCheckpoint(draftKey) : undefined;
    if (!active) return;
    const latest = currentDraftRef.current;
    const inMemory = continuing && latest && draftFingerprint(latest) !== serverFingerprintRef.current
      ? JSON.stringify({ ...latest, version: confirmedVersionRef.current, baseFingerprint: serverFingerprintRef.current, manualReview: manualRecoveryRef.current }) : null;
    recoveredDraftNeedsSyncRef.current = false;
    confirmedVersionRef.current = inspection.version;
    setServerFingerprint(draftFingerprint(draft));
    setStaleDraft(null);
    setLegacyReview(false);
    if (draftKey) {
      const journal = localStorage.getItem(draftKey);
      let raw = inMemory || (durable === undefined ? journal : durable);
      if (durable && journal && durable !== journal) {
        const committed = JSON.parse(durable), recent = JSON.parse(journal);
        // A renderer journal may contain keystrokes newer than its last durable
        // commit. An older Chrome disk journal must never replace that commit.
        if (typeof recent.checkpointAt === 'number' && typeof committed.checkpointAt === 'number'
          && recent.checkpointAt > committed.checkpointAt) raw = journal;
        else if (typeof recent.checkpointAt !== 'number') {
          const legacy = reconcileStoredDraft(recent, draft);
          if (!legacy.compatible || draftConflicts(draft, legacy.draft).length > 0) setStaleDraft(legacy.draft);
        }
      }
      if (!continuing && raw && raw !== durable) {
        await writeInspectionFieldCheckpoint(draftKey, raw);
        if (!active) return;
      }
      if (raw !== null) {
        if (raw === undefined) throw new Error('Copia local inválida');
        const stored = reconcileStoredDraft(JSON.parse(raw), draft);
        manualRecoveryRef.current = JSON.parse(raw).manualReview === true;
        const timestamp = JSON.parse(raw).checkpointAt;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) checkpointTimeRef.current = Math.max(checkpointTimeRef.current, timestamp);
        if (stored.compatible) {
          recoveredDraftNeedsSyncRef.current = !continuing && !manualRecoveryRef.current && draftFingerprint(stored.draft) !== draftFingerprint(draft);
          Object.assign(draft, stored.draft);
          if (!continuing) setLocalFingerprint(draftFingerprint(stored.draft));
        } else {
          // Incompatible/older shape stays available for explicit recovery.
          setStaleDraft(stored.draft);
        }
      }
    }
    setItems(draft.items); setComparisons(draft.comparaciones); setObservaciones(draft.observaciones); setNumeroActa(draft.numeroActa); setUbicacion(draft.ubicacion); setPlazoRespuestaAt(draft.plazoRespuestaAt); setDatosActa(draft.datosActa); setInformeTecnico(draft.informeTecnico);
    hydratedCaseRef.current = hydrationKey;
    if (draftOwnership.status === 'owned') loadedDraftScopeRef.current = draftKey;
    setStorageFailed(false); setDraftReadyKey(readyKey);
    } catch { if (active) { hydratedCaseRef.current = ''; setStorageFailed(true); setDraftReadyKey(''); } }
    };
    void hydrate();
    return () => { active = false; };
    // Ownership can move from checking to owned after the inspector starts
    // typing. That status change must never rehydrate stale server values over
    // the in-progress field draft.
  }, [inspection, draftKey, hydrationKey, readyKey, draftOwnership.status, draftReadAttempt, savingDraft, syncingEvidence, changingStage, leavingDraft]);
  useEffect(() => {
    // Spontaneous inspections can have no checklist. Their field testimony
    // needs the same automatic device backup as an actor-bound inspection.
    if (!draftKey || !inspection || staleDraft || (!canEdit && !canEditReport)) return;
    const timer = window.setTimeout(() => { if (currentDraftRef.current) storeDraft(currentDraftRef.current); }, 350);
    return () => window.clearTimeout(timer);
  }, [canEdit, canEditReport, draftKey, inspection, currentFingerprint, staleDraft, storeDraft]);
  useEffect(() => {
    const flush = () => { if (!staleDraft && currentDraftRef.current && (canEdit || canEditReport)) storeDraft(currentDraftRef.current); };
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHidden); };
  }, [canEdit, canEditReport, staleDraft, storeDraft]);
  // Layout cleanup runs before the passive ownership hook releases the lock.
  // Preserve the last keystroke on route/context changes, even before debounce.
  const departingFieldDraft = useRef<() => void>(() => undefined);
  departingFieldDraft.current = () => {
    if (!staleDraft && currentDraftRef.current && (canEdit || canEditReport)) storeDraft(currentDraftRef.current);
  };
  useLayoutEffect(() => () => departingFieldDraft.current(), []);
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
      const entries = await listPendingInspectionEvidence(id, String(currentUser.id), owner);
      if (evidenceScopeRef.current === evidenceScope) { setPendingEvidence(entries); setPendingEvidenceReadFailed(false); }
    } catch (error) {
      if (evidenceScopeRef.current === evidenceScope) setPendingEvidenceReadFailed(true);
      throw error;
    }
  }, [currentUser?.id, evidenceScope, id, owner]);
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
    if (!manual && manualRecoveryRef.current) return;
    syncingRef.current = true; setSyncingEvidence(true);
    try {
    const entries = await listPendingInspectionEvidence(id, String(currentUser.id), owner);
    const hasStoredDraft = Boolean(currentDraftRef.current && serverFingerprintRef.current && draftFingerprint(currentDraftRef.current) !== serverFingerprintRef.current);
    if (!entries.length && !hasStoredDraft) return;
    let synchronized = 0;
      if (hasStoredDraft) {
        if (!await saveForSyncRef.current()) return;
      }
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      const result = await syncPendingInspectionEvidence({ inspectionId: id, userId: String(currentUser.id), owner, manual, onlyId, isActive: () => evidenceScopeRef.current === evidenceScope && canWriteDraft(),
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
  }, [canEdit, canWriteDraft, currentUser?.id, evidenceScope, id, owner, refreshAfterEvidence, refreshPendingEvidence, staleDraft]);
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
    if (!submitted || !draftReady || !canWriteDraft() || staleDraft || savingDraftRef.current || (!fromSync && (syncingRef.current || transitionInFlight.current))) return false;
    manualRecoveryRef.current = false;
    const journaled = storeDraft(submitted);
    if (!isOnline || !navigator.onLine) {
      const locallyProtected = journaled && await checkpointConfirmationRef.current;
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
      // The persistent live save status confirms this operation without moving the form.
      return !newerChanges;
    } catch (error: unknown) {
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return false;
      setSaveFailed(true);
      const protectedNow = currentDraftRef.current ? storeDraft(currentDraftRef.current) && await checkpointConfirmationRef.current : false;
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
  // The field sheet saves itself. After a refused save it waits for the next edit or for the
  // connection to return instead of retrying every few seconds.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const autosaveLatchRef = useRef('');
  const saveFailedRef = useRef(false); saveFailedRef.current = saveFailed;
  const autosaveDirty = sheet && draftReady && currentFingerprint !== serverFingerprint;
  const autosaveBlocked = !isOnline || !canWriteDraft() || Boolean(staleDraft) || dictating || recording || syncingEvidence || savingDraft || changingStage || leavingDraft;
  useEffect(() => { if (isOnline) autosaveLatchRef.current = ''; }, [isOnline]);
  useEffect(() => {
    if (!autosaveDirty || autosaveBlocked || autosaveLatchRef.current === currentFingerprint) return;
    const attempt = currentFingerprint;
    const timer = window.setTimeout(() => { void save().then((saved) => { if (saveFailedRef.current) autosaveLatchRef.current = attempt; else if (saved) setLastSavedAt(Date.now()); }); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveDirty, autosaveBlocked, currentFingerprint]);
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
      if (canWriteDraft() && draftKey) {
        try { await writeInspectionFieldCheckpoint(draftKey, null); localStorage.removeItem(draftKey); }
        catch { toast.warning('Copia local pendiente de cerrar', 'El servidor confirmó el cambio de etapa; no se pudo retirar la copia de este dispositivo.'); }
      }
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
      pending = await queueInspectionEvidence(id, String(currentUser.id), owner, file, fields);
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      await refreshPendingEvidence();
      if (!isOnline || !navigator.onLine) {
        // Queued, not synced: same tone as the device-only draft above.
        toast.info('Archivo guardado solo en este dispositivo', fields?.itemId
          ? 'Quedó vinculado a este control y se sincronizará al recuperar conexión.'
          : 'Se sincronizará al recuperar conexión.');
        return;
      }
      if (staleDraft || !await save(true) || !canWriteDraft()) return;
      const evidenceAlreadyPresent = Boolean(inspection?.evidencias.some((evidence) => evidence.sha256 === pending?.sha256));
      const result = await syncPendingInspectionEvidence({ inspectionId: id, userId: String(currentUser.id), owner, manual: true, onlyId: pending.id, isActive: () => evidenceScopeRef.current === evidenceScope && canWriteDraft(),
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
      await discardPendingInspectionEvidence(id, String(currentUser?.id), owner, evidenceId);
      await refreshPendingEvidence();
      toast.info('Copia pendiente descartada', 'Se quitó del dispositivo por tu confirmación. No se modificaron evidencias del servidor.');
    },
    onReplace: async (evidenceId, file) => {
      if (!canWriteDraft() || syncingRef.current || evidenceScopeRef.current !== evidenceScope) throw new Error('Esperá a que finalice la operación o recuperá la edición en esta pestaña.');
      await replacePendingInspectionEvidence(id, String(currentUser?.id), owner, evidenceId, file);
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

  const recoverStaleDraft = async (selectedKeys: string[]) => {
    if (!inspection || !staleDraft || !canWriteDraft() || recoveringDraft) return;
    const selected = new Set(selectedKeys);
    // Explicit legacy import preserves unselected edits already in this activity.
    const server = legacyReview && currentDraftRef.current ? currentDraftRef.current : draftFromInspection(inspection);
    const savedItems = new Map((staleDraft.items || []).map((item) => [item.id, item]));
    const savedComparisons = new Map((staleDraft.comparaciones || []).map((row) => [row.id, row]));
    const recoveredItems = server.items.map((current) => {
      const saved = savedItems.get(current.id);
      return saved && selected.has(`item:${current.id}`) ? { ...current, resultado: saved.resultado, observacion: saved.observacion } : current;
    });
    const recoveredComparisons = server.comparaciones.map((current) => {
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
    setRecoveringDraft(true);
    if (legacyReview) manualRecoveryRef.current = true;
    const saved = storeDraft(recovered) && await checkpointConfirmationRef.current;
    setRecoveringDraft(false);
    if (!saved || !canWriteDraft()) { toast.error('Recuperación sin confirmar', 'La copia anterior se conserva. Reintentá sin cerrar esta pantalla.'); return; }
    setObservaciones(recovered.observaciones); setNumeroActa(recovered.numeroActa); setUbicacion(recovered.ubicacion); setPlazoRespuestaAt(recovered.plazoRespuestaAt); setDatosActa(recovered.datosActa); setInformeTecnico(recovered.informeTecnico); setItems(recovered.items); setComparisons(recovered.comparaciones);
    setStaleDraft(null);
    setLegacyReview(false);
    toast.info(legacyReview ? 'Copia recuperada en esta actividad' : 'Conflicto conciliado', 'Revisá los campos antes de guardar en el expediente.');
  };

  const discardStaleDraft = async () => {
    if (!canWriteDraft() || recoveringDraft) return;
    if (legacyReview) { setStaleDraft(null); setLegacyReview(false); return; }
    try { if (draftKey) { await writeInspectionFieldCheckpoint(draftKey, null); localStorage.removeItem(draftKey); } }
    catch { toast.error('No se confirmó el descarte local', 'El borrador sigue disponible. Reintentá sin cerrar esta pantalla.'); return; }
    setStaleDraft(null);
    toast.info('Borrador anterior descartado', 'Se conserva la versión actualmente registrada en el servidor.');
  };

  const scopeReady = inspection && draftReadyKey.startsWith(`${draftKey}:${inspection.id}:`);
  if (query.isLoading || (inspection && !scopeReady && !storageFailed)) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente y copia local…</p>;
  if (inspection && !draftReady && storageFailed) return <Card role="alert" className="mx-auto max-w-xl p-6"><h2 className="text-lg font-bold text-neutral-900">No se pudo verificar la copia local</h2><p className="mt-2 text-sm text-neutral-600">No se reemplazó tu trabajo con la versión del servidor. Reintentá la lectura antes de editar.</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => { setStorageFailed(false); setDraftReadAttempt(value => value + 1); }}>Reintentar copia local</Button><Button variant="outline" onClick={() => returnToWorkspace()}>Volver al listado</Button></div></Card>;
  if (query.isError) {
    const status = isAxiosError(query.error) ? query.error.response?.status : undefined;
    const offlineMissing = isOfflineNetworkError(query.error);
    const title = status === 404 ? 'Expediente no encontrado' : status === 403 ? 'Sin acceso a este expediente' : offlineMissing ? 'Sin conexión y sin copia local' : 'No se pudo abrir el expediente';
    const detail = status === 404 ? 'Comprobá el enlace o regresá al listado.' : status === 403 ? 'Tu cuenta no tiene permiso para consultar esta inspección.' : offlineMissing ? 'Para usarlo sin conexión, primero abrí el expediente en este dispositivo mientras tengas red.' : 'No se pudo recuperar la información. El trabajo guardado en este dispositivo no fue eliminado.';
    return <Card role="alert" className="mx-auto max-w-xl p-6"><h2 className="text-lg font-bold text-neutral-900">{title}</h2><p className="mt-2 text-sm text-neutral-600">{detail}</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void query.refetch()}>Reintentar</Button><Button variant="outline" onClick={() => returnToWorkspace()}>Volver al listado</Button></div></Card>;
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
    : leavingDraft
    ? { tone: 'neutral', message: 'Confirmando copia en este dispositivo…' }
    : savingDraft
    ? { tone: 'neutral', message: 'Guardando cambios en el servidor…' }
    : staleDraft
      ? { tone: legacyReview ? 'warning' : 'error', message: legacyReview ? 'Revisando la copia anterior · elegí qué recuperar.' : 'Hay versiones en conflicto. Revisá el borrador anterior antes de guardar.' }
      : currentFingerprint === serverFingerprint
        ? { tone: 'success', message: 'Guardado en servidor.' }
        : storageFailed
          ? { tone: 'error', message: 'No hay copia local confirmada. No cierres esta pantalla; guardá con conexión.' }
          : saveFailed
            ? { tone: 'error', message: 'No se confirmó el guardado. Reintentá; la copia local sigue disponible.' }
            : localFingerprint === currentFingerprint
              ? { tone: 'warning', message: 'Solo en este dispositivo · falta guardar en servidor.' }
              : { tone: 'warning', message: 'Falta guardar en servidor.' };
  const saveDisabled = !draftReady || !canWriteDraft() || Boolean(staleDraft) || syncingEvidence || changingStage || leavingDraft;
  const draftInspection = { ...inspection, items, comparaciones: comparisons, informeTecnico, datosActa, numeroActa, ubicacion, observaciones };
  const context = <div className="space-y-6">
    <p className="text-sm leading-relaxed text-neutral-600"><span className="font-semibold">Inspector:</span> {inspection.inspector.nombre} {inspection.inspector.apellido || ''}{actor?.cuit && <span className="block">CUIT del inspeccionado: {actor.cuit}</span>}</p>
    <div className="grid gap-5 border-t border-neutral-200 pt-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-neutral-700">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Asignar número" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-normal text-neutral-900 disabled:bg-neutral-50" /></label>
      <InspectionLocationField label="Ubicación" value={ubicacion} onChange={setUbicacion} disabled={!canEdit} options={actor ? inspectionLocationSuggestions(actor, inspection.comparaciones) : []} />
    </div>
    <InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="visita" />
  </div>;
  const observationLabel = environmentalInspection ? `Registro de ${INSPECTION_TYPES[inspectionType].label.toLocaleLowerCase('es-AR')}` : inspection.tipoActor ? 'Registro de lo observado' : 'Descripción de la denuncia o hallazgo';
  const observationEditor = <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="inspection-observations" className="text-base font-bold text-neutral-900">{observationLabel}</label>
        {canEdit && <OfflineDictation compact active={sheet || location.hash.startsWith('#acta')} onActiveChange={setDictating} onText={(text) => { const current = currentDraftRef.current; if (!current) return; const next = { ...current, observaciones: appendDictatedText(current.observaciones, text) }; currentDraftRef.current = next; setObservaciones(next.observaciones); storeDraft(next); }} />}
      </div>
      <textarea id="inspection-observations" disabled={!canEdit} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={4} placeholder="Qué observaste, dónde y en qué condiciones. Podés escribir o dictar." className="block w-full resize-y rounded-lg border border-neutral-400 p-3 text-base font-normal leading-relaxed text-neutral-900 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" />
    </div>;
  const act = <div className="mx-auto max-w-3xl space-y-6">
    {observationEditor}
    <InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="constatacion" />
    <InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="medidas" />
    <details className="rounded-lg border border-neutral-200 px-4"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Constancias y datos complementarios</summary><InspectionDocumentsPanel actorType={environmentalInspection ? null : inspection.tipoActor} section="acta" actData={datosActa} report={informeTecnico} actEditable={canEdit} reportEditable={false} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} /></details>
  </div>;
  const evidence = <><EvidenceCard separatePhotos inspection={inspection} pendingEvidence={pendingEvidence} pendingActions={canEdit ? pendingEvidenceActions : undefined} editable={canEdit} recording={recording} onCamera={() => cameraRef.current?.click()} onFile={() => fileRef.current?.click()} onAudio={toggleRecording} onAnnul={annulEvidence} /><InspectionPhotoDescriptions inspection={inspection} actions={photo => canEdit ? <EvidenceAnnulControl evidence={photo} onAnnul={annulEvidence} /> : null} editable={Boolean(canEdit && currentFingerprint === serverFingerprint && !savingDraft && !pendingEvidence.length && !organizationPending)} /></>;
  const report = <InspectionDocumentsPanel section="informe" actData={datosActa} report={informeTecnico} actEditable={false} reportEditable={canEditReport} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} />;
  const readiness = <>{fieldEditAllowed ? <FieldReadinessPanel requiresComparison={Boolean(inspection.tipoActor)} state={inspection.estado} items={items} comparisons={comparisons} pendingEvidenceCount={pendingEvidence.length} /> : inspection.tipoActor && dossierReadiness ? <DossierReadinessPanel readiness={dossierReadiness} /> : null}
    {inspection.tipoActor && (inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && <label className="block text-sm font-semibold text-neutral-700">Plazo de respuesta<input aria-label="Plazo de respuesta" type="datetime-local" value={plazoRespuestaAt} onChange={(event) => setPlazoRespuestaAt(event.target.value)} className="mt-2 h-11 w-full max-w-sm rounded-lg border border-neutral-300 px-3 text-sm" /><span className="mt-2 block text-xs font-normal text-neutral-500">La aprobación no envía correos; deja el expediente preparado.</span></label>}
    {guided && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><h3 className="text-sm font-bold text-neutral-900">{inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'Hallazgo en revisión · sin responsable identificado' : 'Cambio de etapa'}</h3><p role={inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'status' : undefined} className="mt-2 text-sm leading-relaxed text-neutral-600">{fieldEditAllowed ? 'Enviar a revisión cierra el trabajo de campo con los cambios y evidencias guardados. No aprueba la inspección ni notifica al inspeccionado.' : inspection.estado === 'EN_REVISION' && !inspection.tipoActor ? 'No hay destinatario para notificar ni plazo que fijar. Podés completar el informe técnico. Si identificás al responsable, devolvé a campo, vinculalo en Visita y contrastá sus datos antes de aprobar.' : 'El acta de campo está cerrada. Podés completar el informe técnico; los datos de campo requieren una devolución expresa.'}</p><div className="mt-4 flex flex-wrap gap-3">
      {inspection.estado === 'EN_REVISION' && isAdmin && canWriteDraft() && <Button variant="outline" onClick={() => transition('EN_CAMPO')} disabled={!isOnline || Boolean(staleDraft) || transitionMutation.isPending}>Devolver a campo</Button>}
      {primaryAction && canWriteDraft() && <Button aria-label={primaryAction.label} aria-describedby={primaryAction.state === 'NOTIFICADA' ? 'approval-readiness-hint' : undefined} leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft) || (primaryAction.state === 'EN_REVISION' && (!items.every(item => !item.obligatorio || item.resultado !== 'PENDIENTE') || Boolean(inspection.tipoActor && (!comparisons.length || comparisons.some(row => row.resultado === 'PENDIENTE'))))) || (primaryAction.state === 'NOTIFICADA' && (!plazoRespuestaAt || approvalBlocked))}>{primaryAction.label}</Button>}
    </div></div>}
    <details className="rounded-lg border border-neutral-200 px-4"><summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Consultar el expediente completo</summary><InspectionReport inspection={draftInspection} readiness={canEdit || !inspection.tipoActor ? undefined : dossierReadiness || undefined} /></details>
  </>;
  const checklist = <Checklist flat={sheet} inspectionId={inspection.id} groups={fieldGroups} items={items} completed={completed} editable={canEdit} setItems={setItems} uploadingItemId={uploadingItemId} pendingEvidence={pendingEvidence} onEvidence={(file, item) => upload(file, { itemId: item.id, descripcion: item.observacion?.trim() || 'Evidencia vinculada al control ' + item.codigo })} onAnnul={annulEvidence} onDictationActiveChange={setDictating} onDictatedText={(itemId, text) => { const current = currentDraftRef.current; if (!current) return; const next = { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, observacion: appendDictatedText(item.observacion || '', text) } : item) }; currentDraftRef.current = next; setItems(next.items); storeDraft(next); }} />;
  const signatureReady = currentFingerprint === serverFingerprint && !pendingEvidence.length && !savingDraft && !organizationPending && !pendingEvidenceReadFailed && !staleDraft && !syncingEvidence && !changingStage && canWriteDraft();
  const steps: InspectionWorkspaceStep[] = guided ? [
    { id: 'resumen', label: 'Preparar la inspección', title: 'Preparar la inspección', description: 'Confirmá a quién vas a inspeccionar, dónde y con qué número de acta.', detail: numeroActa || 'Acta sin numerar', complete: Boolean(numeroActa.trim() && ubicacion.trim()), content: context, nextAction: primaryAction?.state === 'EN_CAMPO' && canWriteDraft() ? <Button size="lg" className="min-h-14 w-full sm:w-auto" leftIcon={<Play size={22} aria-hidden="true" />} isLoading={changingStage} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft)} onClick={async () => { if (await transition('EN_CAMPO')) navigate({ pathname: location.pathname, search: location.search, hash: inspection.tipoActor ? '#checklist' : '#acta' }); }}>Iniciar visita</Button> : undefined },
    { id: 'checklist', label: 'Recorrido de campo', title: 'Recorrido de campo', description: 'Empezá por instalaciones, residuos u operación; registrá cada hallazgo y su evidencia en el lugar.', detail: completed + ' de ' + items.length + ' controles', complete: items.length > 0 && completed === items.length, anchors: orderedItems.map((item) => ({ id: item.codigo, label: item.etiqueta, group: item.categoria, reviewed: item.resultado !== 'PENDIENTE', detail: item.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (RESULTS.find((result) => result.value === item.resultado)?.label || item.resultado) })), content: checklist },
    { id: 'declaracion', label: 'Contraste con registros', title: 'Contraste con registros', description: 'Contrastá lo observado con la fotografía declarada. Los datos administrativos quedan al final como contexto.', detail: inspection.tipoActor ? reviewedComparisons + ' de ' + comparisons.length + ' contrastados' : 'Sin declaración vinculada', complete: !inspection.tipoActor || (comparisons.length > 0 && reviewedComparisons === comparisons.length), anchors: orderedComparisons.map((row) => ({ id: row.codigo, label: row.etiqueta, group: row.categoria, reviewed: row.resultado !== 'PENDIENTE', detail: row.resultado === 'PENDIENTE' ? 'Pendiente' : 'Revisado · ' + (COMPARISON_RESULT_LABELS[row.resultado] || row.resultado) })), content: !inspection.tipoActor ? <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">Este hallazgo todavía no tiene responsable identificado. Podés registrar lo observado y enviarlo a revisión sin contrastar una declaración. Si identificás al responsable, vinculalo desde «Preparar la inspección»; se incorporarán sus datos declarados.</p> : <InspectionComparisonPanel embedded inspectionId={inspection.id} comparisons={orderedComparisons} declaredDocuments={inspection.declaradoSnapshot?.documents} editable={canEdit} onSave={save} saving={savingDraft} saveStatus={saveStatus} saveDisabled={saveDisabled} onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} /> },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Todas las evidencias del expediente. Las fotos de un hallazgo se agregan desde su control.', detail: pendingEvidence.length ? pendingEvidence.length + ' por sincronizar' : inspection.evidencias.filter((entry) => !entry.anuladaAt).length + ' archivos', content: evidence },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registrá lo constatado, quién intervino y las formalidades. Una negativa o imposibilidad se documenta; no se presume.', detail: fieldEditAllowed ? (observaciones.trim() ? 'Con registro' : 'Sin registrar') : 'Campo cerrado · consulta', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Fundamentá la evaluación. Este documento complementa el acta de campo y no la reemplaza.', detail: reportCompleted + ' de 5 apartados' + (reportCompleted === 5 && !informeTecnico.expedienteElectronico?.trim() ? ' · falta expediente electrónico' : ''), complete: reportCompleted === 5 && Boolean(informeTecnico.expedienteElectronico?.trim()), content: report },
    { id: 'revision', label: inspection.tipoActor ? 'Revisar y enviar' : 'Revisar hallazgo', title: inspection.tipoActor ? 'Revisar y enviar' : 'Revisar hallazgo', description: inspection.tipoActor ? 'Verificá los pendientes y el informe consolidado antes de cambiar de etapa. Recorrer los pasos no aprueba ni envía la inspección.' : 'Conservá el informe y las evidencias. La notificación requiere identificar primero a un destinatario.', detail: LABELS[inspection.estado], complete: Boolean(inspection.tipoActor && dossierReadiness?.ready), content: readiness },
  ] : [
    { id: 'resumen', label: 'Resultado de la inspección', title: 'Resultado de la inspección', description: 'Hallazgos, controles y documentación del expediente.', detail: LABELS[inspection.estado], content: <><p className="text-sm text-neutral-600">La visita está cerrada. Consultá el acta registrada, las evidencias o las presentaciones del inspeccionado.</p><p className="whitespace-pre-wrap leading-relaxed">{inspection.observaciones}</p><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Acta</dt><dd className="font-semibold">{inspection.numeroActa || inspection.numero}</dd></div><div><dt className="text-neutral-500">Lugar registrado</dt><dd>{inspection.ubicacion || 'Sin lugar consignado'}</dd></div></dl><details className="rounded-lg border px-4"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Ver expediente completo</summary><InspectionReport inspection={draftInspection} readiness={dossierReadiness || undefined} /></details></> },
    { id: 'acta', label: 'Acta de campo', title: 'Acta de campo', description: 'Registro de campo cerrado. Consulta de los hechos y formalidades.', content: act },
    { id: 'informe-tecnico', label: 'Informe técnico para Legales', title: 'Informe técnico para Legales', description: 'Evaluación técnica que acompaña el acta.', content: report },
    { id: 'evidencias', label: 'Evidencias', title: 'Evidencias', description: 'Archivos y fotografías, conservando su relación con los hallazgos.', content: evidence },
  ];
  if (!inspection.tipoActor) {
    const declaration = steps.findIndex((step) => step.id === 'declaracion');
    if (declaration >= 0) steps.splice(declaration, 1);
  }
  const reference: InspectionWorkspaceStep[] = [
    // Scheduling and device recovery are dossier tools, not field tasks: they live under «Expediente y seguimiento».
    { id: 'organizacion', label: 'Asignación y programación', title: 'Asignación y programación', description: 'Inspector asignado, fecha prevista e inicio de la visita.', content: <div className="space-y-5"><InspectionOrganizationPanel key={`${inspection.id}:${inspection.version}`} onPendingChange={setOrganizationPending} inspection={inspection} admin={isAdmin} backPath={`${mobile ? '/mobile' : ''}/inspecciones`} disabled={!isOnline || currentFingerprint !== serverFingerprint || Boolean(staleDraft) || pendingEvidence.length > 0 || recording || savingDraft || syncingEvidence || !canWriteDraft()} /><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-neutral-500">Programada</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.fechaProgramada, true)}</dd></div><div><dt className="text-xs text-neutral-500">Inicio de campo</dt><dd className="mt-1 font-medium">{inspectionDate(inspection.iniciadaAt, true)}</dd></div></dl></div> },
    { id: 'firma', label: 'Leer y firmar', title: 'Leer y firmar el acta', description: 'Presentá el contenido al inspeccionado y conservá su firma con la versión revisada.', content: <><InspectionSignaturePanel inspectionId={inspection.id} saved={signatureReady} editable={Boolean(canEdit && isOnline)} /></> },
    { id: 'entrega', label: 'Copia del acta y respuestas', title: 'Copia del acta y respuestas', description: 'Acceso limitado al acta y sus presentaciones.', content: <InspectionActAccessPanel inspection={inspection} /> },
    ...(showExchangePanel ? [{ id: 'intercambios', label: 'Comunicaciones y respuestas', title: 'Comunicaciones y respuestas', description: 'Intercambios auditados con el inspeccionado y documentación de cada intervención.', content: <InspectionExchangePanel inspectionId={inspection.id} /> }] : []),
    { id: 'trazabilidad', label: 'Trazabilidad', title: 'Trazabilidad', description: 'Quién hizo cada intervención, cuándo y con qué documentación.', content: <InspectionTimeline inspection={inspection} canComment={Boolean(isAdmin)} busy={eventMutation.isPending} onAdd={async (input, file) => { try { await eventMutation.mutateAsync({ input, file }); toast.success('Registro actualizado', input.tipo === 'NOTIFICACION_PREPARADA' ? 'Borrador de notificación registrado como no enviado.' : 'Nota interna incorporada.'); } catch (error: unknown) { toast.error('No se pudo registrar', inspectionErrorMessage(error, 'Revise los datos.')); throw error; } }} /> },
    { id: 'verificacion', label: 'Verificación QR', title: 'Verificación QR', description: 'Referencia verificable de la versión registrada en el servidor.', content: <InspectionVerificationBlock verification={inspection.verificacion} /> },
    ...(fieldEditAllowed ? [{ id: 'copias', label: 'Copias de versiones anteriores', title: 'Copias de versiones anteriores', description: 'Herramienta de recuperación: busca copias antiguas guardadas en este dispositivo. No muestra el borrador actual.', content: <InspectionLegacyRecovery embedded afterReview={() => navigate({ pathname: location.pathname, search: location.search, hash: '#acta' })} afterRecoveredFile={() => navigate({ pathname: location.pathname, search: location.search, hash: '#evidencias' })} userId={String(currentUser!.id)} inspectionId={inspection.id} owner={owner} destination={`${currentUser!.nombre || 'Mi cuenta'} · ${workspaceRoleLabel(currentUser!.rol)}${currentUser!.empresaContexto ? ' · ' + currentUser!.empresaContexto.razonSocial + ' · ' + (currentUser!.empresaContexto.establecimiento?.nombre || 'Todas las sedes') : ''} · ${inspection.numero}`} disabled={!canEdit || !isOnline || savingDraft || syncingEvidence || changingStage || recoveringDraft} verifyAccess={async () => {
      const scope = evidenceScopeRef.current;
      const fresh = await inspeccionService.get(inspection.id);
      if (!scope || scope !== evidenceScopeRef.current || !canWriteDraft()) throw new Error('El contexto cambió. Volvé a abrir el expediente.');
      const authorized = currentUser?.esJefeInspecciones || currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${fresh.tipoActor}` || (currentUser?.esInspector && String(fresh.inspectorId) === String(currentUser.id));
      if (!authorized || !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(fresh.estado)) throw new Error('Este contexto ya no puede editar la visita. Actualizá el expediente.');
      if (fresh.version !== inspection.version) { void query.refetch(); throw new Error('El expediente cambió. Revisá la versión actual antes de recuperar.'); }
    }} onReview={async raw => {
      const current = currentDraftRef.current;
      if (!current || !canWriteDraft()) return;
      const saved = storeDraft(current) && await checkpointConfirmationRef.current;
      if (!saved || !canWriteDraft()) throw new Error('Primero debe confirmarse la copia del trabajo actual.');
      setStaleDraft(reconcileStoredDraft(JSON.parse(raw), current).draft); setLegacyReview(true);
    }} onRecoveredFile={refreshPendingEvidence} /> }] : []),
  ];
  const fieldSaveStatus: DraftSaveStatus = organizationPending && saveStatus.tone === 'success'
    ? { tone: 'warning', message: 'Organización sin confirmar' }
    : saveStatus;
  const fieldSaveDetail = storageFailed ? 'Conservá esta pantalla abierta.'
    : organizationPending ? 'Usá Confirmar organización antes de salir.'
    : pendingEvidenceReadFailed ? 'Capturas locales sin verificar.'
    : pendingEvidence.length ? `${pendingEvidence.length} ${pendingEvidence.length === 1 ? 'captura por enviar' : 'capturas por enviar'}${!isOnline ? ' · sin conexión' : ''}`
      : !isOnline ? 'Sin conexión · podés seguir registrando.'
        : '';
  const clock = (value: number | string) => new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sheetStatusText = savingDraft ? 'Guardando…'
    : staleDraft || storageFailed || saveFailed || draftOwnership.status !== 'owned' || leavingDraft ? saveStatus.message
    : currentFingerprint !== serverFingerprint ? (dictating ? 'Dictado en curso · se guarda al terminar' : recording ? 'Grabando audio · se guarda al terminar' : isOnline ? 'Guardando…' : 'Sin conexión · guardado en este dispositivo')
    : 'Guardado ' + clock(lastSavedAt ?? inspection.updatedAt);
  const sheetStatus = <p role="status" data-testid="inspection-field-status" className={saveStatus.tone === 'error' ? 'text-error-800' : undefined}>{sheetStatusText}{fieldSaveDetail && <span className="block text-xs text-neutral-600">{fieldSaveDetail}</span>}</p>;
  const sheetStart = sheet && canWriteDraft() && (inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA') ? <><p className="mb-3 text-sm text-neutral-800">Al llegar, iniciá la visita. El formulario ya se puede completar.</p><Button size="lg" className="min-h-14 w-full sm:w-auto" leftIcon={<Play size={22} aria-hidden="true" />} isLoading={changingStage} disabled={!isOnline || pendingEvidence.length > 0 || Boolean(staleDraft)} onClick={() => void transition('EN_CAMPO')}>Iniciar visita</Button></> : undefined;
  const sendBlocked = !isOnline || pendingEvidence.length > 0 || Boolean(staleDraft) || !items.every(item => !item.obligatorio || item.resultado !== 'PENDIENTE') || Boolean(inspection.tipoActor && (!comparisons.length || comparisons.some(row => row.resultado === 'PENDIENTE')));
  const sheetAction = sheet && canWriteDraft() && inspection.estado === 'EN_CAMPO' ? <><FieldReadinessPanel requiresComparison={Boolean(inspection.tipoActor)} state={inspection.estado} items={items} comparisons={comparisons} pendingEvidenceCount={pendingEvidence.length} /><Button aria-label="Enviar a revisión" size="lg" className="min-h-14 w-full" leftIcon={<Send size={18} />} isLoading={transitionMutation.isPending} disabled={sendBlocked} onClick={() => void transition('EN_REVISION')}>Enviar a revisión</Button><p className="text-xs text-neutral-600">Cierra el trabajo de campo con lo guardado. No aprueba la inspección ni avisa al inspeccionado.</p></> : undefined;
  // One page in the order of the visit. Anchors keep the ids the readiness list links to.
  const fieldBlocks: InspectionFieldBlock[] = [
    { id: 'resumen', title: 'Dónde estoy y con quién', content: <>
      <InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="lugar" />
      <InspectionLocationField label="Ubicación" value={ubicacion} onChange={setUbicacion} disabled={!canEdit} options={actor ? inspectionLocationSuggestions(actor, inspection.comparaciones) : []} />
      <InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="visita" />
      <label className="block text-sm font-medium">Número de acta<input disabled={!canEdit} value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Asignar número" className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white p-3 text-base text-neutral-900 disabled:bg-neutral-50" /></label>
      <p className="text-sm text-neutral-600">Inspector: {inspection.inspector.nombre} {inspection.inspector.apellido || ''}{actor?.cuit ? ` · CUIT del inspeccionado ${actor.cuit}` : ''}</p>
    </> },
    { id: 'acta', title: 'Qué encontré', content: <>{observationEditor}<div id="evidencias">{evidence}</div><InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="constatacion" /></> },
    { id: 'checklist', title: 'Controles', content: <>{checklist}{inspection.tipoActor && <div id="declaracion"><h3 className="mb-3 font-semibold">Comparar con lo declarado</h3><InspectionComparisonPanel embedded inspectionId={inspection.id} comparisons={orderedComparisons} declaredDocuments={inspection.declaradoSnapshot?.documents} editable={canEdit} onChange={(rowId, patch) => setComparisons((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row))} onEvidence={(file, comparisonId) => upload(file, { comparacionId: comparisonId })} /></div>}<InspectionFieldModel value={datosActa} onChange={setDatosActa} disabled={!canEdit} section="medidas" /></> },
    { id: 'firma', title: 'Declaración y firma', content: <>
      <details className="rounded-lg border border-neutral-200 px-4"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Constancias y datos complementarios</summary><InspectionDocumentsPanel actorType={environmentalInspection ? null : inspection.tipoActor} section="acta" actData={datosActa} report={informeTecnico} actEditable={canEdit} reportEditable={false} onActDataChange={setDatosActa} onReportChange={setInformeTecnico} /></details>
      <InspectionSignaturePanel inspectionId={inspection.id} saved={signatureReady} editable={Boolean(canEdit && isOnline)} />
      <InspectionActAccessPanel inspection={inspection} />
    </> },
  ];
  const pauseFieldWork = async () => {
    if (recording || dictating || uploadingItemId || syncingEvidence || savingDraftRef.current || changingStage || pendingEvidenceReadFailed) return;
    if (organizationPending && !window.confirm('Los cambios de organización todavía no están guardados. ¿Salir sin confirmarlos? Los datos de campo se conservan por separado.')) return;
    // No Guardar button on the field sheet: leaving sends what is still unsaved.
    if (sheet && isOnline && !staleDraft && canWriteDraft() && currentDraftRef.current && draftFingerprint(currentDraftRef.current) !== serverFingerprintRef.current) await save();
    if (!staleDraft && currentDraftRef.current && canWriteDraft()) {
      const departing = draftFingerprint(currentDraftRef.current);
      const journaled = storeDraft(currentDraftRef.current);
      savingDraftRef.current = true; setLeavingDraft(true);
      let protectedCopy: boolean;
      try { protectedCopy = journaled && await checkpointConfirmationRef.current; }
      finally { savingDraftRef.current = false; setLeavingDraft(false); }
      if (!canWriteDraft() || evidenceScopeRef.current !== evidenceScope) return;
      if (!protectedCopy) { toast.error('No se pudo proteger el borrador', 'Conservá esta pantalla abierta y guardá con conexión.'); return; }
      if (currentDraftRef.current && draftFingerprint(currentDraftRef.current) !== departing) {
        toast.info('Hay cambios posteriores', 'Terminá de registrar el comentario y volvé a guardar y salir.'); return;
      }
    }
    // A quick exit can beat the scroll observer. Record the actual open control
    // synchronously, including a control that has just stopped being pending.
    const control = Array.from(document.querySelectorAll<HTMLElement>('[data-inspection-anchor^="checklist/"]'))
      .find((element) => element.getClientRects().length > 0 && element.querySelector('button[aria-expanded="true"]'));
    const anchor = control?.dataset.inspectionAnchor;
    if (anchor && currentUser?.id) {
      const item = items.find((entry) => 'checklist/' + entry.codigo === anchor);
      saveInspectionResume(currentUser.id, inspection.id, '#' + anchor, 'Recorrido de campo · ' + (item?.etiqueta || anchor), owner);
    }
    returnToWorkspace();
  };
  const defaultSection = reportEditAllowed && !fieldEditAllowed ? 'revision' : 'resumen';
  const activeSection = [...steps, ...reference].find(step => step.id === location.hash.slice(1).split('/')[0])?.id || defaultSection;
  const nextTaskId = nextInspectionTask(activeSection, [...steps, ...reference].map(step => step.id));
  const nextTask = [...steps, ...reference].find(step => step.id === nextTaskId);
  const continueJourney = async () => {
    if (!nextTask || saveDisabled || dictating || recording) return;
    if (currentFingerprint !== serverFingerprint && !await save()) return;
    if (!flushDraft()) return;
    navigate({ pathname: location.pathname, search: location.search, hash: '#' + nextTask.id });
  };
  // Phone: status on its own thin line, then one row of buttons. Wide: everything in one row.
  const fieldSaveAction = guided && canWriteDraft() ?
      <div data-testid="inspection-field-save-bar" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-4">
        <div className="flex min-w-0 basis-full flex-col justify-center sm:min-h-11 sm:flex-1 sm:basis-auto"><DraftSaveFeedback status={fieldSaveStatus} />{(dictating || fieldSaveDetail) && <p className="mt-0.5 text-xs leading-snug text-neutral-600">{dictating ? 'Dictado en curso · detenelo antes de salir.' : fieldSaveDetail}</p>}</div>
        {/* Keep the Android editor/keyboard in place until the ordinary click;
            moving focus on touch-down can move this footer before touch-up. */}
        <Button variant={nextTask ? 'outline' : 'primary'} aria-label={fieldEditAllowed ? 'Guardar cambios' : 'Guardar informe'} className={nextTask ? 'shrink-0 max-sm:px-2.5' : 'shrink-0 max-sm:px-3'} leftIcon={<Save size={16} />} isLoading={savingDraft} disabled={saveDisabled || dictating || recording || saveStatus.tone === 'success'} onPointerDown={(event) => { if (event.pointerType === 'touch') event.preventDefault(); }} onClick={() => { void save(); }}><span className={nextTask ? 'sr-only' : 'sm:hidden'}>Guardar</span><span className="hidden sm:inline">{fieldEditAllowed ? 'Guardar cambios' : 'Guardar informe'}</span></Button>
        {nextTask && <Button variant="primary" className="ml-auto min-h-11 max-w-full shrink-0 max-sm:flex-1 max-sm:px-3" rightIcon={<ArrowRight size={17} />} aria-label={(currentFingerprint === serverFingerprint ? 'Continuar a ' : 'Guardar y continuar a ') + inspectionTaskLabel(nextTask)} disabled={saveDisabled || dictating || recording || savingDraft} isLoading={savingDraft} onClick={() => void continueJourney()}>{currentFingerprint === serverFingerprint ? 'Continuar' : 'Guardar y continuar'}</Button>}
      </div> : undefined;
  return <div className="flex h-full min-h-0 min-w-0 flex-col" data-testid="inspection-page-frame">
  <div className="inspection-case flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain [overflow-anchor:none]" data-operational-page data-inspection-page-scroll {...(sheet ? {} : { 'data-inspection-scroll': '' })}>
    <header data-testid="inspection-case-header" className="relative flex shrink-0 flex-col gap-1.5 sm:gap-3">
        <div data-testid="inspection-case-actions" className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" aria-label={`Volver a ${workspaceReturn.label}`} title={`Volver a ${workspaceReturn.label}`} leftIcon={<ArrowLeft size={18} />} onClick={() => { if (dictating) return; if (guided && canWriteDraft()) { pauseFieldWork(); return; } if (!flushDraft()) return; returnToWorkspace(); }} disabled={dictating} className="shrink-0 px-2">{workspaceReturn.label}</Button>
          <div className="flex shrink-0 items-center gap-1">
          {fieldEditAllowed && <Link to={{ pathname: location.pathname, search: dossierView ? '' : '?vista=expediente', hash: location.hash }} onClick={(event) => { if (dictating || !flushDraft()) event.preventDefault(); }} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary-800 !no-underline hover:bg-primary-50">{dossierView ? 'Formulario de campo' : 'Expediente completo'}</Link>}
          <Button variant="outline" aria-label="Descargar expediente" title={currentUser?.training ? 'Capacitación: sin documentos oficiales' : 'Descargar expediente'} disabled={Boolean(currentUser?.training)} className="hidden lg:inline-flex" leftIcon={<Download size={18} />} isLoading={pdfMutation.isPending} onClick={() => pdfMutation.mutate('expediente')}><span className="sr-only lg:not-sr-only">Descargar expediente</span></Button>
          <DropdownMenu>
            <DropdownTrigger asChild><Button variant="ghost" className="px-2" aria-label="Otras descargas" disabled={Boolean(currentUser?.training)} rightIcon={<ChevronDown size={16} />} isLoading={pdfMutation.isPending}><span>Descargas</span></Button></DropdownTrigger>
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
        <div data-testid="inspection-case-identity" className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-lg sm:text-2xl font-bold text-neutral-900 break-words">{inspection.numero}</h2><Badge variant="soft" color={COLORS[inspection.estado] || 'neutral'}>{LABELS[inspection.estado]}</Badge>{isTrainingActNumber(inspection.numeroActa) && <Badge color="warning">Capacitación · datos sintéticos</Badge>}</div>
          {actor && <Link to={actorRoute} state={{ inspectionReturn: location.pathname + location.search + location.hash }} onClick={(event) => { if (dictating) { event.preventDefault(); return; } if (!flushDraft()) event.preventDefault(); }} aria-label={'Abrir actor inspeccionado: ' + actor.razonSocial} className="mt-1 block max-w-full rounded-sm break-words text-sm font-semibold text-neutral-700 !no-underline hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{actor.razonSocial}</Link>}
          <p className="mt-1 hidden text-xs text-neutral-500 lg:block">{INSPECTION_PHASES[inspectionPhaseOf(inspection.estado)].label} · Actualizada {inspectionDate(inspection.updatedAt, true)} · Versión {inspection.version}</p>
        </div>
    </header>
    {currentUser?.training && <p className="text-xs text-neutral-600">Capacitación: sin documentos oficiales.</p>}
    {(query.offlineCacheProblem || (guided && draftOwnership.status !== 'owned') || (pendingEvidenceReadFailed && guided) || !isOnline || pendingEvidence.length > 0 || storageFailed) && <details data-testid="inspection-storage-status" className="rounded-lg border border-neutral-200 bg-white px-4 text-sm">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 font-medium text-neutral-700"><span>{storageFailed ? 'Guardado local no confirmado · no cierres esta pantalla' : guided && draftOwnership.status !== 'owned' ? draftOwnership.status === 'blocked' ? 'Solo lectura · otra pestaña está editando' : draftOwnership.status === 'checking' ? 'Comprobando disponibilidad de edición' : 'Solo lectura · edición no disponible en este navegador' : query.offlineCacheProblem ? 'No se pudo preparar la copia sin conexión.' : pendingEvidenceReadFailed && guided ? 'Capturas locales sin verificar · cierre de campo no disponible' : !isOnline ? 'Sin conexión · trabajando en este dispositivo' : pendingEvidence.length + (pendingEvidence.length === 1 ? ' captura pendiente de enviar' : ' capturas pendientes de enviar')}</span><ChevronDown size={16} className="shrink-0" /></summary>
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
    {(!isOnline || pendingEvidence.length > 0 || storageFailed) && <div role="status" className="flex flex-col gap-2 border-t border-neutral-200 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2">{isOnline ? <CloudUpload size={18} className="shrink-0" /> : <CloudOff size={18} className="shrink-0" />}{storageFailed ? 'No hay copia local confirmada; no cierres esta pantalla. Guardá en el servidor con conexión.' : !isOnline ? 'Sin conexión · revisá la confirmación de guardado local junto a cada comentario. Las capturas pendientes se muestran por separado.' : pendingEvidence.length + (pendingEvidence.length === 1 ? ' captura pendiente de sincronización' : ' capturas pendientes de sincronización')}</span>{isOnline && pendingEvidence.length > 0 && <button type="button" onClick={() => void syncEvidence(true)} disabled={syncingEvidence || !canWriteDraft()} className="min-h-11 w-fit rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold disabled:opacity-60">{syncingEvidence ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}</div>}

      </div>
    </details>}
    {recording && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800"><span>Grabando audio de campo</span><Button variant="danger" size="sm" onClick={toggleRecording} leftIcon={<Square size={14} />}>Detener grabación</Button></div>}

    {staleDraft && <StaleDraftNotice legacy={legacyReview} busy={recoveringDraft} serverVersion={inspection.version} draftVersion={staleDraft.version} conflicts={draftConflicts(legacyReview && currentDraftRef.current ? currentDraftRef.current : draftFromInspection(inspection), staleDraft)} onRecover={recoverStaleDraft} onDiscard={discardStaleDraft} />}
    {manualRecoveryRef.current && !staleDraft && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Texto recuperado sólo en este dispositivo. Revisalo y elegí Guardar cambios para incorporarlo al expediente.</p>}
    <fieldset disabled={changingStage} className="min-w-0 shrink-0">{sheet ? <InspectionFieldSheet blocks={fieldBlocks} start={sheetStart} status={sheetStatus} action={sheetAction} /> : <InspectionWorkspace pageScroll continuationManaged={Boolean(fieldSaveAction)} key={id} steps={steps} reference={reference} guided={guided} defaultStep={defaultSection} resumeIdentity={currentUser?.id ? { userId: currentUser.id, inspectionId: inspection.id, owner } : undefined} onBeforeNavigate={flushDraft} />}</fieldset>
  </div>
  {!sheet && fieldSaveAction && (steps.some(step => step.id === activeSection) || ['firma', 'entrega'].includes(activeSection)) && <footer data-testid="inspection-action-bar" className="shrink-0 border-t border-neutral-200 bg-white px-3 py-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-6">{fieldSaveAction}</footer>}
    <input ref={cameraRef} aria-label="Tomar foto general" type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" className="hidden" onChange={uploadFromInput} />
    <input ref={fileRef} aria-label="Adjuntar archivo general" type="file" accept={INSPECTION_EVIDENCE_ACCEPT} className="hidden" onChange={uploadFromInput} />
  </div>;
};

function StaleDraftNotice({ serverVersion, draftVersion, conflicts, onRecover, onDiscard, legacy = false, busy = false }: { serverVersion: number; draftVersion: number; conflicts: DraftConflict[]; onRecover: (selectedKeys: string[]) => void; onDiscard: () => void; legacy?: boolean; busy?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const review = useRef<HTMLElement>(null);
  useEffect(() => { if (legacy) review.current?.focus(); }, [legacy]);
  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  return <section ref={review} tabIndex={-1} role="alert" aria-label={legacy ? 'Revisión de copia anterior' : 'Conciliar borrador anterior'} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">
    <div className="flex items-start gap-3">
      <History size={19} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">{legacy ? 'Elegí qué recuperar en esta actividad' : 'Hay un borrador anterior sin conciliar'}</p>
        <p className="mt-1 text-xs leading-relaxed">{legacy ? 'El original se conserva. Recuperar no envía cambios al expediente.' : draftVersion === serverVersion ? 'El dispositivo conserva un borrador de formato anterior o incompleto.' : `El dispositivo conserva cambios de la versión ${draftVersion}; el servidor está en la versión ${serverVersion}.`}{!legacy && ' No se descartó ni fusionó nada automáticamente.'}</p>
        <p className="mt-1 text-xs font-semibold">Elegí los campos a recuperar. Los demás mantienen {legacy ? 'tu trabajo actual' : 'el valor del servidor'}.</p>
        {conflicts.length > 0 ? <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2">{conflicts.map((conflict) => <label key={conflict.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-amber-50"><input type="checkbox" disabled={busy} checked={selected.includes(conflict.key)} onChange={() => toggle(conflict.key)} className="mt-1 h-4 w-4 accent-amber-900" /><span className="min-w-0 break-words text-xs"><strong className="block text-sm">{conflict.label}</strong><span className="mt-1 block text-neutral-600">{legacy ? 'Trabajo actual' : 'Servidor'}: {conflict.serverValue}</span><span className="block font-semibold text-amber-900">Dispositivo: {conflict.localValue}</span></span></label>)}</div> : <p className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs">No se detectaron valores diferentes.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || (legacy && selected.length === 0)} onClick={() => onRecover(selected)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-900 px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-60"><RotateCcw size={15} />Aplicar selección ({selected.length})</button>
          <button type="button" disabled={busy} onClick={onDiscard} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-xs font-bold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-60">{legacy ? <><ArrowLeft size={15} />Volver sin recuperar</> : <><Trash2 size={15} />Descartar borrador anterior</>}</button>
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
  const pendingControls = items.filter(item => item.obligatorio && item.resultado === 'PENDIENTE').length;
  const pendingComparisons = comparisons.filter(row => row.resultado === 'PENDIENTE').length;
  const checks = [
    { ready: state === 'EN_CAMPO', label: 'Iniciar la visita', target: 'resumen' },
    { ready: pendingControls === 0, label: pendingControls + ' controles obligatorios pendientes', target: 'checklist' },
    { ready: !requiresComparison || (comparisons.length > 0 && pendingComparisons === 0), label: comparisons.length ? pendingComparisons + ' datos declarados por contrastar' : 'Revisar la declaración del actor', target: 'declaracion' },
    { ready: pendingEvidenceCount === 0, label: pendingEvidenceCount + ' capturas por sincronizar', target: 'evidencias' },
  ];
  const missing = checks.filter(check => !check.ready);
  return <section data-testid="inspection-field-readiness" aria-live="polite" className={'rounded-lg border p-4 ' + (missing.length ? 'border-amber-300 bg-amber-50' : 'border-success-200 bg-success-50')}>
    <h3 className="font-bold text-neutral-900">{missing.length ? 'Antes de enviar a revisión' : 'Listo para enviar a revisión'}</h3>
    {missing.length ? <><p className="mt-2 text-sm text-neutral-700">Abrí cada pendiente para resolverlo.</p><ul className="mt-3 space-y-2">{missing.map(check => <li key={check.target}><a href={'#' + check.target} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950 !no-underline">{check.label}<ArrowRight size={17} className="shrink-0" /></a></li>)}</ul></> : <p className="mt-2 text-sm text-neutral-700">Los controles obligatorios, el contraste y las capturas están completos. Revisá el contenido y la firma antes de cerrar el trabajo de campo.</p>}
  </section>;
}

function DossierReadinessPanel({ readiness }: { readiness: InspectionDossierReadiness }) {
  const technical = new Set(['Expediente electrónico', 'Objetivo técnico', 'Antecedentes', 'Evaluación técnica', 'Conclusión técnica', 'Recomendación técnica']);
  const groups = [
    { title: 'Informe técnico', target: 'informe-tecnico', items: readiness.missing.filter(item => technical.has(item)), action: 'Completar informe técnico' },
    { title: 'Constancias del trabajo de campo', target: 'acta', items: readiness.missing.filter(item => !technical.has(item) && item !== 'Plazo de respuesta'), action: 'Consultar constancias de campo' },
  ];
  return <section data-testid="inspection-dossier-readiness" aria-live="polite" className="space-y-4">
    <h3 className="font-bold text-neutral-900">{readiness.ready ? 'Listo para la decisión administrativa' : 'Pendientes de revisión administrativa'}</h3>
    <p id="approval-readiness-hint" className="text-sm text-neutral-700">{readiness.ready ? 'Los controles documentales están completos. La aprobación administrativa no reemplaza el dictamen de Legales.' : 'El equipo revisor completa el informe. Si faltan constancias de la visita, debe devolver el acta a campo para que el inspector las registre.'}</p>
    {readiness.missing.includes('Plazo de respuesta') && <p className="rounded-lg bg-amber-50 p-3 text-sm">Definí el plazo de respuesta en el campo de abajo.</p>}
    {groups.filter(group => group.items.length).map(group => <div key={group.target} className="rounded-lg border border-amber-200 p-3"><h4 className="text-sm font-semibold">{group.title}</h4><ul className="mt-2 space-y-1 text-sm text-neutral-700">{group.items.map(item => <li key={item}>{item}</li>)}</ul><a href={'#' + group.target} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-primary-800 underline">{group.action}<ArrowRight size={16} /></a></div>)}
  </section>;
}

function Meta({ icon, label, value, detail, to, onNavigate, returnTo }: { icon: React.ReactNode; label: string; value: string; detail?: string; to?: string; onNavigate?: () => boolean; returnTo?: string }) { return <div className="flex gap-3"><span className="mt-0.5 shrink-0 text-neutral-500 [&>svg]:h-[19px] [&>svg]:w-[19px]">{icon}</span><div className="min-w-0"><p className="text-xs text-neutral-500">{label}</p>{to ? <Link to={to} state={{ inspectionReturn: returnTo }} onClick={event => { if (onNavigate?.() === false) event.preventDefault(); }} className="rounded-sm font-bold text-[#10213A] transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Abrir ${label.toLowerCase()}: ${value}`}>{value}</Link> : <p className="font-bold text-[#10213A]">{value}</p>}{detail && <p className="text-xs text-neutral-500">{detail}</p>}</div></div>; }
function DraftSaveFeedback({ status }: { status: DraftSaveStatus }) {
  const color = status.tone === 'error' ? 'text-error-800' : status.tone === 'success' ? 'text-success-800' : 'text-neutral-700';
  // On a phone the status shares one row with two buttons: one or two words, never a sentence.
  const compact = status.tone === 'success' ? 'Guardado' : status.message === 'Guardando cambios en el servidor…' ? 'Guardando…' : status.message.startsWith('Solo en este dispositivo') || status.message === 'Falta guardar en servidor.' ? 'Sin guardar' : status.message;
  return <p role="status" aria-label={status.message} aria-live="polite" className={'text-sm font-medium leading-snug max-sm:text-xs max-sm:leading-4 ' + color}>{compact !== status.message ? <><span className="sm:hidden" aria-hidden="true">{compact}</span><span className="max-sm:sr-only">{status.message}</span></> : status.message}</p>;
}

function ChecklistJumpIndex({ items, activeId, onSelect }: { items: InspectionItem[]; activeId?: string; onSelect: (item: InspectionItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = items.find((item) => item.id === activeId);
  const matches = items.filter((item) => `${item.etiqueta} ${item.codigo} ${item.categoria}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  useEffect(() => {
    if (!open) return;
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
      {open && <><label className="flex min-h-11 items-center gap-2 border-b border-neutral-200 px-3"><Search size={17} className="shrink-0 text-neutral-500" aria-hidden="true" /><span className="sr-only">Buscar control</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o código" className="min-h-11 w-full min-w-0 bg-transparent text-base sm:text-sm text-[#10213A] outline-none placeholder:text-neutral-500" /></label>
        <nav aria-label="Índice de controles" className="max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain py-1">{matches.length ? matches.map((item) => <button key={item.id} type="button" aria-current={activeId === item.id ? 'location' : undefined} onClick={() => select(item)} className={`flex min-h-12 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${activeId === item.id ? 'bg-primary-50' : ''}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">{items.indexOf(item) + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-snug text-[#10213A]">{item.etiqueta}</span><span className="block text-xs text-neutral-600">{item.categoria} · {item.codigo}</span></span><span className={`shrink-0 text-xs font-semibold ${item.resultado === 'NO_CUMPLE' ? 'text-error-700' : item.resultado === 'CUMPLE' ? 'text-success-800' : 'text-neutral-600'}`}>{status(item)}</span></button>) : <p className="px-4 py-4 text-sm text-neutral-600">No hay controles con ese nombre.</p>}</nav></>}
    </div>
  </div>;
}

function Checklist({ inspectionId, groups, items, completed, editable, setItems, uploadingItemId, pendingEvidence, onEvidence, onAnnul, onDictatedText, onDictationActiveChange, flat = false }: { flat?: boolean; inspectionId: string; groups: string[]; items: InspectionItem[]; completed: number; editable: boolean; setItems: React.Dispatch<React.SetStateAction<InspectionItem[]>>; uploadingItemId: string | null; pendingEvidence: PendingInspectionEvidence[]; onEvidence: (file: File, item: InspectionItem) => void; onAnnul: (evidenceId: string, reason: string) => Promise<void>; onDictatedText: (itemId: string, text: string) => void; onDictationActiveChange: (active: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nonCompliant = items.filter((item) => item.resultado === 'NO_CUMPLE').length;
  const orderedItems = groups.flatMap((group) => items.filter((item) => item.categoria === group));
  const [expandedItem, setExpandedItem] = useState<string>();
  const [manuallyOpened, setManuallyOpened] = useState<Set<string>>(() => new Set());
  let linkedCode = '';
  try { linkedCode = decodeURIComponent(location.hash.split('/')[1] || ''); } catch { /* invalid anchors do not discard the draft */ }
  const linkedItem = location.hash.startsWith('#checklist/') ? items.find((item) => item.codigo === linkedCode) : undefined;
  const linkedItemId = linkedItem?.id;
  const activeItem = linkedItem?.id ?? expandedItem ?? orderedItems.find((item) => item.resultado === 'PENDIENTE')?.id ?? orderedItems[0]?.id;
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
    // Flat list: the index scrolls to the card (the inspector asked for it); nothing else moves.
    if (flat) { if (!item) return; setManuallyOpened((current) => new Set(current).add(item.id)); document.getElementById('control-' + item.id)?.scrollIntoView?.({ block: 'start' }); return; }
    preserveAnchor.current = !align ? preserveInspectionAnchor(document.getElementById('control-' + (item?.id || activeItem))) : null;
    pendingScrollHash.current = item ? '#checklist/' + encodeURIComponent(item.codigo) : '#checklist';
    setExpandedItem(item?.id || '');
    // Closing the focused mobile item must leave the headers available, not an
    // empty focused view. Decisions and observations remain in the parent draft.
    navigate({ pathname: location.pathname, search: location.search, hash: item ? '#checklist/' + encodeURIComponent(item.codigo) : '#checklist' }, { replace: true });
  };
  useLayoutEffect(() => {
    if (flat) return;
    // Router navigation can commit after local accordion state. Do not consume
    // preservation in the first commit and then run a second hash auto-scroll.
    if (pendingScrollHash.current !== null && pendingScrollHash.current !== location.hash) return;
    if (pendingScrollHash.current === null && handledScrollHash.current === location.hash) return;
    pendingScrollHash.current = null;
    handledScrollHash.current = location.hash;
    if (preserveAnchor.current) { preserveAnchor.current(); preserveAnchor.current = null; return; }
    if (!linkedItemId) return;
    const frame = requestAnimationFrame(() => revealInspectionAnchor(document.getElementById('control-' + linkedItemId)));
    // On a fresh load the first frame can run before the blocks above have their final height;
    // a late pass reveals the linked control if it is still out of view.
    const late = window.setTimeout(() => {
      const element = document.getElementById('control-' + linkedItemId), region = element?.closest<HTMLElement>('[data-inspection-scroll]');
      if (!element || !region) return;
      const offset = element.getBoundingClientRect().top - region.getBoundingClientRect().top;
      if (offset < 0 || offset > region.clientHeight * 0.6) revealInspectionAnchor(element);
    }, 400);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(late); };
  }, [linkedItemId, location.hash, expandedItem]);
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);
  const updateItem = (id: string, patch: Partial<InspectionItem>) => {
    // Keep the initial pending control in place after a decision; advancing is explicit.
    setExpandedItem(id);
    setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  return <section className="bg-white">
    {flat ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-3">
      <p className="text-sm font-semibold text-neutral-700">{completed} de {items.length} revisados{nonCompliant > 0 && <span className="ml-2 rounded-full bg-error-50 px-2.5 py-1 text-xs font-bold text-error-700">{nonCompliant} {nonCompliant === 1 ? 'no cumple' : 'no cumplen'}</span>}</p>
      <ChecklistJumpIndex items={orderedItems} onSelect={openControl} />
    </div> : <div className="border-b border-neutral-300 pb-4">
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
    </div>}
    {groups.map((group) => {
      const groupItems = items.filter((item) => item.categoria === group);
      const groupCompleted = groupItems.filter((item) => item.resultado !== 'PENDIENTE').length;
      const groupFails = groupItems.filter((item) => item.resultado === 'NO_CUMPLE').length;
      return <div key={group} className="mt-5">
        <div style={flat ? undefined : { top: 'var(--inspection-middle-top, 0px)' }} className={(flat ? '' : 'sticky z-10 ') + 'flex min-h-12 items-center justify-between gap-3 rounded-t-lg border border-neutral-300 bg-neutral-100 px-3 py-2 sm:px-5'}>
          <p className="font-bold text-[#10213A]">{group}</p>
          <div className="text-right text-xs font-semibold text-neutral-600"><span>{groupCompleted}/{groupItems.length} revisados</span>{groupCompleted < groupItems.length && <span className="text-warning-800"> · {groupItems.length - groupCompleted} pendientes</span>}{groupFails > 0 && <span className="text-error-800"> · {groupFails} {groupFails === 1 ? 'no cumple' : 'no cumplen'}</span>}</div>
        </div>
        {groupItems.map((item) => {
          const isFail = item.resultado === 'NO_CUMPLE';
          const itemEvidence = [...(item.evidencias || [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
          const itemEvidenceExpanded = expandedEvidence.includes(item.id);
          const visibleItemEvidence = itemEvidenceExpanded ? itemEvidence : itemEvidence.slice(0, 4);
          const pendingItemEvidence = pendingEvidence.filter((evidence) => evidence.fields.itemId === item.id);
          // Observation and photos appear once a result is chosen: a pending card shows only the three answers.
          const hasContent = isFail || Boolean(item.observacion) || itemEvidence.length > 0 || pendingItemEvidence.length > 0;
          // Flat list: a card opens by its content or by an explicit tap, and never closes on its own.
          const expanded = flat ? hasContent || manuallyOpened.has(item.id) : activeItem === item.id;
          const showObservation = flat ? expanded : hasContent || (editable && item.resultado !== 'PENDIENTE');
          return <div key={item.id} id={'control-' + item.id} data-inspection-anchor={'checklist/' + item.codigo} data-result={item.resultado} style={{ scrollMarginTop: 'var(--inspection-anchor-offset, 8rem)' }} className={`mt-2 rounded-lg border border-l-4 px-3 py-1 sm:px-5 ${isFail ? 'border-error-300 border-l-error-600 bg-error-50/30' : expanded ? 'border-primary-300 border-l-primary-700 bg-primary-50/50' : 'border-neutral-300 border-l-neutral-300 bg-white'}`}>
            {flat ? <div className="flex min-h-16 w-full items-start gap-3 py-3 text-left">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.resultado === 'CUMPLE' ? 'bg-success-100 text-success-700' : isFail ? 'bg-error-100 text-error-700' : item.resultado === 'NO_APLICA' ? 'bg-neutral-200 text-neutral-700' : 'border border-neutral-300 bg-white text-neutral-600'}`}>{item.resultado === 'CUMPLE' ? <Check size={16} /> : isFail ? <XCircle size={16} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={16} /> : <span className="text-xs font-bold">{orderedItems.indexOf(item) + 1}</span>}</div>
              <div className="min-w-0 flex-1"><p className="text-base font-semibold leading-relaxed text-[#10213A]">{item.etiqueta}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-neutral-500">{item.codigo}</span><span data-testid={'inspection-item-status-' + item.id} className={'rounded-md px-2 py-1 text-xs font-semibold ' + (item.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-900' : isFail ? 'bg-error-50 text-error-800' : item.resultado === 'CUMPLE' ? 'bg-success-50 text-success-800' : 'bg-neutral-100 text-neutral-700')}>{itemStatus(item)}</span>{item.observacion && <span className="text-xs text-neutral-600">Observación</span>}{itemEvidence.length + pendingItemEvidence.length > 0 && <span className="text-xs text-neutral-600">{itemEvidence.length + pendingItemEvidence.length} adjuntos</span>}</div></div>
            </div> : <button type="button" aria-expanded={expanded} aria-controls={'control-detail-' + item.id} onClick={() => openControl(expanded ? undefined : item, false)} className="flex min-h-16 w-full items-start gap-3 rounded-lg py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.resultado === 'CUMPLE' ? 'bg-success-100 text-success-700' : isFail ? 'bg-error-100 text-error-700' : item.resultado === 'NO_APLICA' ? 'bg-neutral-200 text-neutral-700' : 'border border-neutral-300 bg-white text-neutral-600'}`}>{item.resultado === 'CUMPLE' ? <Check size={16} /> : isFail ? <XCircle size={16} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={16} /> : <span className="text-xs font-bold">{orderedItems.indexOf(item) + 1}</span>}</div>
              <div className="min-w-0 flex-1"><p className="text-base font-semibold leading-relaxed text-[#10213A]">{item.etiqueta}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-neutral-500">{item.codigo}</span><span data-testid={'inspection-item-status-' + item.id} className={'rounded-md px-2 py-1 text-xs font-semibold ' + (item.resultado === 'PENDIENTE' ? 'bg-warning-50 text-warning-900' : isFail ? 'bg-error-50 text-error-800' : item.resultado === 'CUMPLE' ? 'bg-success-50 text-success-800' : 'bg-neutral-100 text-neutral-700')}>{itemStatus(item)}</span>{item.observacion && <span className="text-xs text-neutral-600">Observación</span>}{itemEvidence.length + pendingItemEvidence.length > 0 && <span className="text-xs text-neutral-600">{itemEvidence.length + pendingItemEvidence.length} adjuntos</span>}</div></div>
              {expanded ? <ChevronUp size={17} className="mt-1 shrink-0 text-neutral-500" /> : <ChevronDown size={17} className="mt-1 shrink-0 text-neutral-500" />}
            </button>}
            {/* The three answers stay at hand on every card; details open with a tap or once a result is chosen. */}
            {editable && <div role="group" aria-label={`Validación: ${item.etiqueta}`} className="grid grid-cols-3 gap-2 pb-3 pl-0 sm:pl-10">
                {RESULTS.map((option) => {
                  const selected = item.resultado === option.value;
                  return <button key={option.value} type="button" disabled={!editable} aria-pressed={selected} onClick={() => updateItem(item.id, { resultado: option.value })} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:flex-row sm:gap-1.5 sm:text-sm ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}>{option.icon}<span>{option.label}</span></button>;
                })}
              </div>}
            {flat && editable && !expanded && item.resultado !== 'PENDIENTE' && <button type="button" onClick={() => setManuallyOpened((current) => new Set(current).add(item.id))} className="mb-3 min-h-11 text-sm font-semibold text-primary-800 underline">Agregar observación o foto</button>}
            {/* A pending editable card has nothing to unfold yet: no empty details block with a lone «Siguiente pendiente». */}
            {expanded && (flat || showObservation || !editable) && <div id={'control-detail-' + item.id} className="pb-5 pl-0 sm:pl-10">
              {!editable && <div role="group" aria-label={`Validación: ${item.etiqueta}`} className="grid grid-cols-3 gap-2">
                {RESULTS.map((option) => {
                  const selected = item.resultado === option.value;
                  return <button key={option.value} type="button" disabled={!editable} aria-pressed={selected} onClick={() => updateItem(item.id, { resultado: option.value })} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:flex-row sm:gap-1.5 sm:text-sm ${selected ? option.active : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}>{option.icon}<span>{option.label}</span></button>;
                })}
              </div>}
              {showObservation && <div className={`mt-3 border-l-2 pl-3 ${isFail ? 'border-error-300' : 'border-neutral-300'}`}>
                <label><span className={`mb-1 block text-sm font-bold ${isFail ? 'text-error-900' : 'text-neutral-900'}`}>{isFail ? 'Hallazgo: qué no cumple' : 'Observación de este control'}</span><textarea disabled={!editable} aria-label={`Observación: ${item.etiqueta}`} value={item.observacion || ''} onChange={(event) => updateItem(item.id, { observacion: event.target.value })} rows={2} placeholder={isFail ? 'Qué encontraste, dónde y qué evidencia lo respalda' : 'Qué observaste en este control'} className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 ${isFail ? 'border-error-300 focus:border-error-600 focus:ring-error-100' : 'border-neutral-400 focus:border-primary-700 focus:ring-primary-100'}`} /></label>
                {editable && <div className="mt-2"><OfflineDictation buttonLabel="Dictar observación" active={flat || (expanded && location.hash.startsWith('#checklist'))} onActiveChange={onDictationActiveChange} onText={(text) => onDictatedText(item.id, text)} /></div>}
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
              </div>}
              {!flat && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3"><button type="button" disabled={!nextPendingAfter(item)} onClick={() => openControl(nextPendingAfter(item))} className="min-h-11 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-bold text-primary-800 disabled:bg-neutral-50 disabled:text-neutral-500">{nextPendingAfter(item) ? 'Siguiente pendiente' : remaining.length ? 'Último control pendiente' : 'Checklist revisado'}</button></div>}
            </div>}
          </div>;
        })}
      </div>;
    })}
  </section>;
}
export function EvidenceCard({ inspection, separatePhotos = false, pendingEvidence, pendingActions, editable, recording, onCamera, onFile, onAudio, onAnnul }: { separatePhotos?: boolean; inspection: NonNullable<ReturnType<typeof useInspection>['data']>; pendingEvidence: PendingInspectionEvidence[]; pendingActions?: PendingEvidenceActions; editable: boolean; recording: boolean; onCamera: () => void; onFile: () => void; onAudio: () => void; onAnnul: (evidenceId: string, reason: string) => Promise<void> }) {
  const [showAll, setShowAll] = useState(false);
  const activeCount = inspection.evidencias.filter((evidence) => !evidence.anuladaAt).length;
  const files = inspection.evidencias.filter(e => !separatePhotos || e.tipo !== 'FOTO' || e.anuladaAt || e.intercambioId);
  const visible = showAll ? files : files.slice(0, 5);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="hidden text-sm font-semibold text-neutral-700 lg:block">{activeCount} {activeCount === 1 ? 'archivo' : 'archivos'}{pendingEvidence.length ? ` · ${pendingEvidence.length} por sincronizar` : ''}</p>
      {editable && <div className="flex flex-wrap gap-2">
        <Button size="sm" leftIcon={<Camera size={16} />} onClick={onCamera}>Tomar foto</Button>
        <Button variant={recording ? 'danger' : 'outline'} size="sm" leftIcon={recording ? <Square size={15} /> : <Mic size={16} />} onClick={onAudio}>{recording ? 'Detener audio' : 'Grabar audio'}</Button>
        <Button variant="outline" size="sm" leftIcon={<Paperclip size={16} />} onClick={onFile}>Elegir archivo</Button>
      </div>}
    </div>
    {inspection.evidencias.length === 0 ? <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">Aún no hay archivos incorporados al expediente.</p> : <div className="space-y-2">{visible.map((evidence) => {
      const linkedItem = evidence.itemId ? inspection.items.find((item) => item.id === evidence.itemId) : null;
      return <div key={evidence.id} className={`overflow-hidden rounded-xl border p-3 ${evidence.anuladaAt ? 'border-neutral-300 bg-neutral-100' : 'border-neutral-200 bg-white'}`}><div className="flex items-center gap-3">{evidence.tipo === 'FOTO' ? <div className="w-20 shrink-0 sm:w-24"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} preview className={`h-20 w-full rounded-lg object-cover ${evidence.anuladaAt ? 'grayscale opacity-60' : ''}`} /></div> : <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${evidence.tipo === 'AUDIO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} ${evidence.anuladaAt ? 'opacity-50' : ''}`}>{evidence.tipo === 'AUDIO' ? <FileAudio size={20} /> : <FileText size={20} />}</span>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`min-w-0 break-words text-sm font-bold ${evidence.anuladaAt ? 'text-neutral-500 line-through' : 'text-[#10213A]'}`}>{evidence.nombreOriginal}</p>{evidence.anuladaAt && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700">Anulada</span>}</div>{linkedItem && <p className="mt-1 w-fit rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-800">Checklist · {linkedItem.codigo}</p>}{evidence.descripcion && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{evidence.descripcion}</p>}<p className="mt-1 text-xs text-neutral-500">{(evidence.bytes / 1024 / 1024).toFixed(1)} MB · {new Date(evidence.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p></div></div>{evidence.anuladaAt && <p className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-neutral-700"><span className="font-bold">Motivo de anulación:</span> {evidence.motivoAnulacion || 'Sin motivo informado'}</p>}{editable && !evidence.anuladaAt && <EvidenceAnnulControl evidence={evidence} onAnnul={onAnnul} />}</div>;
    })}{files.length > 5 && <button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{showAll ? 'Mostrar menos' : `Ver las ${files.length} evidencias`}</button>}</div>}
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

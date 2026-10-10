/**
 * SITREP v6 - Inscripcion Wizard (Public)
 * ========================================
 * Public page (no auth required for Phase 1) that allows
 * self-registration as Generador or Operador.
 *
 * Phase 1: Account creation (POST /api/solicitudes/iniciar)
 * Phase 2: Multi-step wizard to complete the solicitud
 *
 * Orchestrator: manages step state, navigation, form data aggregation.
 * Step UI is delegated to components in ./inscripcion/steps/.
 */

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, Check,
  Factory, FlaskConical, AlertCircle, Loader2, Truck, Save,
} from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import api, { getAccessToken } from '../../services/api';
import { registrationDraftHint, registrationSessionOwner } from '../../services/registrationSession';
import { clearRegistrationDraft, readRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';
import { readTrialDraft, saveTrialDraft } from '../../services/registrationTrial';
import { EMPTY_DRIVER, EMPTY_VEHICLE, fleetRows, fleetErrors, licenseDocumentType } from '../../services/registrationFleet';
import { RegistrationFleetFields } from '../../components/registration/RegistrationFleetFields';
import { previewDocument, type LicensePreview } from '../../services/documentPreview';
import type { ReceiptAnalysis } from '../../types/documentAnalysis';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { useRegistrationValidationFocus } from '../../hooks/useRegistrationValidationFocus';

// Shared constants & types
import {
  STEPS_GENERADOR,
  STEPS_OPERADOR,
  STEPS_TRANSPORTISTA,
  getReviewFixture,
  type DocDef,
  type RegistrationData,
  type TipoActor,
} from './inscripcion/shared';

// Step components
import { StepCuenta } from './inscripcion/steps/StepCuenta';
import { StepEmpresa } from './inscripcion/steps/StepEmpresa';
import { StepDocumentos } from './inscripcion/steps/StepDocumentos';
import { StepActividad } from './inscripcion/steps/StepActividad';
import { StepResumen } from './inscripcion/steps/StepResumen';
import { getApiErrorMessage } from '../../utils/api-error';
import { solicitudService } from '../../services/solicitud.service';
import type { DocumentoSolicitud, EstadoSolicitud } from '../../types/api';
import { queryClient } from '../../lib/queryClient';
import { parseActorCoordinates, COORDINATE_ERROR } from '../../utils/actorCreationValidation';

type ReceivedState = Exclude<EstadoSolicitud, 'BORRADOR' | 'OBSERVADA'>;
const RECEIVED_STATES: Record<ReceivedState, { title: string; detail: string }> = {
  ENVIADA: { title: 'Solicitud enviada', detail: 'SITREP recibió tu solicitud. No hace falta volver a enviarla.' },
  EN_REVISION: { title: 'Solicitud enviada', detail: 'Tu solicitud está en revisión por la administración. No hace falta volver a enviarla.' },
  APROBADA: { title: 'Solicitud aprobada', detail: 'La administración aprobó tu solicitud. La aprobación del trámite no reemplaza la verificación de acceso de tu cuenta.' },
  RECHAZADA: { title: 'Solicitud rechazada', detail: 'La administración registró un rechazo. Revisá el motivo de tu trámite.' },
};
function receivedState(value: unknown): value is ReceivedState {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RECEIVED_STATES, value);
}

// ========================================
// COMPONENT
// ========================================

const InscripcionWizardPage: React.FC = () => {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGenerador = tipo === 'generador';
  const isOperador = tipo === 'operador';
  const isTransportista = tipo === 'transportista';
  const tipoActor: TipoActor = isGenerador ? 'GENERADOR' : isOperador ? 'OPERADOR' : 'TRANSPORTISTA';
  const isReviewMode = searchParams.get('modo') === 'revision';
  const reviewFixture = isReviewMode ? getReviewFixture(tipoActor) : null;
  const steps = isGenerador ? STEPS_GENERADOR : isOperador ? STEPS_OPERADOR : STEPS_TRANSPORTISTA;
  const totalSteps = steps.length;
  const [trialInitial] = useState(() => isReviewMode ? readTrialDraft(tipoActor) : null);
  const [formContext, setFormContext] = useState(`${isReviewMode ? 'trial' : 'real'}:${tipoActor}`);
  const trialRevision = useRef<string | null>(typeof trialInitial?.data.revision === 'string' ? trialInitial.data.revision : null);

  // Phase tracking
  const [phase, setPhase] = useState<1 | 2>(isReviewMode ? 2 : 1);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  // Phase 1 - Registration
  const [reg, setReg] = useState<RegistrationData>(reviewFixture?.reg || {
    nombre: '', email: '', password: '', confirmPassword: '', cuit: '',
  });

  // Phase 2 - Wizard
  const [step, setStep] = useState(isReviewMode ? Math.min(totalSteps, Math.max(1, Number(trialInitial?.data.step) || 1)) : 1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const validationRef = useRegistrationValidationFocus(attempted);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => trialInitial?.data.form && typeof trialInitial.data.form === 'object'
    ? Object.fromEntries(Object.entries(trialInitial.data.form).filter(([, value]) => typeof value === 'string')) as Record<string, string> : reviewFixture?.form || {});
  const [previewAnalyses, setPreviewAnalyses] = useState<Record<string, ReceiptAnalysis>>({});
  const serverExtraFields = useRef<Record<string, unknown>>({});
  const [adjuntos, setAdjuntos] = useState<Record<string, File>>({});
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, DocumentoSolicitud>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, 'uploading' | 'deleting' | 'reading' | 'downloading' | 'error' | undefined>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | undefined>>({});
  const uploadsInFlight = useRef(new Set<string>());
  const [requirements, setRequirements] = useState<DocDef[]>([]);
  const [requirementsStatus, setRequirementsStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [requirementsMaxBytes, setRequirementsMaxBytes] = useState(10 * 1024 * 1024);
  const [requirementsAttempt, setRequirementsAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [serverRevision, setServerRevision] = useState<string | null>(null);
  const serverRevisionRef = useRef<string | null>(null);
  const [localSaved, setLocalSaved] = useState(Boolean(trialInitial));
  const [localConflict, setLocalConflict] = useState<Record<string, string> | null>(null);
  const [missingLocalFiles, setMissingLocalFiles] = useState<string[]>(Array.isArray(trialInitial?.data.files) ? trialInitial.data.files.filter(item => typeof item === 'string') as string[] : []);
  const editRevision = useRef(0);
  const submitInFlight = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [confirmedState, setConfirmedState] = useState<ReceivedState | null>(null);
  const [confirmedReason, setConfirmedReason] = useState<string | null>(null);
  const [refreshingReceipt, setRefreshingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const receiptInFlight = useRef(false);
  const [regError, setRegError] = useState<string | null>(null);
  const activeStepRef = useRef<HTMLButtonElement>(null);
  const draftScope = `public:${tipoActor}:${solicitudId || ''}`;
  const ownership = useInspectionDraftOwnership(`registration:${owner}:${draftScope}`, Boolean(owner && solicitudId && !isReviewMode && !submitSuccess));
  const vehicles = fleetRows(form.vehiculosJson, EMPTY_VEHICLE);
  const drivers = fleetRows(form.choferesJson, EMPTY_DRIVER);
  const licenseRequirements = drivers.map((driver, index) => ({ tipo: licenseDocumentType(driver.key), nombre: `Licencia del chofer ${index + 1} · ${driver.nombre || 'sin nombre'}`, required: false }));

  useLayoutEffect(() => {
    const context = `${isReviewMode ? 'trial' : 'real'}:${tipoActor}`;
    if (context === formContext) return;
    const local = isReviewMode ? readTrialDraft(tipoActor) : null;
    trialRevision.current = typeof local?.data.revision === 'string' ? local.data.revision : null;
    setForm(local?.data.form && typeof local.data.form === 'object'
      ? Object.fromEntries(Object.entries(local.data.form).filter(([, value]) => typeof value === 'string')) as Record<string, string> : reviewFixture?.form || {});
    setStep(Math.min(totalSteps, Math.max(1, Number(local?.data.step) || 1)));
    setMissingLocalFiles(Array.isArray(local?.data.files) ? local.data.files.filter(item => typeof item === 'string') as string[] : []);
    setAdjuntos({}); setUploadedDocs({}); setPreviewAnalyses({}); setUploadStates({}); setUploadErrors({});
    setOwner(null); setSolicitudId(null); setSubmitSuccess(false); setSaveError(null); setDirty(false);
    serverExtraFields.current = {}; setPhase(isReviewMode ? 2 : 1);
    setReg(reviewFixture?.reg || { nombre: '', email: '', cuit: '', password: '', confirmPassword: '' });
    setFormContext(context);
  }, [isReviewMode, tipoActor, formContext, totalSteps]);

  // A committed navigation starts at its heading, not at the previous page's
  // footer. Typing, validation errors and asynchronous requirements do not move
  // the viewport. Keep the active step visible within its own horizontal rail.
  useLayoutEffect(() => {
    activeStepRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [tipo, phase, step, submitSuccess]);

  const up = useCallback((field: string, value: string) => {
    setValidationError(null);
    editRevision.current++;
    setDirty(true);
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const upReg = useCallback((field: string, value: string) => {
    setReg(prev => ({ ...prev, [field]: value }));
  }, []);

  const persistTrial = (target: number): boolean => {
    const saved = saveTrialDraft(tipoActor, { form, step: target, files: [...new Set([...Object.keys(adjuntos), ...missingLocalFiles])] }, trialRevision.current);
    setLocalSaved(saved);
    if (saved) { trialRevision.current = readTrialDraft(tipoActor)?.data.revision as string; setSaveError(null); }
    else setSaveError('No se guardó la prueba: puede haber una versión más nueva en otra pestaña o faltar espacio del navegador. Los datos siguen en pantalla; no se sobrescribió el borrador.');
    return saved;
  };
  useEffect(() => {
    if (!isReviewMode || submitSuccess || formContext !== `trial:${tipoActor}`) return;
    const saved = saveTrialDraft(tipoActor, { form, step, files: [...new Set([...Object.keys(adjuntos), ...missingLocalFiles])] }, trialRevision.current);
    setLocalSaved(saved);
    if (saved) trialRevision.current = readTrialDraft(tipoActor)?.data.revision as string;
  }, [isReviewMode, tipoActor, formContext, form, step, adjuntos, missingLocalFiles, submitSuccess]);

  useEffect(() => {
    let cancelled = false;
    setRequirementsStatus('loading');
    solicitudService.getRequirements(tipoActor).then((result) => {
      if (cancelled) return;
      setRequirements(result.documentos);
      setRequirementsMaxBytes(result.maxBytes);
      setRequirementsStatus('loaded');
    }).catch(() => {
      if (!cancelled) setRequirementsStatus('error');
    });
    return () => { cancelled = true; };
  }, [tipoActor, requirementsAttempt]);

  useEffect(() => {
    if (isReviewMode) return undefined;
    let pending: { id?: string; tipoActor?: TipoActor; step?: number } = {};
    try { pending = JSON.parse(localStorage.getItem('sitrep_pending_solicitud') || '{}'); } catch { /* use the server-owned draft */ }
    const token = getAccessToken();
    const hint = token ? registrationDraftHint(token) : null;
    if (hint) pending = { id: hint, tipoActor, step: pending.id === hint ? pending.step : 1 };
    if (pending.tipoActor !== tipoActor) pending = {};
    if (!pending.id && !token) return undefined;

    let cancelled = false;
    setResumeStatus('loading');
    const accountAtStart = registrationSessionOwner(getAccessToken());
    const load = async () => {
      if (!pending.id) {
        const response = await api.get('/solicitudes/mis-solicitudes');
        const candidates = response.data?.data?.solicitudes?.filter((item: { usuarioId: string; tipoActor: string }) => item.usuarioId === accountAtStart && item.tipoActor === tipoActor) || [];
        const own = candidates.find((item: { estado: string }) => ['BORRADOR', 'OBSERVADA'].includes(item.estado))
          || candidates.find((item: { estado: string }) => ['ENVIADA', 'EN_REVISION'].includes(item.estado));
        if (!own) return null;
        pending = { id: own.id, tipoActor, step: 1 };
      }
      return api.get(`/solicitudes/${pending.id}`);
    };
    load().then(response => {
      if (cancelled) return;
      if (!response) { setResumeStatus('idle'); return; }
      const solicitud = response.data?.data?.solicitud;
      if (!solicitud || solicitud.tipoActor !== tipoActor || solicitud.id !== pending.id) throw new Error('Solicitud incompatible');
      if (!accountAtStart || solicitud.usuarioId !== accountAtStart || registrationSessionOwner(getAccessToken()) !== accountAtStart) throw new Error('La sesión no pertenece a este borrador');
      if (receivedState(solicitud.estado)) {
        setOwner(accountAtStart); setSolicitudId(solicitud.id); setConfirmedState(solicitud.estado);
        setConfirmedReason(solicitud.estado === 'RECHAZADA' && typeof solicitud.motivoRechazo === 'string' ? solicitud.motivoRechazo : null);
        setReceiptError(null);
        setDirty(false); setSubmitSuccess(true); setResumeStatus('loaded');
        void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
        clearRegistrationDraft(accountAtStart, `public:${tipoActor}:${solicitud.id}`);
        return;
      }
      if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) throw new Error('Estado de solicitud no reconocido');
      let persistedForm: Record<string, string> = {};
      try {
        const data = typeof solicitud.datosActor === 'string' ? JSON.parse(solicitud.datosActor || '{}') : solicitud.datosActor;
        if (data && !Array.isArray(data)) {
          persistedForm = Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
          serverExtraFields.current = Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value !== 'string'));
          for (const key of ['vehiculosJson', 'choferesJson']) {
            if (Array.isArray(data[key])) { persistedForm[key] = JSON.stringify(data[key]); delete serverExtraFields.current[key]; }
          }
        }
      } catch { /* keep blank fields */ }
      const local = readRegistrationDraft(accountAtStart, `public:${tipoActor}:${pending.id}`);
      const localForm = local?.data.form && typeof local.data.form === 'object' && !Array.isArray(local.data.form)
        ? Object.fromEntries(Object.entries(local.data.form).filter(([, value]) => typeof value === 'string')) as Record<string, string> : null;
      const hasLocalChanges = localForm && JSON.stringify(localForm) !== JSON.stringify(persistedForm);
      const serverChanged = hasLocalChanges && local?.data.serverRevision !== solicitud.updatedAt;
      if (hasLocalChanges && !serverChanged) { persistedForm = localForm; setDirty(true); }
      setLocalConflict(serverChanged ? localForm : null);
      setMissingLocalFiles(Array.isArray(local?.data.files) ? local.data.files.filter(value => typeof value === 'string') as string[] : []);
      setOwner(accountAtStart);
      serverRevisionRef.current = solicitud.updatedAt;
      setServerRevision(solicitud.updatedAt);
      setForm(persistedForm);
      setUploadedDocs(Object.fromEntries(
        (solicitud.documentos || []).map((documento: DocumentoSolicitud) => [documento.tipo, documento]),
      ));
      setReg(previous => ({ ...previous, nombre: solicitud.usuario?.nombre || '', email: solicitud.usuario?.email || '', cuit: solicitud.usuario?.cuit || '' }));
      setSolicitudId(pending.id!);
      setStep(Math.min(totalSteps, Math.max(1, Number(local?.data.step ?? pending.step) || 1)));
      setPhase(2);
      setResumeStatus('loaded');
    }).catch(() => {
      if (!cancelled) setResumeStatus('error');
    });
    return () => { cancelled = true; };
  }, [tipoActor, isReviewMode, resumeAttempt, totalSteps]);

  // Persist the CURRENT step, not just a completed navigation. Only the account
  // validated by the server can read it back; passwords and file bytes never enter it.
  useEffect(() => {
    if (isReviewMode || submitSuccess || !owner || !solicitudId || localConflict || !ownership.canWrite()) return;
    if (registrationSessionOwner(getAccessToken()) !== owner) return;
    setLocalSaved(writeRegistrationDraft(owner, draftScope, {
      form, step, serverRevision, files: [...new Set([...Object.keys(adjuntos), ...missingLocalFiles])].filter(type => !uploadedDocs[type]),
    }));
  }, [isReviewMode, submitSuccess, owner, solicitudId, localConflict, ownership.canWrite, ownership.status, draftScope, form, step, serverRevision, adjuntos, missingLocalFiles, uploadedDocs]);

  const clearVisibleAccount = useCallback(() => {
      setForm({}); setAdjuntos({}); setUploadedDocs({}); setOwner(null);
      serverExtraFields.current = {};
      setLocalConflict(null); setMissingLocalFiles([]); setDirty(false); setLocalSaved(false);
      setReg({ nombre: '', email: '', cuit: '', password: '', confirmPassword: '' });
      setConfirmedState(null); setConfirmedReason(null); setReceiptError(null); setSubmitSuccess(false); setSolicitudId(null);
      setResumeStatus('error'); setPhase(1);
  }, []);
  useEffect(() => {
    if (!owner) return;
    const accountChanged = () => {
      if (registrationSessionOwner(getAccessToken()) === owner) return;
      clearVisibleAccount();
    };
    window.addEventListener('storage', accountChanged);
    window.addEventListener('focus', accountChanged);
    return () => { window.removeEventListener('storage', accountChanged); window.removeEventListener('focus', accountChanged); };
  }, [owner, clearVisibleAccount]);

  useEffect(() => {
    if (isReviewMode || submitSuccess || (!dirty && Object.keys(adjuntos).length === 0)) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, adjuntos, isReviewMode, submitSuccess]);

  // ========================================
  // PHASE 2 - Wizard navigation
  // ========================================

  const docStepNumber = isGenerador ? 6 : isOperador ? 7 : 4;

  const getStepErrors = (s: number): string[] => {
    if (isReviewMode) return [];
    const errs: string[] = [];
    if (s === 1) {
      if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
      if (!form.domicilio?.trim()) errs.push('Domicilio es obligatorio');
      if (form.emailContacto?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailContacto.trim())) errs.push('Revisá el formato del email de contacto');
      if (isTransportista && form.coordenadas?.trim()) {
        if (parseActorCoordinates(form.coordenadas) === null) errs.push(COORDINATE_ERROR);
      }
    }
    if (!isTransportista && s === 3 && parseActorCoordinates(form.coordenadas || '') === null) errs.push(COORDINATE_ERROR);
    if (s === (isGenerador ? 5 : isOperador ? 6 : 0)) for (const [field, label] of [['tefPersonal', 'Personal'], ['tefPotencia', 'Potencia instalada'], ['tefSuperficie', 'Superficie'], ['tefCapacidad', 'Capacidad']]) {
      if (form[field]?.trim() && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) errs.push(`${label}: indicá un número mayor o igual a cero`);
    }
    if (isTransportista && s === 3) errs.push(...fleetErrors(vehicles, drivers));
    if (s === docStepNumber) {
      if (requirementsStatus !== 'loaded') {
        errs.push('No se pudieron verificar los requisitos documentales vigentes');
      } else {
        const missing = requirements.filter((requirement) => requirement.required && (!uploadedDocs[requirement.tipo] || uploadedDocs[requirement.tipo].estado === 'RECHAZADO') && !adjuntos[requirement.tipo]);
        if (missing.length > 0) errs.push(`Faltan documentos obligatorios: ${missing.map((item) => item.nombre).join(', ')}`);
      }
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const assertDraftSession = useCallback(() => {
    if (!owner || registrationSessionOwner(getAccessToken()) !== owner) throw new Error('La sesión cambió o venció. Iniciá sesión con tu cuenta para recuperar el borrador.');
    if (!ownership.canWrite()) throw new Error('Este borrador está abierto en otra pestaña o no se pudo proteger su edición. Cerrá la otra pestaña y reintentá.');
    if (localConflict) throw new Error('Elegí qué versión conservar antes de guardar.');
  }, [owner, ownership.canWrite, localConflict]);
  const persistDraft = async (target: number): Promise<boolean> => {
    if (isReviewMode) return persistTrial(target);
    if (saveInFlight.current || submitInFlight.current) return false;
    saveInFlight.current = true; setSaving(true); setSaveError(null);
    const revisionAtStart = editRevision.current;
    try {
      assertDraftSession();
      const response = await api.put(`/solicitudes/${solicitudId}`, {
        datosActor: { ...serverExtraFields.current, ...form, nombre: reg.nombre, cuit: reg.cuit, email: reg.email }, expectedUpdatedAt: serverRevisionRef.current,
      });
      assertDraftSession();
      const updated = response.data?.data?.solicitud?.updatedAt;
      if (typeof updated !== 'string') throw new Error('No se recibió confirmación del guardado. Conservamos los datos en pantalla.');
      serverRevisionRef.current = updated; setServerRevision(updated);
      try { localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: solicitudId, tipoActor, step: target })); } catch { /* owned draft also exists on server */ }
      if (editRevision.current === revisionAtStart) setDirty(false);
      return true;
    } catch (error) {
      setSaveError(`No se confirmó el guardado en SITREP. ${getApiErrorMessage(error, 'Revisá la conexión y reintentá; los datos siguen en pantalla.')}`);
      return false;
    } finally { saveInFlight.current = false; setSaving(false); }
  };

  const goStep = async (target: number) => {
    if (target === step || saveInFlight.current || submitting) return;
    setValidationError(null);
    if (uploadsInFlight.current.size) { setValidationError('Esperá a que termine la operación del archivo.'); return; }
    setAttempted(prev => new Set(prev).add(step));
    if (target > step && getStepErrors(step).length > 0) {
      // Contact, location and fleet errors are shown at their own fields.
      if (step !== 1 && step !== 3) setValidationError(getStepErrors(step).join('. '));
      return;
    }
    if (isReviewMode) {
      if (persistTrial(target)) setStep(target);
      return;
    }
    if (!solicitudId) {
      setSaveError('No hay una solicitud activa. Volvé al inicio del alta para crearla.');
      return;
    }
    if (await persistDraft(target)) setStep(target);
  };

  const goNext = () => { if (step < totalSteps) void goStep(step + 1); };
  const goPrev = () => { if (step > 1) void goStep(step - 1); };

  // File handling
  const handleAddFile = useCallback(async (tipo: string, file: File) => {
    if (uploadsInFlight.current.has(tipo)) return;
    setUploadErrors(previous => ({ ...previous, [tipo]: undefined }));
    if (file.size === 0 || file.size > requirementsMaxBytes || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setUploadStates(previous => ({ ...previous, [tipo]: 'error' }));
      setUploadErrors(previous => ({ ...previous, [tipo]: `Elegí un PDF, JPG o PNG con contenido de hasta ${(requirementsMaxBytes / 1024 / 1024).toFixed(0)} MB.` }));
      return;
    }
    setAdjuntos(previous => ({ ...previous, [tipo]: file }));
    setMissingLocalFiles(previous => previous.filter(type => type !== tipo));
    if (isReviewMode) {
      uploadsInFlight.current.add(tipo); setUploadStates(previous => ({ ...previous, [tipo]: 'reading' }));
      try { const result = await previewDocument(file, 'DOCUMENTO'); setPreviewAnalyses(previous => ({ ...previous, [tipo]: result.analisis })); }
      catch (error) { setUploadErrors(previous => ({ ...previous, [tipo]: getApiErrorMessage(error, 'No se pudo leer el archivo de prueba. Los datos siguen en el navegador.') })); }
      finally { uploadsInFlight.current.delete(tipo); setUploadStates(previous => ({ ...previous, [tipo]: undefined })); }
      return;
    }
    if (!solicitudId) {
      setUploadStates(previous => ({ ...previous, [tipo]: 'error' }));
      setUploadErrors(previous => ({ ...previous, [tipo]: 'No hay una solicitud activa para guardar este archivo.' }));
      return;
    }

    setUploadStates(previous => ({ ...previous, [tipo]: 'uploading' }));
    uploadsInFlight.current.add(tipo);
    try {
      assertDraftSession();
      const document = await solicitudService.uploadDocumento(solicitudId, file, tipo);
      assertDraftSession();
      setUploadedDocs(previous => ({ ...previous, [tipo]: document }));
      setAdjuntos(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadStates(previous => ({ ...previous, [tipo]: undefined }));
      return document;
    } catch (error) {
      setUploadStates(previous => ({ ...previous, [tipo]: 'error' }));
      setUploadErrors(previous => ({ ...previous, [tipo]: getApiErrorMessage(error, 'No se pudo guardar el archivo. Volve a seleccionarlo o reintenta al enviar.') }));
    } finally { uploadsInFlight.current.delete(tipo); }
  }, [isReviewMode, requirementsMaxBytes, solicitudId, assertDraftSession]);

  const handleLicense = async (key: string, file: File): Promise<LicensePreview> => {
    const type = licenseDocumentType(key);
    if (isReviewMode) {
      setAdjuntos(previous => ({ ...previous, [type]: file }));
      setMissingLocalFiles(previous => previous.filter(item => item !== type));
      uploadsInFlight.current.add(type); setUploadStates(previous => ({ ...previous, [type]: 'reading' }));
      try { return await previewDocument(file, 'LICENCIA'); }
      finally { uploadsInFlight.current.delete(type); setUploadStates(previous => ({ ...previous, [type]: undefined })); }
    }
    if (!await persistDraft(step)) throw new Error('Guardá primero los datos del chofer; la licencia no se perdió.');
    const document = await handleAddFile(type, file);
    if (!document?.analisis) throw new Error('No se confirmó la carga o lectura de la licencia. Reintentá sin repetir el alta.');
    const reading = document.analisis as ReceiptAnalysis & { campos?: LicensePreview['campos'] };
    return { analisis: reading, campos: reading.campos || {}, persistido: true };
  };

  const handleRemoveFile = useCallback(async (tipo: string) => {
    if (uploadsInFlight.current.has(tipo)) return;
    setUploadErrors(previous => ({ ...previous, [tipo]: undefined }));
    const uploaded = uploadedDocs[tipo];
    if (adjuntos[tipo] && uploaded) {
      setAdjuntos(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadStates(previous => ({ ...previous, [tipo]: undefined }));
      return;
    }
    if (!uploaded || isReviewMode || !solicitudId) {
      setPreviewAnalyses(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setMissingLocalFiles(previous => previous.filter(item => item !== tipo));
      setAdjuntos(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadedDocs(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadStates(previous => ({ ...previous, [tipo]: undefined }));
      return;
    }

    setUploadStates(previous => ({ ...previous, [tipo]: 'deleting' }));
    uploadsInFlight.current.add(tipo);
    try {
      assertDraftSession();
      await solicitudService.deleteDocumento(solicitudId, uploaded.id);
      assertDraftSession();
      setAdjuntos(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadedDocs(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      setUploadStates(previous => ({ ...previous, [tipo]: undefined }));
    } catch (error) {
      setUploadStates(previous => ({ ...previous, [tipo]: 'error' }));
      setUploadErrors(previous => ({ ...previous, [tipo]: getApiErrorMessage(error, 'No se pudo eliminar el archivo guardado.') }));
    } finally { uploadsInFlight.current.delete(tipo); }
  }, [isReviewMode, solicitudId, uploadedDocs, adjuntos, assertDraftSession]);

  // Submit
  const handleDownloadFile = async (tipo: string) => {
    const uploaded = uploadedDocs[tipo];
    if (!solicitudId || !uploaded || uploadsInFlight.current.has(tipo) || isReviewMode) return;
    uploadsInFlight.current.add(tipo);
    setUploadErrors(previous => ({ ...previous, [tipo]: undefined }));
    setUploadStates(previous => ({ ...previous, [tipo]: 'downloading' }));
    try { assertDraftSession(); await solicitudService.downloadDocumento(solicitudId, uploaded); }
    catch (error) { setUploadErrors(previous => ({ ...previous, [tipo]: getApiErrorMessage(error, 'No se pudo descargar el original. El archivo sigue guardado.') })); }
    finally { uploadsInFlight.current.delete(tipo); setUploadStates(previous => ({ ...previous, [tipo]: undefined })); }
  };

  const handleRetryReading = async (tipo: string) => {
    if (isReviewMode && adjuntos[tipo]) { await handleAddFile(tipo, adjuntos[tipo]); return; }
    const uploaded = uploadedDocs[tipo];
    if (!solicitudId || !uploaded || uploadsInFlight.current.has(tipo) || isReviewMode) return;
    uploadsInFlight.current.add(tipo);
    setUploadErrors(previous => ({ ...previous, [tipo]: undefined }));
    setUploadStates(previous => ({ ...previous, [tipo]: 'reading' }));
    try {
      assertDraftSession();
      const document = await solicitudService.analizarDocumento(solicitudId, uploaded.id);
      assertDraftSession();
      setUploadedDocs(previous => ({ ...previous, [tipo]: document }));
      setUploadStates(previous => ({ ...previous, [tipo]: undefined }));
    } catch (error) {
      setUploadStates(previous => ({ ...previous, [tipo]: 'error' }));
      setUploadErrors(previous => ({ ...previous, [tipo]: getApiErrorMessage(error, 'No se pudo reintentar la lectura. El archivo sigue guardado.') }));
    } finally { uploadsInFlight.current.delete(tipo); }
  };

  // A pre-verification credential is limited to this exact request. It cannot
  // open the private account dashboard or list other requests. Follow its real
  // state here without pretending that account authentication is complete.
  const handleRefreshReceipt = async () => {
    if (receiptInFlight.current || isReviewMode || !owner || !solicitudId) return;
    receiptInFlight.current = true; setRefreshingReceipt(true); setReceiptError(null);
    try {
      if (registrationSessionOwner(getAccessToken()) !== owner) { clearVisibleAccount(); return; }
      const response = await api.get(`/solicitudes/${solicitudId}`);
      if (registrationSessionOwner(getAccessToken()) !== owner) { clearVisibleAccount(); return; }
      const actual = response.data?.data?.solicitud;
      if (actual?.id !== solicitudId || actual.usuarioId !== owner || actual.tipoActor !== tipoActor) throw new Error('La respuesta no corresponde a tu solicitud');
      if (['BORRADOR', 'OBSERVADA'].includes(actual.estado)) {
        setResumeStatus('loading'); setSubmitSuccess(false); setConfirmedState(null); setConfirmedReason(null);
        setResumeAttempt(value => value + 1);
        return;
      }
      if (!receivedState(actual.estado)) throw new Error('Estado de solicitud no reconocido');
      setConfirmedState(actual.estado);
      setConfirmedReason(actual.estado === 'RECHAZADA' && typeof actual.motivoRechazo === 'string' ? actual.motivoRechazo : null);
    } catch {
      if (registrationSessionOwner(getAccessToken()) !== owner) { clearVisibleAccount(); return; }
      setReceiptError('No se pudo actualizar el estado. Se muestra el último resultado confirmado por SITREP. Revisá la conexión y reintentá.');
    } finally { receiptInFlight.current = false; setRefreshingReceipt(false); }
  };

  const handleSubmit = async () => {
    if (saveInFlight.current || submitInFlight.current) return;
    if (uploadsInFlight.current.size) { setRegError('Esperá a que termine la carga de documentos antes de enviar.'); return; }
    if (isReviewMode) {
      if (persistTrial(step)) setSubmitSuccess(true);
      return;
    }
    const submitForm = form;
    // Validate required steps
    for (let s = 1; s <= totalSteps; s++) {
      const errs = getStepErrors(s);
      if (errs.length > 0) {
        setAttempted(prev => new Set(prev).add(s));
        setValidationError(s !== 1 && s !== 3 ? errs.join('. ') : null);
        setStep(s);
        return;
      }
    }

    if (!solicitudId) {
      setRegError('No hay una solicitud activa para enviar.');
      return;
    }
    submitInFlight.current = true; setSubmitting(true); setRegError(null);

    try {
      // Save final form data
      assertDraftSession();
      const saved = await api.put(`/solicitudes/${solicitudId}`, { datosActor: { ...serverExtraFields.current, ...submitForm, nombre: reg.nombre, cuit: reg.cuit, email: reg.email }, expectedUpdatedAt: serverRevisionRef.current });
      assertDraftSession();
      const updated = saved.data?.data?.solicitud?.updatedAt;
      if (typeof updated !== 'string') throw new Error('No se recibió confirmación del borrador. Reintentá el guardado antes de enviar.');
      serverRevisionRef.current = updated; setServerRevision(updated); setDirty(false);

      // Retry only documents that could not be persisted immediately.
      for (const [tipo, file] of Object.entries(adjuntos)) {
        assertDraftSession();
        const document = await solicitudService.uploadDocumento(solicitudId, file, tipo);
        assertDraftSession();
        setUploadedDocs(previous => ({ ...previous, [tipo]: document }));
        setAdjuntos(previous => { const next = { ...previous }; delete next[tipo]; return next; });
      }

      // Submit solicitud
      assertDraftSession();
      await api.post(`/solicitudes/${solicitudId}/enviar`);
      assertDraftSession();
      clearRegistrationDraft(owner!, draftScope);
      try { localStorage.removeItem('sitrep_pending_solicitud'); } catch { /* submission was already confirmed by SITREP */ }
      setConfirmedState('ENVIADA');
      setSubmitSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
    } catch (err: unknown) {
      // A response can be lost after commit. Read the actual owned record;
      // never retry sending blindly or infer acceptance from a network error.
      try {
        if (owner && registrationSessionOwner(getAccessToken()) === owner) {
          const response = await api.get(`/solicitudes/${solicitudId}`);
          const actual = response.data?.data?.solicitud;
          if (registrationSessionOwner(getAccessToken()) === owner && actual?.id === solicitudId
              && actual.usuarioId === owner && actual.tipoActor === tipoActor && receivedState(actual.estado)) {
            setConfirmedState(actual.estado); setSubmitSuccess(true); setDirty(false); setRegError(null);
            setConfirmedReason(actual.estado === 'RECHAZADA' && typeof actual.motivoRechazo === 'string' ? actual.motivoRechazo : null);
            clearRegistrationDraft(owner, draftScope);
            void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
            return;
          }
        }
      } catch { /* Keep the original failure and editable fields if acceptance cannot be verified. */ }
      setRegError(getApiErrorMessage(err, 'Error al enviar la solicitud'));
    } finally {
      submitInFlight.current = false; setSubmitting(false);
    }
  };

  // ========================================
  // Determine which step content to render
  // ========================================

  const documentStep = <StepDocumentos
    reviewMode={isReviewMode}
    docs={[...requirements, ...licenseRequirements]}
    previewAnalyses={previewAnalyses}
    adjuntos={adjuntos}
    uploadedDocs={uploadedDocs}
    uploadStates={uploadStates}
    uploadErrors={uploadErrors}
    requirementsStatus={requirementsStatus}
    maxBytes={requirementsMaxBytes}
    onRetryRequirements={() => setRequirementsAttempt(value => value + 1)}
    onAddFile={handleAddFile}
    onRemoveFile={handleRemoveFile}
    onRetryReading={handleRetryReading}
    onDownloadFile={handleDownloadFile}
  />;

  /** Maps the current wizard step to the corresponding step component */
  const renderStepContent = () => {
    // Determine which logical step we're on
    // Keep the persisted step numbers stable for existing drafts.
    // Generador: 1-4=empresa, 5=actividad, 6=docs, 7=resumen
    // Operador:  1-5=empresa, 6=actividad, 7=docs, 8=resumen
    // Transport: 1-3=empresa, 4=docs, 5=resumen

    if (isGenerador) {
      if (step <= 4) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 5) return <StepActividad form={form} up={up} isOperador={false} />;
      if (step === 6) return documentStep;
      if (step === 7) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} uploadedDocs={uploadedDocs} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isOperador) {
      if (step <= 5) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 6) return <StepActividad form={form} up={up} isOperador />;
      if (step === 7) return documentStep;
      if (step === 8) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} uploadedDocs={uploadedDocs} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isTransportista) {
      if (step <= 3) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista}
        fleet={<><RegistrationFleetFields vehicles={vehicles} drivers={drivers} onVehicles={rows => up('vehiculosJson', JSON.stringify(rows))} onDrivers={rows => up('choferesJson', JSON.stringify(rows))} attempted={attempted.has(3)} onLicense={handleLicense}
          documents={Object.fromEntries(drivers.flatMap(driver => { const type = licenseDocumentType(driver.key), file = adjuntos[type], saved = uploadedDocs[type]; return file || saved ? [[driver.key, { name: file?.name || saved.nombre, status: saved ? 'Guardado en la solicitud' : isReviewMode ? 'Archivo de prueba · sólo en esta sesión' : 'Pendiente de guardar', error: uploadErrors[type] }]] : []; }))} />
        {(form.vehiculosDesc || form.choferesDesc) && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-neutral-800">Información previa en texto · conservada</summary><p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{form.vehiculosDesc}\n{form.choferesDesc}</p></details>}</>} />;
      if (step === 4) return documentStep;
      if (step === 5) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} uploadedDocs={uploadedDocs} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    }
    return null;
  };

  // ========================================
  // RENDER: Invalid tipo
  // ========================================

  if (!isGenerador && !isOperador && !isTransportista) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Tipo invalido</h2>
          <p className="text-neutral-500 mb-4">El tipo de inscripcion debe ser "generador", "operador" o "transportista".</p>
          <Button variant="outline" onClick={() => navigate('/')}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Success
  // ========================================

  if (submitSuccess) {
    const receipt = confirmedState ? RECEIVED_STATES[confirmedState] : RECEIVED_STATES.ENVIADA;
    const CompletionIcon = isReviewMode || confirmedState === 'APROBADA' ? Check : confirmedState === 'RECHAZADA' ? AlertCircle : Send;
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="min-w-0 w-full bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 sm:p-8 max-w-lg text-center">
          <div className="w-16 h-16 bg-[#0D8A4F]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CompletionIcon size={32} className={confirmedState === 'RECHAZADA' ? 'text-error-700' : 'text-[#0D8A4F]'} />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">{isReviewMode ? 'Revisión finalizada' : receipt.title}</h2>
          <p className="text-neutral-600 mb-6">
            {isReviewMode
              ? 'Tu borrador de prueba quedó en este navegador. No se creó ninguna cuenta ni trámite y no se envió ningún aviso. Los archivos usados para OCR no se guardaron en el servidor.'
              : receipt.detail}
          </p>
          {confirmedReason && <p className="mb-4 break-words rounded-lg border border-error-200 bg-error-50 p-3 text-left text-sm text-error-800"><span className="font-semibold">Motivo del rechazo: </span>{confirmedReason}</p>}
          {receiptError && <p role="alert" className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-left text-sm text-error-800">{receiptError}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {!isReviewMode && <Button variant="primary" disabled={refreshingReceipt} onClick={handleRefreshReceipt}>{refreshingReceipt ? 'Consultando estado…' : 'Actualizar estado'}</Button>}
            <Button variant={isReviewMode ? 'primary' : 'outline'} onClick={() => navigate(isReviewMode ? '/' : '/login')}>{isReviewMode ? 'Volver al inicio' : 'Ir al login'}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Phase 1 - Registration
  // ========================================

  if (phase === 1) {
    if (resumeStatus === 'loading' || resumeStatus === 'error') {
      return <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm" role={resumeStatus === 'error' ? 'alert' : 'status'}>
          <h2 className="text-lg font-bold">{resumeStatus === 'loading' ? 'Recuperando tu solicitud' : 'No se pudo recuperar tu solicitud'}</h2>
          <p className="mt-2 text-sm text-neutral-600">{resumeStatus === 'loading' ? 'Estamos leyendo el borrador guardado.' : 'No se perdió el borrador. Revisá la conexión o iniciá sesión con la cuenta creada.'}</p>
          {resumeStatus === 'error' && <div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => setResumeAttempt(value => value + 1)}>Reintentar</Button><Button onClick={() => navigate('/login', { state: { from: `/inscripcion/${tipo}` } })}>Iniciar sesión y recuperar</Button></div>}
        </div>
      </div>;
    }
    return (
      <StepCuenta
        tipoActor={tipoActor}
        isGenerador={isGenerador}
        isOperador={isOperador}
        isTransportista={isTransportista}
        reg={reg}
        onRegChange={upReg}
        onPhase2={() => { setReg(previous => ({ ...previous, password: '', confirmPassword: '' })); setResumeAttempt(value => value + 1); }}
      />
    );
  }

  // ========================================
  // RENDER: Phase 2 - Wizard
  // ========================================

  const isLastStep = step === totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6" data-testid="registration-wizard">
        {/* Header */}
        <header className="space-y-3" data-testid="registration-identity">
          <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl">
            Inscripción como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isGenerador ? 'bg-purple-100' : isOperador ? 'bg-blue-100' : 'bg-orange-100'}`}>
              {isGenerador
                ? <Factory size={18} className="text-purple-600" />
                : isOperador ? <FlaskConical size={18} className="text-blue-600" />
                : <Truck size={18} className="text-orange-600" />
              }
              </div>
              <p className="text-sm leading-5 text-neutral-600">Paso {step} de {totalSteps} · {steps[step - 1]?.label}</p>
            </div>
            <button type="button" onClick={() => navigate(-1)} aria-label="Volver a la pantalla anterior" className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
              <ArrowLeft size={16} aria-hidden="true" /> Volver
            </button>
          </div>
        </header>

        {/* Stepper */}
        <nav className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3 [scrollbar-width:thin] sm:p-4" aria-label="Etapas de la inscripción" data-testid="registration-stepper">
          <div className="flex min-w-max items-start justify-center">
            {steps.map((s, i) => {
              const isActive = step === s.id;
              const isDone = step > s.id;
              const hasErr = attempted.has(s.id) && stepHasErrors(s.id);
              return (
                <React.Fragment key={s.id}>
                  <button ref={isActive ? activeStepRef : undefined} type="button" onClick={() => void goStep(s.id)} disabled={saving || submitting} aria-current={isActive ? 'step' : undefined} aria-label={`Paso ${s.id} de ${totalSteps}: ${s.label}`} className="group flex min-h-11 w-[112px] shrink-0 flex-col items-center justify-start gap-1.5 rounded-lg px-1 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700">
                    <div aria-hidden="true" className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      hasErr ? 'bg-error-100 text-error-600 ring-2 ring-error-300' :
                      isActive ? 'bg-primary-700 text-white' :
                      isDone ? 'bg-primary-50 text-primary-800' :
                      'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200'
                    }`}>
                      {hasErr ? <AlertCircle size={16} /> : s.id}
                    </div>
                    <span className={`block max-w-full text-center text-xs font-medium leading-tight ${
                      hasErr ? 'text-error-700' : isActive ? 'text-primary-800' : isDone ? 'text-primary-700' : 'text-neutral-600'
                    }`}>{s.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`mx-0.5 mt-[18px] h-0.5 w-3 shrink-0 rounded sm:mx-1 sm:w-4 lg:flex-1 ${step > s.id ? 'bg-[#0D8A4F]/40' : 'bg-neutral-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </nav>

        {/* Step Content */}
        <div ref={validationRef} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-6 min-h-[320px]">
          {isReviewMode && <section aria-label="Borrador de prueba" className="mb-4 space-y-2 border-b border-neutral-200 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-primary-900">Modo prueba · sin trámites reales</strong><Button aria-label="Guardar borrador de prueba" variant="outline" leftIcon={<Save size={16} />} onClick={() => persistTrial(step)}>Guardar prueba</Button></div>
            <p role="status" className="text-sm text-neutral-700">{localSaved ? 'Guardado en este navegador' : 'Prueba en pantalla · no se confirmó el guardado local'}</p>
            <details className="text-sm text-neutral-700"><summary className="min-h-11 cursor-pointer py-3 font-medium text-primary-900">Cómo funciona esta prueba</summary><p className="pb-2 leading-6">Usa los mismos campos y lectura de documentos. No crea cuentas, trámites ni avisos. El borrador queda sólo en este navegador; los archivos se procesan temporalmente y se eliminan. Usá documentos de prueba, no datos sensibles.</p></details>
          </section>}
          {!isReviewMode && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <p role="status" className="text-sm text-neutral-700">{saving ? 'Guardando en SITREP…' : dirty ? (localSaved ? 'Cambios guardados en este dispositivo · pendientes de guardar en SITREP' : 'Cambios en pantalla · no se pudo guardar en este dispositivo') : 'Borrador guardado en SITREP · todavía no enviado'}</p>
            <Button variant="outline" leftIcon={<Save size={16} />} isLoading={saving} disabled={submitting || Boolean(localConflict)} onClick={() => void persistDraft(step)}>Guardar borrador</Button>
          </div>}
          {!isReviewMode && ownership.status === 'blocked' && <div role="alert" className="mb-4 text-sm text-error-800">Este borrador está abierto en otra pestaña. No se sobrescribirá.<Button variant="outline" className="ml-2" onClick={ownership.retry}>Reintentar edición</Button></div>}
          {!isReviewMode && ownership.status === 'unavailable' && <p role="alert" className="mb-4 text-sm text-error-800">El navegador no pudo proteger el borrador frente a otra pestaña. Los datos siguen en pantalla; no se guardará una edición sin proteger.</p>}
          {localConflict && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p>El borrador de SITREP cambió desde tu copia local. Elegí qué conservar; no mezclamos ni sobrescribimos automáticamente.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setForm(localConflict); setLocalConflict(null); setDirty(true); editRevision.current++; }}>Recuperar mis cambios locales</Button><Button variant="outline" onClick={() => { clearRegistrationDraft(owner!, draftScope); setLocalConflict(null); }}>Conservar versión de SITREP</Button></div></div>}
          {missingLocalFiles.length > 0 && <p role="alert" className="mb-4 text-sm text-amber-900">{isReviewMode ? 'Datos recuperados. Volvé a seleccionar los archivos de prueba para leerlos.' : `Hay archivos que no llegaron a guardarse: ${missingLocalFiles.join(', ')}. Volvé a seleccionarlos en Documentos. Los originales ya guardados se recuperan.`}</p>}
          {saveError && <div role="alert" className="mb-4 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-800"><p>{saveError}</p>{!isReviewMode && <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setResumeAttempt(value => value + 1)}>Conciliar borrador</Button><Button variant="outline" onClick={() => navigate('/login', { state: { from: `/inscripcion/${tipo}` } })}>Recuperar sesión</Button></div>}</div>}
          {validationError && <p role="alert" className="mb-4 text-sm text-error-800">{validationError}</p>}
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={goPrev}
            disabled={step === 1 || saving || submitting}
          >
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Guardando...
              </span>
            )}

            {isLastStep ? (
              <Button
                variant="primary"
                leftIcon={isReviewMode ? <Check size={16} /> : <Send size={16} />}
                onClick={handleSubmit}
                isLoading={submitting}
                disabled={saving}
              >
                {isReviewMode ? 'Finalizar revisión' : 'Enviar solicitud'}
              </Button>
            ) : (
              <Button
                variant="primary"
                rightIcon={<ArrowRight size={16} />}
                onClick={goNext}
                disabled={saving || submitting}
              >
                Siguiente
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InscripcionWizardPage;

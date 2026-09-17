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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, Check,
  Factory, FlaskConical, AlertCircle, Loader2, Truck,
} from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import api from '../../services/api';

// Shared constants & types
import {
  STEPS_GENERADOR,
  STEPS_OPERADOR,
  STEPS_TRANSPORTISTA,
  DOCS_GENERADOR,
  DOCS_OPERADOR,
  DOCS_TRANSPORTISTA,
  getReviewFixture,
  type RegistrationData,
  type TipoActor,
} from './inscripcion/shared';
import type { LocalOcrResult } from '../../services/ocr.service';
import { getApiErrorMessage } from '../../utils/api-error';

// Step components
import { StepCuenta } from './inscripcion/steps/StepCuenta';
import { StepEmpresa } from './inscripcion/steps/StepEmpresa';
import { StepDocumentos } from './inscripcion/steps/StepDocumentos';
import { StepTEF, type StepTEFHandle } from './inscripcion/steps/StepTEF';
import { StepResumen } from './inscripcion/steps/StepResumen';

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

  // Phase tracking
  const [phase, setPhase] = useState<1 | 2>(isReviewMode ? 2 : 1);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  // Phase 1 - Registration
  const [reg, setReg] = useState<RegistrationData>(reviewFixture?.reg || {
    nombre: '', email: '', password: '', confirmPassword: '', cuit: '',
  });

  // Phase 2 - Wizard
  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Record<string, string>>(reviewFixture?.form || {});
  const [adjuntos, setAdjuntos] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [ocrDatos, setOcrDatos] = useState<Record<string, LocalOcrResult>>({});
  const [existingDocuments, setExistingDocuments] = useState<Record<string, { id?: string; estado?: string; estadoScan?: string }>>({});
  const [documentDates, setDocumentDates] = useState<Record<string, { vigenteDesde?: string; vigenteHasta?: string }>>({});
  const onDateChange = (tipo: string, field: 'vigenteDesde' | 'vigenteHasta', value: string) => {
    setDirty(true);
    setDocumentDates(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: value } }));
  };
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // TEF ref for snapshotting values
  const tefRef = useRef<StepTEFHandle>(null);
  const stepperScrollRef = useRef<HTMLDivElement>(null);

  const up = useCallback((field: string, value: string) => {
    setDirty(true);
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const upReg = useCallback((field: string, value: string) => {
    setReg(prev => ({ ...prev, [field]: value }));
  }, []);

  // A restricted draft session is deliberately resumable after a browser
  // refresh or a post-verification login. Only the opaque solicitud id is
  // stored locally; the server remains the source of truth for all sections
  // and document metadata.
  useEffect(() => {
    if (isReviewMode) return undefined;
    const raw = localStorage.getItem('sitrep_pending_solicitud');
    if (!raw) return undefined;
    let pending: { id?: string; tipoActor?: string };
    try { pending = JSON.parse(raw); } catch { return undefined; }
    if (!pending.id || pending.tipoActor !== tipoActor) return undefined;

    let cancelled = false;
    setResumeStatus('loading');
    setSolicitudId(pending.id);
    setPhase(2);
    api.get(`/solicitudes/${pending.id}`).then((response) => {
      if (cancelled) return;
      const solicitud = response.data?.data?.solicitud;
      if (!solicitud || solicitud.tipoActor !== tipoActor) throw new Error('Solicitud incompatible');
      if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
        // A submitted/approved draft is no longer resumable. Clear only the
        // local resume pointer; the historical request and its files remain.
        localStorage.removeItem('sitrep_pending_solicitud');
        localStorage.removeItem('sitrep_solicitud_id');
        setSolicitudId(null);
        setPhase(1);
        setResumeStatus('idle');
        return;
      }
      const parseSection = (rawSection: unknown): Record<string, string> => {
        if (typeof rawSection !== 'string') return {};
        try {
          const parsed = JSON.parse(rawSection);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
          return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
            key,
            typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''),
          ]));
        } catch { return {}; }
      };
      setForm(prev => ({
        ...prev,
        ...parseSection(solicitud.datosActor),
        ...parseSection(solicitud.datosRegulatorio),
        ...parseSection(solicitud.datosResiduos),
        ...parseSection(solicitud.datosTEF),
      }));
      setReg(prev => ({
        ...prev,
        nombre: solicitud.usuario?.nombre || prev.nombre,
        email: solicitud.usuario?.email || prev.email,
        cuit: solicitud.usuario?.cuit || prev.cuit,
      }));
      const persisted = Object.fromEntries((solicitud.documentos || []).map((documento: { id: string; tipo: string; cara?: string; estado?: string; estadoScan?: string }) => [
        documento.cara ? `${documento.tipo}__${documento.cara}` : documento.tipo,
        { id: documento.id, estado: documento.estado, estadoScan: documento.estadoScan },
      ]));
      setExistingDocuments(persisted);
      setDocumentDates(Object.fromEntries((solicitud.documentos || []).filter((doc: { vigenteDesde?: string }) => doc.vigenteDesde).map((doc: { tipo: string; vigenteDesde: string; vigenteHasta?: string }) => [doc.tipo, { vigenteDesde: doc.vigenteDesde.slice(0, 10), vigenteHasta: doc.vigenteHasta?.slice(0, 10) }])));
      setResumeStatus('loaded');
    }).catch(() => {
      if (cancelled) return;
      // A network/auth failure must not destroy the resume pointer. Keep the
      // form blocked until the server draft is loaded to avoid overwriting it.
      setResumeStatus('error');
    });
    return () => { cancelled = true; };
  }, [tipoActor, isReviewMode, resumeAttempt]);

  useEffect(() => {
    if (isReviewMode || submitSuccess || (!dirty && Object.keys(adjuntos).length === 0 && !saving)) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty, adjuntos, saving, isReviewMode, submitSuccess]);

  // Keep the active stage centered inside the stepper on tablets and phones.
  // This scrolls only the horizontal rail and never the page itself.
  useEffect(() => {
    const rail = stepperScrollRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!rail || !active) return;
    const railBox = rail.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const activeCenterInContent = rail.scrollLeft + activeBox.left - railBox.left + activeBox.width / 2;
    const targetLeft = Math.min(
      Math.max(0, activeCenterInContent - rail.clientWidth / 2),
      Math.max(0, rail.scrollWidth - rail.clientWidth),
    );
    // Keep the current step immediately reachable after keyboard/touch navigation.
    // A smooth animation can leave the active item clipped while the next panel is
    // already interactive, especially in Android WebView/PWA shells.
    if (typeof rail.scrollTo === 'function') rail.scrollTo({ left: targetLeft, behavior: 'auto' });
    else rail.scrollLeft = targetLeft;
  }, [step]);

  // ========================================
  // PHASE 2 - Wizard navigation
  // ========================================

  const getStepErrors = (s: number): string[] => {
    // Review mode is a non-mutating guided tour. It must remain traversable
    // even if the reviewer clears the synthetic fixture fields.
    if (isReviewMode) return [];
    const errs: string[] = [];
    if (s === 1) {
      if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
      if (!form.domicilio?.trim()) errs.push('Domicilio es obligatorio');
    }
    if (isTransportista && s === 3) {
      try {
        const vehicles = form.vehiculosJson ? JSON.parse(form.vehiculosJson) : [];
        const drivers = form.choferesJson ? JSON.parse(form.choferesJson) : [];
        if (!Array.isArray(vehicles) || !vehicles.some((vehicle: Record<string, string>) => vehicle.patente?.trim() && vehicle.marca?.trim() && vehicle.modelo?.trim())) errs.push('Agregue al menos un vehículo completo');
        if (!Array.isArray(drivers) || !drivers.some((driver: Record<string, string>) => driver.nombre?.trim() && driver.apellido?.trim() && String(driver.dni || '').replace(/\D/g, '').length >= 7 && driver.licencia?.trim())) errs.push('Agregue al menos un chofer completo');
      } catch {
        errs.push('Complete vehículos y choferes');
      }
    }
    const docsStep = isGenerador ? 6 : isOperador ? 7 : 4;
    if (s === docsStep) {
      if (isReviewMode) return errs;
      for (const doc of getDocsForType()) {
        const keys = doc.caras === 'FRENTE_Y_DORSO' ? [`${doc.tipo}__FRENTE`, `${doc.tipo}__DORSO`] : [doc.tipo];
        if (doc.required === false && !keys.some(key => adjuntos[key] || existingDocuments[key])) continue;
        if (keys.some(key => !adjuntos[key] && (!existingDocuments[key] || existingDocuments[key].estado === 'RECHAZADO' || existingDocuments[key].estadoScan === 'RECHAZADO'))) errs.push(`Falta documentación completa: ${doc.nombre}`);
        if (doc.requiereVigencia) {
          const dates = documentDates[doc.tipo];
          const from = dates?.vigenteDesde ? new Date(dates.vigenteDesde).getTime() : NaN;
          const until = dates?.vigenteHasta ? new Date(dates.vigenteHasta).getTime() : NaN;
          if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until || from > Date.now() || until <= Date.now()) errs.push(`Completá una vigencia actual y válida: ${doc.nombre}`);
        }
      }
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const tefStepNumber = isGenerador ? 5 : isOperador ? 6 : -1;

  const sectionForStep = (stepNumber: number): string => {
    if (stepNumber === tefStepNumber) return 'tef';
    if (isGenerador && (stepNumber === 2 || stepNumber === 3)) return 'regulatorio';
    if (isGenerador && stepNumber === 4) return 'residuos';
    if (isOperador && (stepNumber === 2 || stepNumber === 3 || stepNumber === 4)) return 'regulatorio';
    if (isTransportista && (stepNumber === 2 || stepNumber === 3)) return 'regulatorio';
    if (isOperador && stepNumber === 5) return 'residuos';
    return 'empresa';
  };

  const sectionData = (section: string, source: Record<string, unknown> = form): Record<string, unknown> => {
    const fieldsBySection: Record<string, string[]> = {
      empresa: ['razonSocial', 'domicilio', 'telefono', 'emailContacto', 'actividad', 'rubro', 'tipoOperador', 'tecnologia', 'localidad', 'coordenadas', 'vehiculosJson', 'choferesJson'],
      regulatorio: ['numeroInscripcion', 'numeroHabilitacion', 'categoria', 'categoriaIndividual', 'alcanceTratamiento', 'expedienteInscripcion', 'certificadoNumero', 'resolucionInscripcion', 'resolucionDPA', 'resolucionSSP', 'vencimientoHabilitacion', 'corrientesAutorizadas', 'domicilioLegalCalle', 'domicilioLegalLocalidad', 'domicilioLegalDepto', 'domicilioRealCalle', 'domicilioRealLocalidad', 'domicilioRealDepto', 'representanteLegalNombre', 'representanteLegalDNI', 'representanteLegalTelefono', 'representanteTecnicoNombre', 'representanteTecnicoMatricula', 'representanteTecnicoTelefono', 'ocr'],
      residuos: ['corrientesControl', 'corrientesY', 'residuos', 'corrientes'],
      tef: ['factorR', 'montoMxR', 'tefInputs', 'tefPersonal', 'tefSuperficie', 'tefPotencia', 'tefZona'],
    };
    const allowed = new Set(fieldsBySection[section] || Object.keys(source));
    return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key)));
  };

  const saveSection = async (stepNumber: number, source = form) => {
    if (isReviewMode || !solicitudId) return;
    const section = sectionForStep(stepNumber);
    // Fleet fields belong to empresa even though they are edited on step 3.
    const sections = isTransportista && stepNumber === 3 ? ['empresa', section] : [section];
    await Promise.all(sections.map(name => api.put(`/solicitudes/${solicitudId}/secciones/${name}`, { data: sectionData(name, source) })));
    const docsStep = isGenerador ? 6 : isOperador ? 7 : 4;
    if (stepNumber === docsStep) await saveExistingDocumentDates();
  };

  const saveExistingDocumentDates = async () => {
    for (const [key, document] of Object.entries(existingDocuments)) {
      const dates = documentDates[key.split('__')[0]];
      if (!adjuntos[key] && document.id && dates) await api.patch(`/documentos/${document.id}/confirmar`, dates);
    }
  };

  const snapshotTEF = useCallback((): Record<string, string> => {
    if (!tefRef.current) return {};
    const tefValues = tefRef.current.snapshotTEF();
    setForm(prev => ({ ...prev, ...tefValues }));
    // React state updates are batched. Return the snapshot as well so the
    // caller can persist the exact values immediately instead of racing the
    // next render (important when advancing or submitting from the TEF step).
    return tefValues;
  }, []);

  const leaveStep = (): Record<string, string> => {
    if (step !== tefStepNumber) return form;
    return { ...form, ...snapshotTEF() };
  };

  const navigateStep = async (target: number, validate: boolean) => {
    if (saveInFlight.current || submitting || resumeStatus === 'loading' || resumeStatus === 'error') return;
    setAttempted(prev => new Set(prev).add(step));
    const source = leaveStep();
    if (validate && stepHasErrors(step)) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSection(step, source);
      setDirty(false);
      setStep(target);
    } catch (error) {
      setDirty(true);
      setSaveError(`No pudimos guardar este paso. Tus cambios siguen en pantalla. ${getApiErrorMessage(error, 'Revisá la conexión y volvé a intentarlo.')}`);
    } finally {
      setSaving(false);
      saveInFlight.current = false;
    }
  };

  const goNext = () => { if (step < totalSteps) void navigateStep(step + 1, true); };
  const goPrev = () => { if (step > 1) void navigateStep(step - 1, false); };
  const goStep = (s: number) => { if (s !== step) void navigateStep(s, false); };

  // File handling
  const handleAddFile = useCallback((tipo: string, file: File) => {
    setAdjuntos(prev => ({ ...prev, [tipo]: file }));
  }, []);

  const handleRemoveFile = useCallback((tipo: string) => {
    setAdjuntos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
  }, []);

  // Submit
  const handleSubmit = async () => {
    if (saveInFlight.current || submitting || resumeStatus === 'loading' || resumeStatus === 'error') return;
    if (isReviewMode) {
      setSubmitSuccess(true);
      return;
    }
    // Snapshot TEF if currently on TEF step
    const submitForm = { ...form, ...snapshotTEF() };
    // Validate required steps
    for (let s = 1; s <= totalSteps; s++) {
      const errs = getStepErrors(s);
      if (errs.length > 0) {
        setAttempted(prev => new Set(prev).add(s));
        setStep(s);
        return;
      }
    }

    if (!solicitudId) return;
    saveInFlight.current = true;
    setSubmitting(true);
    setRegError(null);

    try {
      // Persist every typed section before uploading files. The operations are
      // idempotent and can be safely retried after a transient VPN failure.
      await Promise.all(['empresa', 'regulatorio', 'residuos', 'tef'].map(section => (
        api.put(`/solicitudes/${solicitudId}/secciones/${section}`, { data: sectionData(section, { ...submitForm, ocr: ocrDatos }) })
      )));

      // Upload documents
      for (const [documentKey, file] of Object.entries(adjuntos)) {
        const fd = new FormData();
        fd.append('file', file);
        // A front/back capture is stored as two documents of the same base
        // type; the face remains available to the reviewer and does not
        // create a new regulatory document type.
        const [tipo, cara] = documentKey.split('__');
        fd.append('tipo', tipo);
        if (cara) fd.append('cara', cara);
        if (documentDates[tipo]?.vigenteDesde) fd.append('vigenteDesde', documentDates[tipo].vigenteDesde!);
        if (documentDates[tipo]?.vigenteHasta) fd.append('vigenteHasta', documentDates[tipo].vigenteHasta!);
        await api.post(`/solicitudes/${solicitudId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Apply explicitly confirmed date corrections to already uploaded files.
      // Confirmation invalidates the previous review on the API side.
      await saveExistingDocumentDates();

      // Submit solicitud
      await api.post(`/solicitudes/${solicitudId}/enviar`);
      localStorage.removeItem('sitrep_pending_solicitud');
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setRegError(getApiErrorMessage(err, 'Error al enviar la solicitud'));
    } finally {
      saveInFlight.current = false;
      setSubmitting(false);
    }
  };

  // ========================================
  // Determine which step content to render
  // ========================================

  const getDocsForType = () => {
    if (isGenerador) return DOCS_GENERADOR;
    if (isOperador) return DOCS_OPERADOR;
    return DOCS_TRANSPORTISTA;
  };

  /** Maps the current wizard step to the corresponding step component */
  const renderStepContent = () => {
    // Determine which logical step we're on
    // Generador: 1-4=empresa, 5=TEF, 6=docs, 7=resumen
    // Operador:  1-5=empresa, 6=TEF, 7=docs, 8=resumen
    // Transport: 1-3=empresa, 4=docs, 5=resumen

    if (isGenerador) {
      if (step <= 4) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 5) return <StepTEF ref={tefRef} form={form} isGenerador={isGenerador} isOperador={isOperador} />;
      if (step === 6) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} existingDocuments={existingDocuments} documentDates={documentDates} onDateChange={onDateChange} reviewMode={isReviewMode} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} onOcrResult={(tipo, result) => setOcrDatos(prev => ({ ...prev, [tipo]: result }))} />;
      if (step === 7) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isOperador) {
      if (step <= 5) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 6) return <StepTEF ref={tefRef} form={form} isGenerador={isGenerador} isOperador={isOperador} />;
      if (step === 7) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} existingDocuments={existingDocuments} documentDates={documentDates} onDateChange={onDateChange} reviewMode={isReviewMode} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} onOcrResult={(tipo, result) => setOcrDatos(prev => ({ ...prev, [tipo]: result }))} />;
      if (step === 8) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isTransportista) {
      if (step <= 3) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 4) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} existingDocuments={existingDocuments} documentDates={documentDates} onDateChange={onDateChange} reviewMode={isReviewMode} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} onOcrResult={(tipo, result) => setOcrDatos(prev => ({ ...prev, [tipo]: result }))} />;
      if (step === 5) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 max-w-lg text-center">
          <div className="w-16 h-16 bg-[#0D8A4F]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-[#0D8A4F]" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">{isReviewMode ? 'Revisión finalizada' : 'Solicitud enviada'}</h2>
          <p className="text-neutral-600 mb-6">
            {isReviewMode
              ? 'Recorriste el formulario modelo. No se creó una cuenta, no se enviaron documentos y no se modificó ninguna solicitud.'
              : `Tu solicitud de inscripción como ${isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'} fue enviada. Podrás consultar el estado al iniciar sesión; si las notificaciones por correo están habilitadas, también recibirás un aviso.`}
          </p>
          <Button variant="primary" onClick={() => isReviewMode ? navigate('/') : navigate('/login')}>
            {isReviewMode ? 'Volver al inicio' : 'Ir al login'}
          </Button>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Phase 1 - Registration
  // ========================================

  if (phase === 1) {
    return (
      <StepCuenta
        tipoActor={tipoActor}
        isGenerador={isGenerador}
        isOperador={isOperador}
        isTransportista={isTransportista}
        reg={reg}
        onRegChange={upReg}
        onPhase2={(solId) => { setSolicitudId(solId); setPhase(2); }}
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
        <div className="flex items-center gap-4">
          <button type="button" disabled={saving || submitting} onClick={() => {
            if (!isReviewMode && (dirty || Object.keys(adjuntos).length > 0) && !window.confirm('Hay cambios o archivos sin enviar. Si salís se perderán. ¿Querés salir?')) return;
            navigate(-1);
          }} aria-label="Volver a la pantalla anterior" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors">
            <ArrowLeft size={18} className="text-neutral-600" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isGenerador ? 'bg-purple-100' : isOperador ? 'bg-blue-100' : 'bg-orange-100'}`}>
              {isGenerador
                ? <Factory size={22} className="text-purple-600" />
                : isOperador ? <FlaskConical size={22} className="text-blue-600" />
                : <Truck size={22} className="text-orange-600" />
              }
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Inscripción como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
              </h2>
              <p className="text-xs text-neutral-500">Paso {step} de {totalSteps}</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div
          ref={stepperScrollRef}
          className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm [scrollbar-width:thin] sm:p-4"
          aria-label="Etapas de la inscripción"
          data-testid="registration-stepper"
        >
          <div className="flex min-w-max items-start justify-center">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              const hasErr = attempted.has(s.id) && stepHasErrors(s.id);
              return (
                <React.Fragment key={s.id}>
                  <button
                    type="button"
                    disabled={saving || submitting || resumeStatus === 'loading' || resumeStatus === 'error'}
                    onClick={() => goStep(s.id)}
                    aria-label={`Paso ${s.id} de ${totalSteps}: ${s.label}${isDone ? ', completado' : hasErr ? ', con errores' : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                    data-step-id={s.id}
                    className={`group flex min-h-11 w-14 shrink-0 flex-col items-center justify-start gap-1.5 rounded-lg px-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D8A4F] focus-visible:ring-offset-2 sm:w-[76px] lg:w-[84px] ${isActive ? 'scale-[1.03]' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      hasErr ? 'bg-error-100 text-error-600 ring-2 ring-error-300' :
                      isActive ? 'bg-[#0D8A4F] text-white shadow-lg shadow-[#0D8A4F]/20' :
                      isDone ? 'bg-[#0D8A4F]/10 text-[#0D8A4F]' :
                      'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'
                    }`}>
                      {hasErr ? <AlertCircle size={16} /> : isDone ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <span className={`hidden max-w-full text-center text-[10px] font-medium leading-tight sm:block ${
                      hasErr ? 'text-error-600' : isActive ? 'text-[#0D8A4F]' : isDone ? 'text-[#0D8A4F]' : 'text-neutral-400'
                    }`}>{s.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`mx-0.5 mt-[18px] h-0.5 w-3 shrink-0 rounded sm:mx-1 sm:w-4 lg:flex-1 ${step > s.id ? 'bg-[#0D8A4F]/40' : 'bg-neutral-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-6 min-h-[320px]">
          {isReviewMode && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
              <strong>Modo revisión de alta.</strong> Práctica sin altas ni envíos. Los archivos y el OCR se procesan sólo en este dispositivo.
            </div>
          )}
          {resumeStatus === 'loading' && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <Loader2 size={15} className="animate-spin" /> Recuperando el borrador guardado...
            </div>
          )}
          {resumeStatus === 'loaded' && (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Borrador reanudado. Los documentos ya cargados se conservarán al enviar.
            </div>
          )}
          {resumeStatus === 'error' && (
            <div role="alert" className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm">
              <p>No pudimos recuperar el borrador. No se borró tu solicitud. Revisá la conexión o iniciá sesión con la cuenta de la solicitud.</p>
              <Button className="mt-2" variant="outline" onClick={() => setResumeAttempt(n => n + 1)}>Reintentar recuperación</Button>
            </div>
          )}
          {saveError && <p role="alert" className="mb-4 rounded-xl bg-error-50 p-3 text-sm text-error-700">{saveError}</p>}
          {resumeStatus !== 'error' && resumeStatus !== 'loading' && (
            <fieldset disabled={saving || submitting} className="min-w-0">{renderStepContent()}</fieldset>
          )}
          {attempted.has(step) && getStepErrors(step).length > 0 && <ul role="alert" className="mt-3 list-disc pl-5 text-sm text-error-700">{getStepErrors(step).map(error => <li key={error}>{error}</li>)}</ul>}
          {!isReviewMode && Object.keys(adjuntos).length > 0 && <p className="mt-3 text-sm text-warning-700">Los archivos seleccionados se cargarán al enviar. No cierres ni recargues esta pantalla antes de terminar.</p>}
        </div>

        {/* Navigation Buttons */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={goPrev}
            disabled={step === 1 || saving || submitting || resumeStatus === 'loading' || resumeStatus === 'error'}
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
                disabled={saving || resumeStatus === 'loading' || resumeStatus === 'error'}
              >
                {isReviewMode ? 'Finalizar revisión' : 'Enviar solicitud'}
              </Button>
            ) : (
              <Button
                variant="primary"
                rightIcon={<ArrowRight size={16} />}
                onClick={goNext}
                disabled={saving || resumeStatus === 'loading' || resumeStatus === 'error'}
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

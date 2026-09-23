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

// Step components
import { StepCuenta } from './inscripcion/steps/StepCuenta';
import { StepEmpresa } from './inscripcion/steps/StepEmpresa';
import { StepDocumentos } from './inscripcion/steps/StepDocumentos';
import { StepTEF, type StepTEFHandle } from './inscripcion/steps/StepTEF';
import { StepResumen } from './inscripcion/steps/StepResumen';
import { getApiErrorMessage } from '../../utils/api-error';

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
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // TEF ref for snapshotting values
  const tefRef = useRef<StepTEFHandle>(null);

  const up = useCallback((field: string, value: string) => {
    setDirty(true);
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const upReg = useCallback((field: string, value: string) => {
    setReg(prev => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    if (isReviewMode) return undefined;
    const raw = localStorage.getItem('sitrep_pending_solicitud');
    if (!raw) return undefined;
    let pending: { id?: string; tipoActor?: TipoActor; step?: number };
    try { pending = JSON.parse(raw); } catch { return undefined; }
    if (!pending.id || pending.tipoActor !== tipoActor) return undefined;

    let cancelled = false;
    setResumeStatus('loading');
    api.get(`/solicitudes/${pending.id}`).then(response => {
      if (cancelled) return;
      const solicitud = response.data?.data?.solicitud;
      if (!solicitud || solicitud.tipoActor !== tipoActor) throw new Error('Solicitud incompatible');
      if (!['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) {
        localStorage.removeItem('sitrep_pending_solicitud');
        setResumeStatus('idle');
        return;
      }
      let persistedForm: Record<string, string> = {};
      try { persistedForm = JSON.parse(solicitud.datosActor || '{}'); } catch { /* keep blank fields */ }
      setForm(persistedForm);
      setReg(previous => ({ ...previous, nombre: solicitud.usuario?.nombre || '', email: solicitud.usuario?.email || '', cuit: solicitud.usuario?.cuit || '' }));
      setSolicitudId(pending.id!);
      setStep(Math.min(totalSteps, Math.max(1, Number(pending.step) || 1)));
      setPhase(2);
      setResumeStatus('loaded');
    }).catch(() => {
      if (!cancelled) setResumeStatus('error');
    });
    return () => { cancelled = true; };
  }, [tipoActor, isReviewMode, resumeAttempt, totalSteps]);

  useEffect(() => {
    if (isReviewMode || submitSuccess || (!dirty && Object.keys(adjuntos).length === 0)) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, adjuntos, isReviewMode, submitSuccess]);

  // ========================================
  // PHASE 2 - Wizard navigation
  // ========================================

  const getStepErrors = (s: number): string[] => {
    if (isReviewMode) return [];
    const errs: string[] = [];
    if (s === 1) {
      if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
      if (!form.domicilio?.trim()) errs.push('Domicilio es obligatorio');
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const tefStepNumber = isGenerador ? 5 : isOperador ? 6 : -1;

  const snapshotTEF = useCallback((): Record<string, string> => {
    if (!tefRef.current) return {};
    const tefValues = tefRef.current.snapshotTEF();
    setForm(prev => ({ ...prev, ...tefValues }));
    return tefValues;
  }, []);

  const leaveStep = (): Record<string, string> => {
    if (step !== tefStepNumber) return form;
    return { ...form, ...snapshotTEF() };
  };

  const goStep = async (target: number) => {
    if (target === step || saveInFlight.current || submitting) return;
    setAttempted(prev => new Set(prev).add(step));
    if (target > step && getStepErrors(step).length > 0) {
      setSaveError(getStepErrors(step).join('. '));
      return;
    }
    const currentForm = leaveStep();
    if (isReviewMode) {
      setStep(target);
      return;
    }
    if (!solicitudId) {
      setSaveError('No hay una solicitud activa. Volvé al inicio del alta para crearla.');
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/solicitudes/${solicitudId}`, { datosActor: { ...currentForm, nombre: reg.nombre, cuit: reg.cuit, email: reg.email } });
      localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: solicitudId, tipoActor, step: target }));
      setDirty(false);
      setStep(target);
    } catch (error: unknown) {
      setSaveError(`No se guardó este paso. Los datos siguen en pantalla. ${getApiErrorMessage(error, 'Revisá la conexión e intentá de nuevo.')}`);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const goNext = () => { if (step < totalSteps) void goStep(step + 1); };
  const goPrev = () => { if (step > 1) void goStep(step - 1); };

  // File handling
  const handleAddFile = useCallback((tipo: string, file: File) => {
    setDirty(true);
    setAdjuntos(prev => ({ ...prev, [tipo]: file }));
  }, []);

  const handleRemoveFile = useCallback((tipo: string) => {
    setAdjuntos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
  }, []);

  // Submit
  const handleSubmit = async () => {
    if (saveInFlight.current || submitting) return;
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

    if (!solicitudId) {
      setRegError('No hay una solicitud activa para enviar.');
      return;
    }
    setSubmitting(true);

    try {
      // Save final form data
      await api.put(`/solicitudes/${solicitudId}`, { datosActor: { ...submitForm, nombre: reg.nombre, cuit: reg.cuit, email: reg.email } });

      // Upload documents
      for (const [tipo, file] of Object.entries(adjuntos)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('tipo', tipo);
        await api.post(`/solicitudes/${solicitudId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Submit solicitud
      await api.post(`/solicitudes/${solicitudId}/enviar`);
      localStorage.removeItem('sitrep_pending_solicitud');
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setRegError(getApiErrorMessage(err, 'Error al enviar la solicitud'));
    } finally {
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
      if (step === 6) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} />;
      if (step === 7) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isOperador) {
      if (step <= 5) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 6) return <StepTEF ref={tefRef} form={form} isGenerador={isGenerador} isOperador={isOperador} />;
      if (step === 7) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} />;
      if (step === 8) return <StepResumen reg={reg} form={form} adjuntos={adjuntos} tipoActor={tipoActor} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} regError={regError} />;
    } else if (isTransportista) {
      if (step <= 3) return <StepEmpresa step={step} form={form} up={up} attempted={attempted} isGenerador={isGenerador} isOperador={isOperador} isTransportista={isTransportista} />;
      if (step === 4) return <StepDocumentos docs={getDocsForType()} adjuntos={adjuntos} onAddFile={handleAddFile} onRemoveFile={handleRemoveFile} />;
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
              ? 'Recorriste el formulario de prueba. No se creó ninguna cuenta, no se subieron archivos y no se envió ningún correo.'
              : `Tu solicitud de inscripción como ${isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'} fue enviada. Podrás consultar el estado al iniciar sesión.`}
          </p>
          <Button variant="primary" onClick={() => navigate(isReviewMode ? '/' : '/login')}>{isReviewMode ? 'Volver al inicio' : 'Ir al login'}</Button>
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
          {resumeStatus === 'error' && <Button variant="outline" className="mt-4" onClick={() => setResumeAttempt(value => value + 1)}>Reintentar</Button>}
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
          <button type="button" onClick={() => navigate(-1)} aria-label="Volver a la pantalla anterior" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors">
            <ArrowLeft size={18} className="text-neutral-600" />
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
              <p className="text-xs text-neutral-500">Paso {step} de {totalSteps} · {steps[step - 1]?.label}</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm [scrollbar-width:thin] sm:p-4" aria-label="Etapas de la inscripción" data-testid="registration-stepper">
          <div className="flex min-w-max items-start justify-center">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              const hasErr = attempted.has(s.id) && stepHasErrors(s.id);
              return (
                <React.Fragment key={s.id}>
                  <button type="button" onClick={() => void goStep(s.id)} disabled={saving || submitting} aria-current={isActive ? 'step' : undefined} aria-label={`Paso ${s.id} de ${totalSteps}: ${s.label}`} className={`group flex min-h-11 w-14 shrink-0 flex-col items-center justify-start gap-1.5 rounded-lg px-1 transition-all sm:w-[76px] lg:w-[84px] ${isActive ? 'scale-[1.03]' : ''}`}>
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
          {isReviewMode && <div role="status" className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"><strong>Modo revisión de alta.</strong> Podés recorrer todos los pasos sin completar campos. Nada se envía al servidor.</div>}
          {resumeStatus === 'loaded' && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Borrador recuperado. Continuá desde el último paso guardado.</p>}
          {saveError && <p role="alert" className="mb-4 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700">{saveError}</p>}
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

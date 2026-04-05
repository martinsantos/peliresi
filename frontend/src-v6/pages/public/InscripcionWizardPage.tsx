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

import React, { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  type RegistrationData,
  type TipoActor,
} from './inscripcion/shared';

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
  const isGenerador = tipo === 'generador';
  const isOperador = tipo === 'operador';
  const isTransportista = tipo === 'transportista';
  const tipoActor: TipoActor = isGenerador ? 'GENERADOR' : isOperador ? 'OPERADOR' : 'TRANSPORTISTA';
  const steps = isGenerador ? STEPS_GENERADOR : isOperador ? STEPS_OPERADOR : STEPS_TRANSPORTISTA;
  const totalSteps = steps.length;

  // Phase tracking
  const [phase, setPhase] = useState<1 | 2>(1);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  // Phase 1 - Registration
  const [reg, setReg] = useState<RegistrationData>({
    nombre: '', email: '', password: '', confirmPassword: '', cuit: '',
  });

  // Phase 2 - Wizard
  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Record<string, string>>({});
  const [adjuntos, setAdjuntos] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // TEF ref for snapshotting values
  const tefRef = useRef<StepTEFHandle>(null);

  const up = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const upReg = useCallback((field: string, value: string) => {
    setReg(prev => ({ ...prev, [field]: value }));
  }, []);

  // ========================================
  // PHASE 2 - Wizard navigation
  // ========================================

  const getStepErrors = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const tefStepNumber = isGenerador ? 5 : isOperador ? 6 : -1;

  const snapshotTEF = useCallback(() => {
    if (!tefRef.current) return;
    const tefValues = tefRef.current.snapshotTEF();
    setForm(prev => ({ ...prev, ...tefValues }));
  }, []);

  const leaveStep = () => {
    if (step === tefStepNumber) snapshotTEF();
  };

  const goNext = () => {
    setAttempted(prev => new Set(prev).add(step));
    leaveStep();
    if (step < totalSteps) setStep(step + 1);

    // Save progress in background (fire-and-forget)
    if (solicitudId) {
      setSaving(true);
      api.put(`/solicitudes/${solicitudId}`, { datosFormulario: form })
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  };

  const goPrev = () => { leaveStep(); if (step > 1) setStep(step - 1); };

  const goStep = (s: number) => {
    if (s !== step) {
      setAttempted(prev => new Set(prev).add(step));
      leaveStep();
    }
    setStep(s);
  };

  // File handling
  const handleAddFile = useCallback((tipo: string, file: File) => {
    setAdjuntos(prev => ({ ...prev, [tipo]: file }));
  }, []);

  const handleRemoveFile = useCallback((tipo: string) => {
    setAdjuntos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
  }, []);

  // Submit
  const handleSubmit = async () => {
    // Snapshot TEF if currently on TEF step
    snapshotTEF();
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
    setSubmitting(true);

    try {
      // Save final form data
      await api.put(`/solicitudes/${solicitudId}`, { datosFormulario: form });

      // Upload documents
      for (const [tipo, file] of Object.entries(adjuntos)) {
        const fd = new FormData();
        fd.append('archivo', file);
        fd.append('tipo', tipo);
        await api.post(`/solicitudes/${solicitudId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Submit solicitud
      await api.post(`/solicitudes/${solicitudId}/enviar`);
      setSubmitSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al enviar la solicitud';
      setRegError(msg);
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
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Solicitud enviada</h2>
          <p className="text-neutral-600 mb-6">
            Tu solicitud de inscripcion como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'} ha sido enviada exitosamente.
            Recibiras un email cuando el equipo de la DGFA la revise.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>Ir al login</Button>
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
        onSkip={() => setPhase(2)}
      />
    );
  }

  // ========================================
  // RENDER: Phase 2 - Wizard
  // ========================================

  const isLastStep = step === totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors">
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
                Inscripcion como {isGenerador ? 'Generador' : isOperador ? 'Operador' : 'Transportista'}
              </h2>
              <p className="text-xs text-neutral-500">Paso {step} de {totalSteps}</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              const hasErr = attempted.has(s.id) && stepHasErrors(s.id);
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => goStep(s.id)} className={`flex flex-col items-center gap-1.5 group transition-all ${isActive ? 'scale-105' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      hasErr ? 'bg-error-100 text-error-600 ring-2 ring-error-300' :
                      isActive ? 'bg-[#0D8A4F] text-white shadow-lg shadow-[#0D8A4F]/20' :
                      isDone ? 'bg-[#0D8A4F]/10 text-[#0D8A4F]' :
                      'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'
                    }`}>
                      {hasErr ? <AlertCircle size={16} /> : isDone ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight max-w-[64px] hidden sm:block ${
                      hasErr ? 'text-error-600' : isActive ? 'text-[#0D8A4F]' : isDone ? 'text-[#0D8A4F]' : 'text-neutral-400'
                    }`}>{s.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.id ? 'bg-[#0D8A4F]/40' : 'bg-neutral-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 min-h-[320px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={goPrev}
            disabled={step === 1}
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
                leftIcon={<Send size={16} />}
                onClick={handleSubmit}
                isLoading={submitting}
              >
                Enviar solicitud
              </Button>
            ) : (
              <Button
                variant="primary"
                rightIcon={<ArrowRight size={16} />}
                onClick={goNext}
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

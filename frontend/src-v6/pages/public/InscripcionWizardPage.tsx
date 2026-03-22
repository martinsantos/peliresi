/**
 * SITREP v6 - Inscripcion Wizard (Public)
 * ========================================
 * Public page (no auth required for Phase 1) that allows
 * self-registration as Generador or Operador.
 *
 * Phase 1: Account creation (POST /api/solicitudes/iniciar)
 * Phase 2: Multi-step wizard to complete the solicitud
 */

import React, { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, Upload, Check,
  Building2, FileText, MapPin, Users, Shield,
  Factory, FlaskConical, AlertCircle, Loader2,
  Eye, EyeOff, X, Paperclip, ClipboardList,
} from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import api from '../../services/api';
import axios from 'axios';

// ========================================
// CONSTANTS
// ========================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const DEPARTAMENTOS_MENDOZA = [
  'Capital', 'Godoy Cruz', 'Guaymallen', 'Las Heras', 'Lujan de Cuyo',
  'Maipu', 'San Rafael', 'General Alvear', 'Junin', 'La Paz',
  'Lavalle', 'Malargue', 'Rivadavia', 'San Carlos', 'San Martin',
  'Santa Rosa', 'Tunuyan', 'Tupungato',
];

const CATEGORIAS_GENERADOR = ['Grandes Generadores', 'Medianos Generadores', 'Pequenos Generadores'];

const DOCS_GENERADOR = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria Tecnica' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion' },
];

const DOCS_OPERADOR = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion' },
  { tipo: 'RESOLUCION_DPA', nombre: 'Resolucion DPA' },
];

interface StepDef {
  id: number;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const STEPS_GENERADOR: StepDef[] = [
  { id: 1, label: 'Establecimiento', icon: Factory },
  { id: 2, label: 'Regulatorio', icon: ClipboardList },
  { id: 3, label: 'Domicilios', icon: MapPin },
  { id: 4, label: 'Adicional', icon: Shield },
  { id: 5, label: 'Documentos', icon: FileText },
  { id: 6, label: 'Resumen', icon: Check },
];

const STEPS_OPERADOR: StepDef[] = [
  { id: 1, label: 'Establecimiento', icon: FlaskConical },
  { id: 2, label: 'Regulatorio', icon: ClipboardList },
  { id: 3, label: 'Domicilios', icon: MapPin },
  { id: 4, label: 'Representantes', icon: Users },
  { id: 5, label: 'Corrientes', icon: Shield },
  { id: 6, label: 'Documentos', icon: FileText },
  { id: 7, label: 'Resumen', icon: Check },
];

// ========================================
// HELPERS
// ========================================

function FieldError({ show, msg }: { show: boolean; msg: string }) {
  if (!show) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-error-600 mt-1">
      <AlertCircle size={12} /> {msg}
    </p>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={20} className="text-[#0D8A4F]" />
      <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
    </div>
  );
}

const inputCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

const selectCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

const labelCls = 'block text-sm font-medium text-neutral-700 mb-1';

function validateCuit(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  return digits.length === 11;
}

function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('Minimo 8 caracteres');
  if (!/[A-Z]/.test(pw)) errors.push('Al menos 1 mayuscula');
  if (!/\d/.test(pw)) errors.push('Al menos 1 numero');
  return { valid: errors.length === 0, errors };
}

// ========================================
// COMPONENT
// ========================================

const InscripcionWizardPage: React.FC = () => {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const isGenerador = tipo === 'generador';
  const isOperador = tipo === 'operador';
  const tipoActor = isGenerador ? 'GENERADOR' : 'OPERADOR';
  const steps = isGenerador ? STEPS_GENERADOR : STEPS_OPERADOR;
  const totalSteps = steps.length;

  // Phase tracking
  const [phase, setPhase] = useState<1 | 2>(1);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  // Phase 1 - Registration
  const [reg, setReg] = useState({
    nombre: '', email: '', password: '', confirmPassword: '', cuit: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regAttempted, setRegAttempted] = useState(false);

  // Phase 2 - Wizard
  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Record<string, string>>({});
  const [adjuntos, setAdjuntos] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocTipo, setActiveDocTipo] = useState<string | null>(null);

  const up = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const upReg = useCallback((field: string, value: string) => {
    setReg(prev => ({ ...prev, [field]: value }));
  }, []);

  // ========================================
  // PHASE 1 - Registration
  // ========================================

  const regErrors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!reg.nombre.trim()) e.nombre = 'Nombre es obligatorio';
    if (!reg.email.trim()) e.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) e.email = 'Email invalido';
    if (!reg.cuit.trim()) e.cuit = 'CUIT es obligatorio';
    else if (!validateCuit(reg.cuit)) e.cuit = 'CUIT debe tener 11 digitos';
    if (!reg.password) e.password = 'Password es obligatorio';
    else {
      const pw = validatePassword(reg.password);
      if (!pw.valid) e.password = pw.errors.join(', ');
    }
    if (reg.password !== reg.confirmPassword) e.confirmPassword = 'Las passwords no coinciden';
    return e;
  };

  const handleRegistration = async () => {
    setRegAttempted(true);
    const errors = regErrors();
    if (Object.keys(errors).length > 0) return;

    setRegSubmitting(true);
    setRegError(null);
    try {
      const res = await axios.post(`${API_BASE}/solicitudes/iniciar`, {
        nombre: reg.nombre,
        email: reg.email,
        password: reg.password,
        cuit: reg.cuit.replace(/\D/g, ''),
        tipoActor,
      });
      const data = res.data?.data || res.data;
      setSolicitudId(data.solicitudId || data.id);

      // If the response includes a token, store it for Phase 2 API calls
      if (data.token) {
        localStorage.setItem('sitrep_access_token', data.token);
      }
      if (data.refreshToken) {
        localStorage.setItem('sitrep_refresh_token', data.refreshToken);
      }

      setPhase(2);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al crear la cuenta';
      setRegError(msg);
    } finally {
      setRegSubmitting(false);
    }
  };

  const rErr = regAttempted ? regErrors() : {};

  // ========================================
  // PHASE 2 - Wizard navigation
  // ========================================

  const getStepErrors = (s: number): string[] => {
    const errs: string[] = [];
    if (isGenerador) {
      if (s === 1) {
        if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
      }
    } else {
      if (s === 1) {
        if (!form.razonSocial?.trim()) errs.push('Razon Social es obligatoria');
      }
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const goNext = async () => {
    setAttempted(prev => new Set(prev).add(step));
    const errs = getStepErrors(step);
    if (errs.length > 0) return;

    // Save progress
    if (solicitudId) {
      setSaving(true);
      try {
        await api.put(`/solicitudes/${solicitudId}`, { datosFormulario: form });
      } catch {
        // Silent save failure - user can continue
      } finally {
        setSaving(false);
      }
    }

    if (step < totalSteps) setStep(step + 1);
  };

  const goPrev = () => { if (step > 1) setStep(step - 1); };

  const goStep = (s: number) => {
    if (s < step) { setStep(s); return; }
    setAttempted(prev => new Set(prev).add(step));
    if (getStepErrors(step).length > 0) return;
    setStep(s);
  };

  // File handling
  const triggerFileInput = (tipo: string) => {
    setActiveDocTipo(tipo);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocTipo) {
      setAdjuntos(prev => ({ ...prev, [activeDocTipo]: file }));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (tipo: string) => {
    setAdjuntos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
  };

  // Submit
  const handleSubmit = async () => {
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
  // RENDER: Invalid tipo
  // ========================================

  if (!isGenerador && !isOperador) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Tipo invalido</h2>
          <p className="text-neutral-500 mb-4">El tipo de inscripcion debe ser "generador" o "operador".</p>
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
            Tu solicitud de inscripcion como {isGenerador ? 'Generador' : 'Operador'} ha sido enviada exitosamente.
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
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isGenerador ? 'bg-purple-100' : 'bg-blue-100'}`}>
              {isGenerador
                ? <Factory size={28} className="text-purple-600" />
                : <FlaskConical size={28} className="text-blue-600" />
              }
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">
              Inscripcion como {isGenerador ? 'Generador' : 'Operador'}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Registro Provincial de {isGenerador ? 'Generadores' : 'Operadores'} de RRPP - Ley 5917
            </p>
          </div>

          {/* Registration Form */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-neutral-800">Paso 1: Crear cuenta</h3>

            <div>
              <label className={labelCls}>Nombre completo *</label>
              <input
                type="text" value={reg.nombre}
                onChange={e => upReg('nombre', e.target.value)}
                placeholder="Juan Perez"
                className={inputCls(!!rErr.nombre)}
              />
              <FieldError show={!!rErr.nombre} msg={rErr.nombre || ''} />
            </div>

            <div>
              <label className={labelCls}>Email *</label>
              <input
                type="email" value={reg.email}
                onChange={e => upReg('email', e.target.value)}
                placeholder="correo@empresa.com"
                className={inputCls(!!rErr.email)}
              />
              <FieldError show={!!rErr.email} msg={rErr.email || ''} />
            </div>

            <div>
              <label className={labelCls}>CUIT *</label>
              <input
                type="text" value={reg.cuit}
                onChange={e => upReg('cuit', e.target.value)}
                placeholder="30-12345678-9"
                className={inputCls(!!rErr.cuit)}
              />
              <FieldError show={!!rErr.cuit} msg={rErr.cuit || ''} />
            </div>

            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={reg.password}
                  onChange={e => upReg('password', e.target.value)}
                  placeholder="Min 8 chars, 1 mayuscula, 1 numero"
                  className={inputCls(!!rErr.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError show={!!rErr.password} msg={rErr.password || ''} />
            </div>

            <div>
              <label className={labelCls}>Confirmar password *</label>
              <input
                type="password"
                value={reg.confirmPassword}
                onChange={e => upReg('confirmPassword', e.target.value)}
                placeholder="Repetir password"
                className={inputCls(!!rErr.confirmPassword)}
              />
              <FieldError show={!!rErr.confirmPassword} msg={rErr.confirmPassword || ''} />
            </div>

            {regError && (
              <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
                {regError}
              </div>
            )}

            <Button
              variant="primary" fullWidth
              isLoading={regSubmitting}
              onClick={handleRegistration}
              rightIcon={<ArrowRight size={16} />}
            >
              Crear cuenta y continuar
            </Button>

            <p className="text-xs text-neutral-400 text-center mt-2">
              Ya tenes cuenta?{' '}
              <button onClick={() => navigate('/login')} className="text-[#0D8A4F] font-medium hover:underline">
                Inicia sesion
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Phase 2 - Wizard
  // ========================================

  const isLastStep = step === totalSteps;

  // Determine which step content to render based on tipo
  const renderGeneradorStep = () => {
    switch (step) {
      case 1: return (
        <div className="space-y-4">
          <SectionTitle icon={Factory} title="Datos del Establecimiento" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Razon Social *</label>
              <input value={form.razonSocial || ''} onChange={e => up('razonSocial', e.target.value)}
                placeholder="Empresa S.A." className={inputCls(attempted.has(1) && !form.razonSocial?.trim())} />
              <FieldError show={attempted.has(1) && !form.razonSocial?.trim()} msg="Razon Social es obligatoria" />
            </div>
            <div>
              <label className={labelCls}>Domicilio</label>
              <input value={form.domicilio || ''} onChange={e => up('domicilio', e.target.value)}
                placeholder="Calle 123, Ciudad" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Telefono</label>
              <input value={form.telefono || ''} onChange={e => up('telefono', e.target.value)}
                placeholder="0261-4XXXXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Email de contacto</label>
              <input type="email" value={form.emailContacto || ''} onChange={e => up('emailContacto', e.target.value)}
                placeholder="contacto@empresa.com" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Actividad</label>
              <input value={form.actividad || ''} onChange={e => up('actividad', e.target.value)}
                placeholder="Ej: Fabricacion de pinturas" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Rubro</label>
              <input value={form.rubro || ''} onChange={e => up('rubro', e.target.value)}
                placeholder="Ej: Industria quimica" className={inputCls()} />
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <SectionTitle icon={ClipboardList} title="Datos Regulatorios" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N de Inscripcion</label>
              <input value={form.numeroInscripcion || ''} onChange={e => up('numeroInscripcion', e.target.value)}
                placeholder="G-000XXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <select value={form.categoria || ''} onChange={e => up('categoria', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                {CATEGORIAS_GENERADOR.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Expediente Inscripcion</label>
              <input value={form.expedienteInscripcion || ''} onChange={e => up('expedienteInscripcion', e.target.value)}
                placeholder="EXP-XXXX-XXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Resolucion Inscripcion</label>
              <input value={form.resolucionInscripcion || ''} onChange={e => up('resolucionInscripcion', e.target.value)}
                placeholder="RES-XXXX" className={inputCls()} />
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <SectionTitle icon={MapPin} title="Domicilios" />
          <h4 className="text-sm font-semibold text-neutral-700">Domicilio Legal</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Calle</label>
              <input value={form.domicilioLegalCalle || ''} onChange={e => up('domicilioLegalCalle', e.target.value)}
                placeholder="Av. San Martin 123" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input value={form.domicilioLegalLocalidad || ''} onChange={e => up('domicilioLegalLocalidad', e.target.value)}
                placeholder="Mendoza" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select value={form.domicilioLegalDepto || ''} onChange={e => up('domicilioLegalDepto', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-neutral-700 mt-4">Domicilio Real</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Calle</label>
              <input value={form.domicilioRealCalle || ''} onChange={e => up('domicilioRealCalle', e.target.value)}
                placeholder="Ruta 40 km 5" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input value={form.domicilioRealLocalidad || ''} onChange={e => up('domicilioRealLocalidad', e.target.value)}
                placeholder="Lujan de Cuyo" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select value={form.domicilioRealDepto || ''} onChange={e => up('domicilioRealDepto', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <SectionTitle icon={Shield} title="Datos Adicionales" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Corrientes de Control</label>
              <input value={form.corrientesControl || ''} onChange={e => up('corrientesControl', e.target.value)}
                placeholder="Y1, Y2, Y3..." className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Categoria Individual</label>
              <select value={form.categoriaIndividual || ''} onChange={e => up('categoriaIndividual', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                <option value="MINIMA">Minima</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="2000-3000">2000-3000</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Libro de Operatoria</label>
              <input value={form.libroOperatoria || ''} onChange={e => up('libroOperatoria', e.target.value)}
                placeholder="N de libro" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Certificacion ISO</label>
              <input type="date" value={form.certificacionISO || ''} onChange={e => up('certificacionISO', e.target.value)}
                className={inputCls()} />
            </div>
          </div>
        </div>
      );

      case 5: return renderDocumentos(DOCS_GENERADOR);
      case 6: return renderResumen();
      default: return null;
    }
  };

  const renderOperadorStep = () => {
    switch (step) {
      case 1: return (
        <div className="space-y-4">
          <SectionTitle icon={FlaskConical} title="Datos del Establecimiento" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Razon Social *</label>
              <input value={form.razonSocial || ''} onChange={e => up('razonSocial', e.target.value)}
                placeholder="Operador S.A." className={inputCls(attempted.has(1) && !form.razonSocial?.trim())} />
              <FieldError show={attempted.has(1) && !form.razonSocial?.trim()} msg="Razon Social es obligatoria" />
            </div>
            <div>
              <label className={labelCls}>Domicilio</label>
              <input value={form.domicilio || ''} onChange={e => up('domicilio', e.target.value)}
                placeholder="Calle 123, Ciudad" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Telefono</label>
              <input value={form.telefono || ''} onChange={e => up('telefono', e.target.value)}
                placeholder="0261-4XXXXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Email de contacto</label>
              <input type="email" value={form.emailContacto || ''} onChange={e => up('emailContacto', e.target.value)}
                placeholder="contacto@operador.com" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de Operador</label>
              <select value={form.tipoOperador || ''} onChange={e => up('tipoOperador', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                <option value="TRATAMIENTO">Tratamiento</option>
                <option value="DISPOSICION_FINAL">Disposicion Final</option>
                <option value="ALMACENAMIENTO">Almacenamiento</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tecnologia</label>
              <input value={form.tecnologia || ''} onChange={e => up('tecnologia', e.target.value)}
                placeholder="Ej: Incineracion, neutralizacion" className={inputCls()} />
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <SectionTitle icon={ClipboardList} title="Datos Regulatorios" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N de Habilitacion</label>
              <input value={form.numeroHabilitacion || ''} onChange={e => up('numeroHabilitacion', e.target.value)}
                placeholder="HAB-XXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <input value={form.categoria || ''} onChange={e => up('categoria', e.target.value)}
                placeholder="Categoria del operador" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Expediente Inscripcion</label>
              <input value={form.expedienteInscripcion || ''} onChange={e => up('expedienteInscripcion', e.target.value)}
                placeholder="EXP-XXXX-XXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Certificado Numero</label>
              <input value={form.certificadoNumero || ''} onChange={e => up('certificadoNumero', e.target.value)}
                placeholder="CERT-XXXX" className={inputCls()} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Resolucion DPA</label>
            <input value={form.resolucionDPA || ''} onChange={e => up('resolucionDPA', e.target.value)}
              placeholder="RES-DPA-XXXX" className={inputCls()} />
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <SectionTitle icon={MapPin} title="Domicilios" />
          <h4 className="text-sm font-semibold text-neutral-700">Domicilio Legal</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Calle</label>
              <input value={form.domicilioLegalCalle || ''} onChange={e => up('domicilioLegalCalle', e.target.value)}
                placeholder="Av. San Martin 123" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input value={form.domicilioLegalLocalidad || ''} onChange={e => up('domicilioLegalLocalidad', e.target.value)}
                placeholder="Mendoza" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select value={form.domicilioLegalDepto || ''} onChange={e => up('domicilioLegalDepto', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-neutral-700 mt-4">Domicilio Real</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Calle</label>
              <input value={form.domicilioRealCalle || ''} onChange={e => up('domicilioRealCalle', e.target.value)}
                placeholder="Ruta 40 km 5" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input value={form.domicilioRealLocalidad || ''} onChange={e => up('domicilioRealLocalidad', e.target.value)}
                placeholder="Lujan de Cuyo" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select value={form.domicilioRealDepto || ''} onChange={e => up('domicilioRealDepto', e.target.value)} className={selectCls()}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <SectionTitle icon={Users} title="Representantes" />
          <h4 className="text-sm font-semibold text-neutral-700">Representante Legal</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Nombre</label>
              <input value={form.representanteLegalNombre || ''} onChange={e => up('representanteLegalNombre', e.target.value)}
                placeholder="Nombre completo" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>DNI</label>
              <input value={form.representanteLegalDNI || ''} onChange={e => up('representanteLegalDNI', e.target.value)}
                placeholder="12345678" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <input value={form.representanteLegalTelefono || ''} onChange={e => up('representanteLegalTelefono', e.target.value)}
                placeholder="0261-XXXXXXX" className={inputCls()} />
            </div>
          </div>

          <h4 className="text-sm font-semibold text-neutral-700 mt-4">Representante Tecnico</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Nombre</label>
              <input value={form.representanteTecnicoNombre || ''} onChange={e => up('representanteTecnicoNombre', e.target.value)}
                placeholder="Nombre completo" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Matricula</label>
              <input value={form.representanteTecnicoMatricula || ''} onChange={e => up('representanteTecnicoMatricula', e.target.value)}
                placeholder="MAT-XXXX" className={inputCls()} />
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <input value={form.representanteTecnicoTelefono || ''} onChange={e => up('representanteTecnicoTelefono', e.target.value)}
                placeholder="0261-XXXXXXX" className={inputCls()} />
            </div>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <SectionTitle icon={Shield} title="Corrientes de Residuos (Y)" />
          <p className="text-sm text-neutral-500">
            Indique las corrientes de residuos que el operador esta habilitado a recibir y tratar.
          </p>
          <div>
            <label className={labelCls}>Corrientes Y</label>
            <textarea
              value={form.corrientesY || ''}
              onChange={e => up('corrientesY', e.target.value)}
              placeholder="Y1, Y2, Y3... (separadas por coma)"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors resize-none"
            />
          </div>
        </div>
      );

      case 6: return renderDocumentos(DOCS_OPERADOR);
      case 7: return renderResumen();
      default: return null;
    }
  };

  // Shared: Documents step
  function renderDocumentos(docs: { tipo: string; nombre: string }[]) {
    return (
      <div className="space-y-4">
        <SectionTitle icon={FileText} title="Documentos" />
        <p className="text-sm text-neutral-500">
          Adjunte los documentos requeridos. Formatos aceptados: PDF, JPG, PNG (max 10MB).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="space-y-3">
          {docs.map(doc => {
            const attached = adjuntos[doc.tipo];
            return (
              <div key={doc.tipo} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-3">
                  <Paperclip size={16} className="text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{doc.nombre}</p>
                    {attached && (
                      <p className="text-xs text-[#0D8A4F]">{attached.name} ({(attached.size / 1024).toFixed(0)} KB)</p>
                    )}
                  </div>
                </div>
                {attached ? (
                  <button onClick={() => removeFile(doc.tipo)} className="p-1.5 rounded-lg hover:bg-error-100 text-error-500 transition-colors">
                    <X size={16} />
                  </button>
                ) : (
                  <Button variant="outline" size="sm" leftIcon={<Upload size={14} />} onClick={() => triggerFileInput(doc.tipo)}>
                    Adjuntar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Shared: Summary step
  function renderResumen() {
    const sections: { label: string; fields: { label: string; value: string }[] }[] = [];

    // Account info
    sections.push({
      label: 'Cuenta',
      fields: [
        { label: 'Nombre', value: reg.nombre },
        { label: 'Email', value: reg.email },
        { label: 'CUIT', value: reg.cuit },
        { label: 'Tipo', value: tipoActor },
      ],
    });

    // Establecimiento
    const estFields = [
      { label: 'Razon Social', value: form.razonSocial || '' },
      { label: 'Domicilio', value: form.domicilio || '' },
      { label: 'Telefono', value: form.telefono || '' },
      { label: 'Email contacto', value: form.emailContacto || '' },
    ];
    if (isGenerador) {
      estFields.push({ label: 'Actividad', value: form.actividad || '' });
      estFields.push({ label: 'Rubro', value: form.rubro || '' });
    } else {
      estFields.push({ label: 'Tipo Operador', value: form.tipoOperador || '' });
      estFields.push({ label: 'Tecnologia', value: form.tecnologia || '' });
    }
    sections.push({ label: 'Establecimiento', fields: estFields });

    // Regulatorio
    const regFields: { label: string; value: string }[] = [];
    if (isGenerador) {
      regFields.push(
        { label: 'N Inscripcion', value: form.numeroInscripcion || '' },
        { label: 'Categoria', value: form.categoria || '' },
        { label: 'Expediente', value: form.expedienteInscripcion || '' },
        { label: 'Resolucion', value: form.resolucionInscripcion || '' },
      );
    } else {
      regFields.push(
        { label: 'N Habilitacion', value: form.numeroHabilitacion || '' },
        { label: 'Categoria', value: form.categoria || '' },
        { label: 'Expediente', value: form.expedienteInscripcion || '' },
        { label: 'Certificado N', value: form.certificadoNumero || '' },
        { label: 'Resolucion DPA', value: form.resolucionDPA || '' },
      );
    }
    sections.push({ label: 'Regulatorio', fields: regFields });

    // Domicilios
    sections.push({
      label: 'Domicilios',
      fields: [
        { label: 'Legal - Calle', value: form.domicilioLegalCalle || '' },
        { label: 'Legal - Localidad', value: form.domicilioLegalLocalidad || '' },
        { label: 'Legal - Depto', value: form.domicilioLegalDepto || '' },
        { label: 'Real - Calle', value: form.domicilioRealCalle || '' },
        { label: 'Real - Localidad', value: form.domicilioRealLocalidad || '' },
        { label: 'Real - Depto', value: form.domicilioRealDepto || '' },
      ],
    });

    // Operador-specific
    if (isOperador) {
      sections.push({
        label: 'Representantes',
        fields: [
          { label: 'Legal - Nombre', value: form.representanteLegalNombre || '' },
          { label: 'Legal - DNI', value: form.representanteLegalDNI || '' },
          { label: 'Legal - Telefono', value: form.representanteLegalTelefono || '' },
          { label: 'Tecnico - Nombre', value: form.representanteTecnicoNombre || '' },
          { label: 'Tecnico - Matricula', value: form.representanteTecnicoMatricula || '' },
          { label: 'Tecnico - Telefono', value: form.representanteTecnicoTelefono || '' },
        ],
      });
      sections.push({
        label: 'Corrientes',
        fields: [
          { label: 'Corrientes Y', value: form.corrientesY || '' },
        ],
      });
    } else {
      sections.push({
        label: 'Adicional',
        fields: [
          { label: 'Corrientes Control', value: form.corrientesControl || '' },
          { label: 'Categoria Individual', value: form.categoriaIndividual || '' },
          { label: 'Libro Operatoria', value: form.libroOperatoria || '' },
          { label: 'Certificacion ISO', value: form.certificacionISO || '' },
        ],
      });
    }

    // Documents
    const docEntries = Object.entries(adjuntos);
    if (docEntries.length > 0) {
      sections.push({
        label: 'Documentos adjuntos',
        fields: docEntries.map(([tipo, file]) => ({
          label: tipo.replace(/_/g, ' '),
          value: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
        })),
      });
    }

    return (
      <div className="space-y-4">
        <SectionTitle icon={Check} title="Resumen de la Solicitud" />
        <p className="text-sm text-neutral-500">
          Revise los datos antes de enviar. Podra volver a pasos anteriores para corregir.
        </p>

        {regError && (
          <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
            {regError}
          </div>
        )}

        {sections.map(section => (
          <div key={section.label} className="rounded-xl border border-neutral-200 overflow-hidden">
            <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
              <h4 className="text-sm font-semibold text-neutral-700">{section.label}</h4>
            </div>
            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {section.fields
                .filter(f => f.value)
                .map(f => (
                  <div key={f.label} className="flex justify-between text-sm py-0.5">
                    <span className="text-neutral-500">{f.label}</span>
                    <span className="text-neutral-900 font-medium text-right max-w-[60%] truncate">{f.value}</span>
                  </div>
                ))}
              {section.fields.every(f => !f.value) && (
                <p className="text-sm text-neutral-400 italic col-span-2">Sin datos ingresados</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isGenerador ? 'bg-purple-100' : 'bg-blue-100'}`}>
              {isGenerador
                ? <Factory size={22} className="text-purple-600" />
                : <FlaskConical size={22} className="text-blue-600" />
              }
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Inscripcion como {isGenerador ? 'Generador' : 'Operador'}
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
          {isGenerador ? renderGeneradorStep() : renderOperadorStep()}
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

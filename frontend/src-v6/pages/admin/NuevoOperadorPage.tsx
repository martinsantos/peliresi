/**
 * SITREP v6 - Nuevo / Editar Operador — Wizard 7 pasos
 * =====================================================
 * Paso 1: Identificacion y Contacto
 * Paso 2: Domicilios
 * Paso 3: Representantes
 * Paso 4: Residuos (Corrientes Y + tecnologia)
 * Paso 5: Calculo TEF
 * Paso 6: Regulatorio y Acceso
 * Paso 7: Archivos Adjuntos + Resumen + Confirmar
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, FlaskConical, MapPin, Lock,
  Biohazard, Loader2, ClipboardList, Calculator, FileText,
  Check, Upload, Building2, AlertCircle, X, Paperclip, Users,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import { useOperador, useCreateOperador, useUpdateOperador } from '../../hooks/useActores';
import { useUploadOperadorDocumento } from '../../hooks/useGeneradorFiscal';
import type { CreateOperadorRequest } from '../../types/api';
import type { Operador } from '../../types/models';
import { CORRIENTES_Y, CORRIENTES_Y_CODES, parseCorrientes } from '../../data/corrientes-y';
import { OPERADORES_DATA } from '../../data/operadores-enrichment';
import { C_CORRIENTES } from '../../utils/calculoTEF';
import CalculadoraTEF, { type TEFInputs } from '../../components/CalculadoraTEF';

const STEPS = [
  { id: 1, label: 'Identificacion', icon: FlaskConical },
  { id: 2, label: 'Domicilios', icon: MapPin },
  { id: 3, label: 'Representantes', icon: Users },
  { id: 4, label: 'Residuos', icon: Biohazard },
  { id: 5, label: 'Calculo TEF', icon: Calculator },
  { id: 6, label: 'Regulatorio', icon: ClipboardList },
  { id: 7, label: 'Adjuntos', icon: Upload },
];
const TOTAL_STEPS = 7;

const DOCUMENTOS_REQUERIDOS = [
  { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria Tecnica', obligatorio: true },
  { tipo: 'PLAN_CONTINGENCIA', nombre: 'Plan de Contingencia', obligatorio: true },
  { tipo: 'HABILITACION_MUNICIPAL', nombre: 'Habilitacion Municipal', obligatorio: true },
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', obligatorio: true },
  { tipo: 'CERTIFICADO_TRATAMIENTO', nombre: 'Certificado de Tratamiento', obligatorio: true },
  { tipo: 'POLIZA_SEGURO', nombre: 'Poliza de Seguro Ambiental', obligatorio: false },
  { tipo: 'PLANOS_PLANTA', nombre: 'Planos de Planta', obligatorio: false },
];

const CATEGORIAS = ['Planta Fija', 'Operador In Situ'];
const TIPO_OPERADOR = ['FIJO', 'IN_SITU'];
const DEPARTAMENTOS_MENDOZA = [
  'Capital', 'Godoy Cruz', 'Guaymallen', 'Las Heras', 'Lujan de Cuyo',
  'Maipu', 'San Rafael', 'General Alvear', 'Junin', 'La Paz',
  'Lavalle', 'Malargue', 'Rivadavia', 'San Carlos', 'San Martin',
  'Santa Rosa', 'Tunuyan', 'Tupungato',
];

const INITIAL_FORM = {
  razonSocial: '', cuit: '', domicilio: '', telefono: '', email: '',
  password: '', nombre: '', numeroHabilitacion: '', categoria: '',
  tipoOperador: '', tecnologia: '', corrientesY: '',
  certificadoNumero: '', expedienteInscripcion: '',
  domicilioLegalCalle: '', domicilioLegalLocalidad: '', domicilioLegalDepto: '',
  domicilioRealCalle: '', domicilioRealLocalidad: '', domicilioRealDepto: '',
  domicilioRealIgual: true as boolean, coordenadas: '',
  representanteLegalNombre: '', representanteLegalDNI: '', representanteLegalTelefono: '',
  representanteTecnicoNombre: '', representanteTecnicoMatricula: '', representanteTecnicoTelefono: '',
  vencimientoHabilitacion: '', resolucionDPA: '',
};

function FieldError({ show, msg }: { show: boolean; msg: string }) {
  if (!show) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-error-600 mt-1">
      <AlertCircle size={12} /> {msg}
    </p>
  );
}

const NuevoOperadorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const isEdit = Boolean(id);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedY, setSelectedY] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [adjuntos, setAdjuntos] = useState<Record<string, File>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tefInputs, setTefInputs] = useState<TEFInputs | null>(null);

  const { data: existing, isLoading: loadingExisting } = useOperador(id || '');
  const createMutation = useCreateOperador();
  const updateMutation = useUpdateOperador();
  const uploadDocMutation = useUploadOperadorDocumento();

  const backPath = isMobile ? '/mobile/admin/actores/operadores' : '/admin/actores/operadores';

  useEffect(() => {
    if (!isEdit || !existing) return;
    const o = existing;
    // CSV enrichment fallback for fields not yet persisted in DB
    const csv = o.cuit ? (OPERADORES_DATA[o.cuit] || null) : null;

    setForm({
      razonSocial: o.razonSocial || '', cuit: o.cuit || '',
      domicilio: o.domicilio || '', telefono: o.telefono || csv?.telefono || '',
      email: o.email || o.usuario?.email || csv?.mail || '', password: '',
      nombre: o.usuario?.nombre || '', numeroHabilitacion: o.numeroHabilitacion || '',
      categoria: o.categoria || '',
      tipoOperador: o.tipoOperador || csv?.tipoOperador?.replace(/\s/g, '_').replace('/', '_') || '',
      tecnologia: o.tecnologia || csv?.tecnologia || '',
      corrientesY: o.corrientesY || (csv?.corrientes ? csv.corrientes.join(', ') : ''),
      certificadoNumero: o.certificadoNumero || csv?.certificado || '',
      expedienteInscripcion: o.expedienteInscripcion || csv?.expediente || '',
      domicilioLegalCalle: o.domicilioLegalCalle || csv?.domicilioLegal?.calle || '',
      domicilioLegalLocalidad: o.domicilioLegalLocalidad || csv?.domicilioLegal?.localidad || '',
      domicilioLegalDepto: o.domicilioLegalDepto || csv?.domicilioLegal?.departamento || '',
      domicilioRealCalle: o.domicilioRealCalle || csv?.domicilioReal?.calle || '',
      domicilioRealLocalidad: o.domicilioRealLocalidad || csv?.domicilioReal?.localidad || '',
      domicilioRealDepto: o.domicilioRealDepto || csv?.domicilioReal?.departamento || '',
      domicilioRealIgual: !(o.domicilioRealCalle || csv?.domicilioReal?.calle),
      coordenadas: o.latitud ? `${o.latitud}, ${o.longitud}` : '',
      representanteLegalNombre: o.representanteLegalNombre || '',
      representanteLegalDNI: o.representanteLegalDNI || '',
      representanteLegalTelefono: o.representanteLegalTelefono || '',
      representanteTecnicoNombre: o.representanteTecnicoNombre || '',
      representanteTecnicoMatricula: o.representanteTecnicoMatricula || '',
      representanteTecnicoTelefono: o.representanteTecnicoTelefono || '',
      vencimientoHabilitacion: o.vencimientoHabilitacion
        ? new Date(o.vencimientoHabilitacion).toISOString().split('T')[0]
        : '',
      resolucionDPA: o.resolucionDPA || '',
    });

    const corrientesStr = o.corrientesY || (csv?.corrientes ? csv.corrientes.join(', ') : '');
    if (corrientesStr) {
      setSelectedY(new Set(parseCorrientes(corrientesStr)));
    }

    if (o.tefInputs) {
      setTefInputs(o.tefInputs as unknown as TEFInputs);
    }
  }, [existing, isEdit]);

  const up = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const toggleY = (code: string) => {
    setSelectedY(prev => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  };

  const corrientesCodes = useMemo(() => Array.from(selectedY).sort(), [selectedY]);

  useEffect(() => { up('corrientesY', corrientesCodes.join(', ')); }, [corrientesCodes]);

  const getStepErrors = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      if (!form.razonSocial.trim()) errs.push('Razon Social es obligatoria');
      if (!form.cuit.trim()) errs.push('CUIT es obligatorio');
      if (!form.email.trim()) errs.push('Email es obligatorio');
    }
    if (s === 6 && !isEdit) {
      if (!form.password.trim()) errs.push('Password inicial es obligatorio');
    }
    return errs;
  };

  const stepHasErrors = (s: number) => getStepErrors(s).length > 0;

  const showError = (field: string) => {
    if (field === 'razonSocial') return attempted.has(1) && !form.razonSocial.trim();
    if (field === 'cuit') return attempted.has(1) && !form.cuit.trim();
    if (field === 'email') return attempted.has(1) && !form.email.trim();
    if (field === 'password') return attempted.has(6) && !isEdit && !form.password.trim();
    return false;
  };

  const goNext = () => {
    setAttempted(prev => new Set(prev).add(step));
    const errs = getStepErrors(step);
    if (errs.length > 0) {
      toast.error('Campos obligatorios', errs.join('. '));
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const goPrev = () => { if (step > 1) setStep(step - 1); };

  const goStep = (s: number) => {
    if (s < step) { setStep(s); return; }
    setAttempted(prev => new Set(prev).add(step));
    const errs = getStepErrors(step);
    if (errs.length > 0) { toast.error('Campos obligatorios', errs.join('. ')); return; }
    setStep(s);
  };

  const attachFile = (tipo: string, file: File) => {
    setAdjuntos(prev => ({ ...prev, [tipo]: file }));
    toast.success('Archivo adjuntado', `${file.name}`);
  };

  const removeFile = (tipo: string) => {
    setAdjuntos(prev => { const n = { ...prev }; delete n[tipo]; return n; });
  };

  const handleSubmit = async () => {
    for (const s of [1, 6]) {
      const errs = getStepErrors(s);
      if (errs.length > 0) {
        setAttempted(prev => new Set(prev).add(s));
        toast.error('Campos obligatorios', errs.join('. '));
        setStep(s);
        return;
      }
    }

    const domicilioPayload = {
      domicilioLegalCalle: form.domicilioLegalCalle || undefined,
      domicilioLegalLocalidad: form.domicilioLegalLocalidad || undefined,
      domicilioLegalDepto: form.domicilioLegalDepto || undefined,
      domicilioRealCalle: form.domicilioRealIgual
        ? form.domicilioLegalCalle || undefined
        : form.domicilioRealCalle || undefined,
      domicilioRealLocalidad: form.domicilioRealIgual
        ? form.domicilioLegalLocalidad || undefined
        : form.domicilioRealLocalidad || undefined,
      domicilioRealDepto: form.domicilioRealIgual
        ? form.domicilioLegalDepto || undefined
        : form.domicilioRealDepto || undefined,
    };

    // Parse coordenadas "lat, long" back to separate fields for backend
    const coordParts = form.coordenadas?.split(',').map(s => s.trim()).filter(Boolean);
    const latitud = coordParts?.[0] ? Number(coordParts[0]) : undefined;
    const longitud = coordParts?.[1] ? Number(coordParts[1]) : undefined;

    const extra: Record<string, any> = {
      tipoOperador: form.tipoOperador || undefined,
      tecnologia: form.tecnologia || undefined,
      corrientesY: corrientesCodes.join(', ') || undefined,
      certificadoNumero: form.certificadoNumero || undefined,
      expedienteInscripcion: form.expedienteInscripcion || undefined,
      resolucionDPA: form.resolucionDPA || undefined,
      vencimientoHabilitacion: form.vencimientoHabilitacion || undefined,
      ...(latitud && longitud && !isNaN(latitud) && !isNaN(longitud) ? { latitud, longitud } : {}),
      ...(tefInputs && { tefInputs }),
      representanteLegalNombre: form.representanteLegalNombre || undefined,
      representanteLegalDNI: form.representanteLegalDNI || undefined,
      representanteLegalTelefono: form.representanteLegalTelefono || undefined,
      representanteTecnicoNombre: form.representanteTecnicoNombre || undefined,
      representanteTecnicoMatricula: form.representanteTecnicoMatricula || undefined,
      representanteTecnicoTelefono: form.representanteTecnicoTelefono || undefined,
      ...domicilioPayload,
    };

    setSubmitError(null);
    try {
      let operadorId: string | undefined;

      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            razonSocial: form.razonSocial, cuit: form.cuit,
            domicilio: form.domicilio || form.domicilioLegalCalle,
            telefono: form.telefono, email: form.email,
            numeroHabilitacion: form.numeroHabilitacion,
            categoria: form.categoria,
            ...extra,
          } as Partial<CreateOperadorRequest>,
        });
        operadorId = id;
        toast.success('Guardado', `Operador ${form.razonSocial} actualizado`);
      } else {
        const result = await createMutation.mutateAsync({
          email: form.email, password: form.password,
          nombre: form.nombre || form.razonSocial,
          razonSocial: form.razonSocial, cuit: form.cuit,
          domicilio: form.domicilio || form.domicilioLegalCalle,
          telefono: form.telefono,
          numeroHabilitacion: form.numeroHabilitacion,
          categoria: form.categoria,
          ...extra,
        } as CreateOperadorRequest);
        const resultObj = result as Operador & { operador?: { id: string } };
        operadorId = resultObj?.operador?.id || resultObj?.id;
        toast.success('Operador creado', `${form.razonSocial} registrado exitosamente`);
      }

      const filesToUpload = Object.entries(adjuntos);
      if (operadorId && filesToUpload.length > 0) {
        let uploaded = 0;
        for (const [tipo, file] of filesToUpload) {
          try {
            await uploadDocMutation.mutateAsync({ operadorId, file, tipo });
            uploaded++;
          } catch (uploadErr: any) {
            console.error('Upload error:', uploadErr);
            toast.error('Error subiendo', `No se pudo subir ${file.name}: ${uploadErr?.response?.data?.message || 'Error'}`);
          }
        }
        if (uploaded > 0) {
          toast.success('Documentos adjuntados', `${uploaded} archivo(s) subido(s)`);
        }
      }

      navigate(backPath);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error desconocido al guardar';
      console.error('Submit error:', err);
      setSubmitError(msg);
      toast.add({ type: 'error', title: 'Error al guardar', message: msg, duration: 15000 });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || uploadDocMutation.isPending;

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto">
        <Card className="py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-neutral-500">Cargando operador...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl"><FlaskConical size={22} className="text-blue-600" /></div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">{isEdit ? 'Editar Operador' : 'Registro Provincial de Operadores de RRPP'}</h2>
            <p className="text-sm text-neutral-500">Ley 24.051, Ley Provincial 5917, Decreto 2625/99</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            const hasErr = attempted.has(s.id) && stepHasErrors(s.id);
            return (
              <React.Fragment key={s.id}>
                <button onClick={() => goStep(s.id)} className={`flex flex-col items-center gap-1.5 group transition-all ${isActive ? 'scale-105' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    hasErr ? 'bg-error-100 text-error-600 ring-2 ring-error-300' :
                    isActive ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' :
                    isDone ? 'bg-primary-100 text-primary-700' :
                    'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'
                  }`}>
                    {hasErr ? <AlertCircle size={18} /> : isDone ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[60px] ${
                    hasErr ? 'text-error-600' : isActive ? 'text-primary-700' : isDone ? 'text-primary-600' : 'text-neutral-400'
                  }`}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.id ? 'bg-primary-400' : 'bg-neutral-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">

        {/* ===== PASO 1: Identificacion ===== */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical size={20} className="text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900">Identificacion y Contacto</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input label="Razon Social *" value={form.razonSocial} onChange={e => up('razonSocial', e.target.value)} placeholder="Planta de Tratamiento S.A."
                    className={showError('razonSocial') ? 'border-error-400 bg-error-50' : ''} />
                  <FieldError show={showError('razonSocial')} msg="La razon social es obligatoria" />
                </div>
                <div>
                  <Input label="CUIT *" value={form.cuit} onChange={e => up('cuit', e.target.value)} placeholder="30-12345678-9"
                    className={showError('cuit') ? 'border-error-400 bg-error-50' : ''} />
                  <FieldError show={showError('cuit')} msg="El CUIT es obligatorio" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input label="Email *" type="email" value={form.email} onChange={e => up('email', e.target.value)} placeholder="contacto@operador.com"
                    className={showError('email') ? 'border-error-400 bg-error-50' : ''} />
                  <FieldError show={showError('email')} msg="El email es obligatorio" />
                </div>
                <Input label="Telefono" value={form.telefono} onChange={e => up('telefono', e.target.value)} placeholder="+54 261 4XX-XXXX" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de Operador</label>
                  <select value={form.tipoOperador} onChange={e => up('tipoOperador', e.target.value)} className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white">
                    <option value="">Seleccionar...</option>
                    {TIPO_OPERADOR.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => up('categoria', e.target.value)} className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white">
                    <option value="">Seleccionar...</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="N Habilitacion DPA" value={form.numeroHabilitacion} onChange={e => up('numeroHabilitacion', e.target.value)} placeholder="O-000XXX" />
                <Input label="N Certificado" value={form.certificadoNumero} onChange={e => up('certificadoNumero', e.target.value)} placeholder="CERT-2024-XXX" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== PASO 2: Domicilios ===== */}
        {step === 2 && (
          <div className="space-y-6">
            {form.tipoOperador === 'IN_SITU' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Operador In Situ</p>
                  <p className="text-xs text-amber-700 mt-1">Los operadores In Situ trabajan en la ubicacion del generador. La Direccion Real corresponde a la sede administrativa.</p>
                </div>
              </div>
            )}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 size={20} className="text-info-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Direccion Fiscal</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Calle / Ruta" value={form.domicilioLegalCalle} onChange={e => up('domicilioLegalCalle', e.target.value)} placeholder="Av. San Martin 1234" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Localidad" value={form.domicilioLegalLocalidad} onChange={e => up('domicilioLegalLocalidad', e.target.value)} placeholder="Ciudad de Mendoza" />
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Departamento</label>
                    <select value={form.domicilioLegalDepto} onChange={e => up('domicilioLegalDepto', e.target.value)} className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white">
                      <option value="">Seleccionar...</option>
                      {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <MapPin size={20} className="text-warning-600" />
                    <h3 className="text-lg font-bold text-neutral-900">Direccion Real (Planta)</h3>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-neutral-500 cursor-pointer">
                    <input type="checkbox" checked={form.domicilioRealIgual} onChange={e => up('domicilioRealIgual', e.target.checked)} className="rounded border-neutral-300 text-primary-600" />
                    Igual a la fiscal
                  </label>
                </div>
              </CardHeader>
              {!form.domicilioRealIgual && (
                <CardContent className="space-y-4">
                  <Input label="Calle / Ruta" value={form.domicilioRealCalle} onChange={e => up('domicilioRealCalle', e.target.value)} placeholder="Ruta 40 km 3200" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Localidad" value={form.domicilioRealLocalidad} onChange={e => up('domicilioRealLocalidad', e.target.value)} placeholder="Lujan de Cuyo" />
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Departamento</label>
                      <select value={form.domicilioRealDepto} onChange={e => up('domicilioRealDepto', e.target.value)} className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white">
                        <option value="">Seleccionar...</option>
                        {DEPARTAMENTOS_MENDOZA.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <Input label="Coordenadas Geograficas" value={form.coordenadas} onChange={e => up('coordenadas', e.target.value)} placeholder="lat -32.89, long -68.83" />
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* ===== PASO 3: Representantes ===== */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Representante Legal</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre y Apellido" value={form.representanteLegalNombre} onChange={e => up('representanteLegalNombre', e.target.value)} placeholder="Juan Perez" />
                  <Input label="DNI" value={form.representanteLegalDNI} onChange={e => up('representanteLegalDNI', e.target.value)} placeholder="28.345.678" />
                </div>
                <div className="max-w-xs">
                  <Input label="Telefono" value={form.representanteLegalTelefono} onChange={e => up('representanteLegalTelefono', e.target.value)} placeholder="+54 261 4XX-XXXX" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-info-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Representante Tecnico</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre y Apellido" value={form.representanteTecnicoNombre} onChange={e => up('representanteTecnicoNombre', e.target.value)} placeholder="Maria Lopez" />
                  <Input label="Matricula Profesional" value={form.representanteTecnicoMatricula} onChange={e => up('representanteTecnicoMatricula', e.target.value)} placeholder="IQ-1234" />
                </div>
                <div className="max-w-xs">
                  <Input label="Telefono" value={form.representanteTecnicoTelefono} onChange={e => up('representanteTecnicoTelefono', e.target.value)} placeholder="+54 261 4XX-XXXX" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== PASO 4: Residuos ===== */}
        {step === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Biohazard size={20} className="text-warning-600" />
                    <h3 className="text-lg font-bold text-neutral-900">Categorias de Residuos (Corrientes Y)</h3>
                  </div>
                  <Badge variant="soft" color="warning">{selectedY.size} seleccionadas</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-500 mb-4">Seleccione las corrientes de residuos peligrosos que el operador esta habilitado para tratar (Convenio de Basilea, Ley 24.051)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {CORRIENTES_Y_CODES.map(code => {
                    const checked = selectedY.has(code);
                    const cVal = C_CORRIENTES[code] || 0;
                    return (
                      <label key={code} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-primary-400 bg-primary-50/50 shadow-sm' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleY(code)} className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${checked ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-neutral-100 text-neutral-600'}`}>{code}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">C={cVal}</span>
                          </div>
                          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{CORRIENTES_Y[code]}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FlaskConical size={20} className="text-blue-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Tecnologia de Tratamiento</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-500 mb-3">Describa los procesos y tecnologias utilizados para el tratamiento de residuos peligrosos.</p>
                <textarea
                  value={form.tecnologia}
                  onChange={e => up('tecnologia', e.target.value)}
                  rows={4}
                  placeholder="Ej: Incineracion a alta temperatura (1200°C), tratamiento fisicoquimico, encapsulamiento en tambores sellados..."
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white resize-none"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== PASO 5: Calculo TEF ===== */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator size={20} className="text-primary-600" />
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Calculo de la T.E.F.</h3>
                  <p className="text-xs text-neutral-500">Decreto Reglamentario 2625/99 — Ley Provincial 5917</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CalculadoraTEF corrientesY={corrientesCodes} tieneISO={false} inline initialInputs={tefInputs} onInputsChange={setTefInputs} />
            </CardContent>
          </Card>
        )}

        {/* ===== PASO 6: Regulatorio y Acceso ===== */}
        {step === 6 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList size={20} className="text-primary-600" />
                  <h3 className="text-lg font-bold text-neutral-900">Datos Regulatorios</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Expediente Inscripcion" value={form.expedienteInscripcion} onChange={e => up('expedienteInscripcion', e.target.value)} placeholder="EX-2024-XXXXX" />
                  <Input label="Resolucion DPA" value={form.resolucionDPA} onChange={e => up('resolucionDPA', e.target.value)} placeholder="DPA-0412/2024" />
                </div>
                <div className="max-w-xs">
                  <Input label="Vencimiento Habilitacion" type="date" value={form.vencimientoHabilitacion} onChange={e => up('vencimientoHabilitacion', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {!isEdit && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lock size={20} className="text-neutral-500" />
                    <h3 className="text-lg font-bold text-neutral-900">Acceso al Sistema</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Nombre del Responsable" value={form.nombre} onChange={e => up('nombre', e.target.value)} placeholder="Juan Perez" />
                    <div>
                      <Input label="Password Inicial *" type="password" value={form.password} onChange={e => up('password', e.target.value)} placeholder="Minimo 8 caracteres"
                        className={showError('password') ? 'border-error-400 bg-error-50' : ''} />
                      <FieldError show={showError('password')} msg="El password es obligatorio para crear el operador" />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">El responsable podra cambiar su contrasena desde su perfil al ingresar.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ===== PASO 7: Adjuntos y Confirmar ===== */}
        {step === 7 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Upload size={20} className="text-primary-600" />
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">Archivos Adjuntos al Formulario</h3>
                    <p className="text-xs text-neutral-500">Tamano max. 10MB por archivo (PDF, JPG, PNG)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Nombre</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 w-20">Oblig.</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 w-48">Archivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {DOCUMENTOS_REQUERIDOS.map(doc => {
                        const file = adjuntos[doc.tipo];
                        return (
                          <tr key={doc.tipo} className="hover:bg-neutral-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-neutral-900 text-xs uppercase">{doc.nombre}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {doc.obligatorio ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded border-2 border-primary-500 bg-primary-50">
                                  <Check size={12} className="text-primary-600" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded border-2 border-neutral-300" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {file ? (
                                <div className="inline-flex items-center gap-2 px-2 py-1 bg-success-50 border border-success-200 rounded-lg">
                                  <Paperclip size={12} className="text-success-600" />
                                  <span className="text-xs text-success-700 truncate max-w-[100px]">{file.name}</span>
                                  <button onClick={() => removeFile(doc.tipo)} className="text-neutral-400 hover:text-error-600"><X size={14} /></button>
                                </div>
                              ) : (
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-primary-50 border border-neutral-200 hover:border-primary-300 rounded-lg cursor-pointer transition-colors text-xs font-medium text-neutral-700 hover:text-primary-700">
                                  <Upload size={14} />
                                  Subir
                                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(doc.tipo, f); e.target.value = ''; }}
                                  />
                                </label>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {Object.keys(adjuntos).length > 0 && (
                  <p className="text-xs text-success-600 mt-3">{Object.keys(adjuntos).length} archivo(s) listos para adjuntar al confirmar</p>
                )}
              </CardContent>
            </Card>

            {/* Resumen */}
            <Card className="border-primary-200 bg-primary-50/30">
              <CardHeader><h3 className="text-lg font-bold text-neutral-900">Resumen del Registro</h3></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-neutral-500 text-xs">Razon Social</p><p className="font-medium text-neutral-900">{form.razonSocial || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">CUIT</p><p className="font-medium font-mono text-neutral-900">{form.cuit || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">Categoria</p><p className="font-medium text-neutral-900">{form.categoria || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">Tipo</p><p className="font-medium text-neutral-900">{form.tipoOperador || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">Domicilio</p><p className="font-medium text-neutral-900">{form.domicilioLegalCalle || form.domicilio || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">Departamento</p><p className="font-medium text-neutral-900">{form.domicilioLegalDepto || '-'}</p></div>
                  <div><p className="text-neutral-500 text-xs">Corrientes Y</p><p className="font-medium text-neutral-900">{selectedY.size} seleccionadas</p></div>
                  <div><p className="text-neutral-500 text-xs">Adjuntos</p><p className="font-medium text-neutral-900">{Object.keys(adjuntos).length} archivos</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="bg-error-50 border-2 border-error-300 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-error-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-error-800">No se pudo guardar el operador</p>
            <p className="text-sm text-error-700 mt-1">{submitError}</p>
          </div>
          <button onClick={() => setSubmitError(null)} className="text-error-400 hover:text-error-600"><X size={18} /></button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={step === 1 ? () => navigate(backPath) : goPrev}>
          {step === 1 ? 'Cancelar' : 'Volver'}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Paso {step} de {TOTAL_STEPS}</span>
          {step < TOTAL_STEPS ? (
            <Button rightIcon={<ArrowRight size={16} />} onClick={goNext}>Continuar</Button>
          ) : (
            <Button
              leftIcon={isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Confirmar Registro'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NuevoOperadorPage;

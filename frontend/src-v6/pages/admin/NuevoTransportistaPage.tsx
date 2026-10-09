/**
 * SITREP v6 - NuevoTransportistaPage
 * ===================================
 * Wizard para crear/editar transportistas con todos los campos DPA + vehiculos + choferes
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Truck, MapPin, Shield,
  Plus, Trash2, Loader2, Car, User,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { MobileFormSteps } from '../../components/MobileFormSteps';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { initialPasswordError, vehicleCapacityError } from '../../utils/actorCreationValidation';
import { toast } from '../../components/ui/Toast';
import DocumentUpload from '../../components/DocumentUpload';
import { useActorRegistrationDraft } from '../../hooks/useActorRegistrationDraft';
import { ActorRegistrationDraftBar } from '../../components/ActorRegistrationDraftBar';
import { ActorRegistryLookup } from '../../components/ActorRegistryLookup';
import { restoreRegistrationForm } from '../../services/registrationDraft';
import { generadorFiscalService, transportistaDocumentoService, type Documento } from '../../services/generador-fiscal.service';
import {
  useTransportista,
  useCreateTransportista,
  useUpdateTransportista,
} from '../../hooks/useActores';

interface VehiculoForm {
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  capacidad: string;
  numeroHabilitacion: string;
  vencimiento: string;
}

interface ChoferForm {
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  vencimiento: string;
  telefono: string;
}

const EMPTY_VEHICULO: VehiculoForm = { patente: '', marca: '', modelo: '', anio: '', capacidad: '', numeroHabilitacion: '', vencimiento: '' };
const EMPTY_CHOFER: ChoferForm = { nombre: '', apellido: '', dni: '', licencia: '', vencimiento: '', telefono: '' };
const INITIAL_FORM = {
  razonSocial: '', cuit: '', domicilio: '', localidad: '', telefono: '', email: '', password: '', nombre: '',
  numeroHabilitacion: '', vencimientoHabilitacion: '', coordenadas: '', corrientesAutorizadas: '', expedienteDPA: '',
  resolucionDPA: '', resolucionSSP: '', actaInspeccion: '', actaInspeccion2: '',
};

const STEPS = [
  { id: 1, label: 'Datos Basicos', icon: Truck },
  { id: 2, label: 'Habilitacion DPA', icon: Shield },
  { id: 3, label: 'Vehiculos', icon: Car },
  { id: 4, label: 'Choferes', icon: User },
  { id: 5, label: 'Confirmar', icon: Check },
];

const NuevoTransportistaPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const isEdit = !!id;

  const { data: existing, isLoading: loadingExisting, refetch: reloadExisting } = useTransportista(isEdit ? id! : '');
  const initializedActor = useRef<string | null>(null);
  const createMutation = useCreateTransportista();
  const updateMutation = useUpdateTransportista();

  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const submitInFlight = useRef(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [vehiculos, setVehiculos] = useState<VehiculoForm[]>([]);
  const [choferes, setChoferes] = useState<ChoferForm[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<Record<string, { file: File; anio?: number }>>({});
  const [savedDocuments, setSavedDocuments] = useState<Documento[]>([]);
  const [savedActorId, setSavedActorId] = useState<string | null>(null);
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const draftData = { form, step, vehiculos, choferes, savedActorId, files: [...missingFiles, ...Object.values(pendingDocuments).map(value => value.file.name)] };
  const draft = useActorRegistrationDraft('TRANSPORTISTA', id, draftData, data => {
    setPendingDocuments({}); setDocumentError(null);
    setForm(restoreRegistrationForm(INITIAL_FORM, data.form));
    setVehiculos(Array.isArray(data.vehiculos) ? data.vehiculos.map(value => restoreRegistrationForm(EMPTY_VEHICULO, value)) : []);
    setChoferes(Array.isArray(data.choferes) ? data.choferes.map(value => restoreRegistrationForm(EMPTY_CHOFER, value)) : []);
    setSavedActorId(typeof data.savedActorId === 'string' ? data.savedActorId : null);
    setSavedDocuments(Array.isArray(data.savedDocuments) ? data.savedDocuments : []);
    setStep(data.savedActorId ? STEPS.length : Math.min(STEPS.length, Math.max(1, Number(data.step) || 1)));
    setMissingFiles(Array.isArray(data.files) ? data.files.filter(name => typeof name === 'string') : []);
  }, JSON.stringify(form) !== JSON.stringify(INITIAL_FORM) || vehiculos.length > 0 || choferes.length > 0 || Boolean(savedActorId));

  useEffect(() => {
    initializedActor.current = null; setForm(INITIAL_FORM); setStep(1); setVehiculos([]); setChoferes([]);
    setPendingDocuments({}); setSavedActorId(null); setSavedDocuments([]); setMissingFiles([]);
  }, [id, draft.owner]);

  useEffect(() => {
    if (!isEdit || !existing || existing.id !== id || initializedActor.current === id) return;
    initializedActor.current = id!;
    const t = existing;
    setForm({
      razonSocial: t.razonSocial || '', cuit: t.cuit || '',
      domicilio: t.domicilio || '', localidad: t.localidad || '',
      telefono: t.telefono || '', email: t.email || t.usuario?.email || '',
      password: '', nombre: t.usuario?.nombre || '',
      numeroHabilitacion: t.numeroHabilitacion || '',
      vencimientoHabilitacion: t.vencimientoHabilitacion ? new Date(t.vencimientoHabilitacion).toISOString().split('T')[0] : '',
      coordenadas: t.latitud != null && t.longitud != null ? `${t.latitud}, ${t.longitud}` : '',
      corrientesAutorizadas: t.corrientesAutorizadas || '',
      expedienteDPA: t.expedienteDPA || '',
      resolucionDPA: t.resolucionDPA || '',
      resolucionSSP: t.resolucionSSP || '',
      actaInspeccion: t.actaInspeccion || '',
      actaInspeccion2: t.actaInspeccion2 || '',
    });
    if (Array.isArray(t.vehiculos)) {
      setVehiculos(t.vehiculos.map((v: any) => ({
        patente: v.patente || '', marca: v.marca || '', modelo: v.modelo || '',
        anio: v.anio ? String(v.anio) : '', capacidad: v.capacidad != null ? String(v.capacidad) : '',
        numeroHabilitacion: v.numeroHabilitacion || '',
        vencimiento: v.vencimiento ? new Date(v.vencimiento).toISOString().split('T')[0] : '',
      })));
    }
    if (Array.isArray(t.choferes)) {
      setChoferes(t.choferes.map((c: any) => ({
        nombre: c.nombre || '', apellido: c.apellido || '', dni: c.dni || '',
        licencia: c.licencia || '',
        vencimiento: c.vencimiento ? new Date(c.vencimiento).toISOString().split('T')[0] : '',
        telefono: c.telefono || '',
      })));
    }
  }, [existing, isEdit, id, draft.owner]);

  const up = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const passwordError = initialPasswordError(form.password, form.cuit);
  const getStepErrors = (s: number) => {
    const errors: string[] = [];
    if (s === 1) {
      if (!form.razonSocial.trim()) errors.push('Razon Social es obligatoria');
      if (!form.cuit.trim()) errors.push('CUIT es obligatorio');
      if (!form.email.trim()) errors.push('Email es obligatorio');
      if (!isEdit && passwordError) errors.push(passwordError);
    }
    if (s === 3 && !isEdit) vehiculos.forEach((vehicle, i) => {
      if (!vehicle.patente.trim()) errors.push(`Vehículo ${i + 1}: la patente es obligatoria`);
      const error = vehicleCapacityError(vehicle.capacidad);
      if (error) errors.push(`Vehículo ${i + 1}: ${error}`);
      if (!vehicle.anio.trim() || !Number.isInteger(Number(vehicle.anio))) errors.push(`Vehículo ${i + 1}: el año debe ser un número entero`);
      if (!vehicle.vencimiento || !Number.isFinite(Date.parse(vehicle.vencimiento))) errors.push(`Vehículo ${i + 1}: indicá el vencimiento`);
    });
    if (s === 4 && !isEdit) choferes.forEach((driver, i) => {
      if (!driver.nombre.trim()) errors.push(`Chofer ${i + 1}: el nombre es obligatorio`);
      if (!driver.dni.trim()) errors.push(`Chofer ${i + 1}: el DNI es obligatorio`);
      if (!driver.vencimiento || !Number.isFinite(Date.parse(driver.vencimiento))) errors.push(`Chofer ${i + 1}: indicá el vencimiento`);
    });
    return errors;
  };
  const validateStep = (s: number) => {
    setAttempted(previous => new Set(previous).add(s));
    const errors = getStepErrors(s);
    if (!errors.length) return true;
    setStep(s);
    return false;
  };
  const goStep = (next: number) => {
    if (submitInFlight.current) return;
    if (next <= step || validateStep(step)) setStep(next);
  };

  const parseCoords = (coords: string) => {
    const parts = coords?.split(',').map(s => s.trim()).filter(Boolean);
    const lat = parts?.[0] ? Number(parts[0]) : undefined;
    const lng = parts?.[1] ? Number(parts[1]) : undefined;
    return lat && lng && !isNaN(lat) && !isNaN(lng) ? { latitud: lat, longitud: lng } : {};
  };

  const handleSubmit = async () => {
    if (submitInFlight.current) return;
    if (!savedActorId && ![1, 3, 4].every(validateStep)) return;

    const payload: any = {
      razonSocial: form.razonSocial, cuit: form.cuit,
      domicilio: form.domicilio, localidad: form.localidad || undefined,
      telefono: form.telefono, email: form.email,
      numeroHabilitacion: form.numeroHabilitacion,
      vencimientoHabilitacion: form.vencimientoHabilitacion || undefined,
      ...parseCoords(form.coordenadas),
      corrientesAutorizadas: form.corrientesAutorizadas || undefined,
      expedienteDPA: form.expedienteDPA || undefined,
      resolucionDPA: form.resolucionDPA || undefined,
      resolucionSSP: form.resolucionSSP || undefined,
      actaInspeccion: form.actaInspeccion || undefined,
      actaInspeccion2: form.actaInspeccion2 || undefined,
    };

    if (!isEdit) {
      payload.password = form.password;
      payload.nombre = form.nombre || form.razonSocial;
      // Include vehiculos and choferes on create
      if (vehiculos.length > 0) {
        payload.vehiculos = vehiculos.map(v => ({
          patente: v.patente, marca: v.marca, modelo: v.modelo,
          anio: Number(v.anio),
          capacidad: Number(v.capacidad),
          numeroHabilitacion: v.numeroHabilitacion,
          vencimiento: v.vencimiento,
        }));
      }
      if (choferes.length > 0) {
        payload.choferes = choferes.map(c => ({
          nombre: c.nombre, apellido: c.apellido || '',
          dni: c.dni, licencia: c.licencia || '',
          vencimiento: c.vencimiento,
          telefono: c.telefono || '',
        }));
      }
    }

    submitInFlight.current = true;
    setSavingDocuments(true);
    setDocumentError(null);
    try {
      draft.assertSession();
      let actorId = savedActorId || id;
      if (!savedActorId && isEdit && id) {
        await updateMutation.mutateAsync({ id, data: payload });
        toast.success('Actualizado', `Transportista ${form.razonSocial} actualizado`);
      } else if (!savedActorId) {
        const created = await createMutation.mutateAsync(payload);
        actorId = created.id;
        toast.success('Creado', `Transportista ${form.razonSocial} creado`);
      }
      if (!actorId) throw new Error('El servidor no devolvió el identificador del transportista.');
      draft.assertSession();
      setSavedActorId(actorId);
      draft.checkpoint({ ...draftData, savedActorId: actorId });
      const failed: string[] = [];
      for (const [tipo, selection] of Object.entries(pendingDocuments)) {
        try {
          draft.assertSession();
          const saved = await transportistaDocumentoService.upload(actorId, selection.file, tipo, selection.anio);
          draft.assertSession();
          setSavedDocuments(previous => [...previous, saved]);
          setPendingDocuments(previous => { const next = { ...previous }; delete next[tipo]; return next; });
          if (saved.analisis?.duplicado) toast.warning('Comprobante repetido', 'La huella coincide con un recibo ya cargado. No acredita un pago nuevo.');
        } catch { failed.push(selection.file.name); }
      }
      if (failed.length) {
        setDocumentError(`Transportista guardado. Quedan adjuntos pendientes: ${failed.join(', ')}. Reintentá sin repetir el alta.`);
        return;
      }
      draft.clear(); navigate(mp('/admin/actores/transportistas'));
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo guardar');
    } finally {
      submitInFlight.current = false;
      setSavingDocuments(false);
    }
  };

  const isPending = savingDocuments || createMutation.isPending || updateMutation.isPending;
  const backPath = mp('/admin/actores/transportistas');
  if (isEdit && loadingExisting) return <p role="status" className="p-6 text-neutral-700">Recuperando la ficha del transportista…</p>;
  if (isEdit && (!existing || existing.id !== id)) return <div role="alert" className="rounded-xl border border-error-200 bg-error-50 p-4 text-error-800"><p>No se pudo verificar la ficha del transportista. No editaremos campos vacíos ni datos de otra ficha.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void reloadExisting()}>Reintentar carga</Button><Button variant="outline" onClick={() => navigate(backPath)}>Volver al padrón</Button></div></div>;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
          Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-xl">
            <Truck size={22} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{isEdit ? 'Editar' : 'Nuevo'} Transportista</h2>
            <p className="hidden md:block text-xs text-neutral-500">Paso {step} de {STEPS.length}</p>
          </div>
        </div>
      </div>

      <ActorRegistrationDraftBar draft={draft} />
      {missingFiles.length > 0 && <p role="alert" className="text-sm text-amber-900">Volvé a seleccionar los archivos pendientes: {missingFiles.join(', ')}. No estaban subidos a SITREP.</p>}

      {/* Stepper */}
      <MobileFormSteps steps={STEPS} currentStep={step} onSelect={goStep} />
      <div className="hidden md:flex items-center justify-between bg-white rounded-2xl border border-neutral-200 p-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <React.Fragment key={s.id}>
              <button aria-label={`${s.id}. ${s.label}`} aria-current={isActive ? 'step' : undefined} onClick={() => goStep(s.id)} disabled={isPending} className="flex min-h-11 min-w-11 flex-col items-center gap-1.5 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isActive ? 'bg-orange-700 text-white' :
                  isDone ? 'bg-orange-100 text-orange-600' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${
                  isActive ? 'text-orange-700' : isDone ? 'text-orange-700' : 'text-neutral-600'
                }`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.id ? 'bg-orange-300' : 'bg-neutral-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="p-6 min-h-[360px]">
        <fieldset className="min-w-0" disabled={isPending || Boolean(draft.available) || (Boolean(savedActorId) && step !== 5)}>
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Truck size={20} className="text-orange-600" /> Datos Basicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Razon Social *" value={form.razonSocial} onChange={e => up('razonSocial', e.target.value)} errorMessage={attempted.has(1) && !form.razonSocial.trim() ? 'La razón social es obligatoria' : undefined} placeholder="Transporte S.A." />
              <Input label="CUIT *" value={form.cuit} onChange={e => up('cuit', e.target.value)} errorMessage={attempted.has(1) && !form.cuit.trim() ? 'El CUIT es obligatorio' : undefined} placeholder="30-12345678-9" />
            </div>
            {!isEdit && !savedActorId && <ActorRegistryLookup type="TRANSPORTISTA" cuit={form.cuit} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Email *" type="email" value={form.email} onChange={e => up('email', e.target.value)} errorMessage={attempted.has(1) && !form.email.trim() ? 'El email es obligatorio' : undefined} placeholder="contacto@empresa.com" />
              <Input label="Telefono" value={form.telefono} onChange={e => up('telefono', e.target.value)} placeholder="+54 261 ..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Domicilio" value={form.domicilio} onChange={e => up('domicilio', e.target.value)} placeholder="Av. Libertador 1234" />
              <Input label="Localidad" value={form.localidad} onChange={e => up('localidad', e.target.value)} placeholder="Godoy Cruz, Mendoza" />
            </div>
            <Input label="Coordenadas" value={form.coordenadas} onChange={e => up('coordenadas', e.target.value)} placeholder="-32.89, -68.83" />
            {!isEdit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nombre Responsable" value={form.nombre} onChange={e => up('nombre', e.target.value)} placeholder="Juan Perez" />
                <Input label="Contraseña inicial *" type="password" autoComplete="new-password" value={form.password} onChange={e => up('password', e.target.value)} errorMessage={attempted.has(1) ? passwordError : undefined} helperText="Al menos 8 caracteres. No uses el CUIT." placeholder="Ingresá una contraseña" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Shield size={20} className="text-orange-600" /> Habilitacion DPA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="N Habilitacion" value={form.numeroHabilitacion} onChange={e => up('numeroHabilitacion', e.target.value)} placeholder="HAB-TR-XXXX" />
              <Input label="Vencimiento Habilitacion" type="date" value={form.vencimientoHabilitacion} onChange={e => up('vencimientoHabilitacion', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Expediente DPA" value={form.expedienteDPA} onChange={e => up('expedienteDPA', e.target.value)} placeholder="EXP-DPA-XXXX" />
              <Input label="Resolucion DPA" value={form.resolucionDPA} onChange={e => up('resolucionDPA', e.target.value)} placeholder="0359/24" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Resolucion SSP" value={form.resolucionSSP} onChange={e => up('resolucionSSP', e.target.value)} placeholder="SSP-XXXX" />
              <Input label="Corrientes Autorizadas" value={form.corrientesAutorizadas} onChange={e => up('corrientesAutorizadas', e.target.value)} placeholder="Y4, Y8, Y9" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Acta Inspeccion" value={form.actaInspeccion} onChange={e => up('actaInspeccion', e.target.value)} placeholder="rp-g000040" />
              <Input label="Acta Inspeccion 2" value={form.actaInspeccion2} onChange={e => up('actaInspeccion2', e.target.value)} placeholder="" />
            </div>
          </div>
        )}

        {step === 3 && (isEdit ? (
          <section className="space-y-4" aria-label="Vehículos registrados">
            <h3 className="text-lg font-bold text-neutral-900">Vehículos registrados</h3>
            <p className="text-sm text-neutral-700">Esta edición guarda los datos del transportista, no su flota. Los vehículos y choferes se administran desde la pestaña Flota y Conductores de su ficha.</p>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-primary-700 px-4 font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" to={mp('/admin/actores/transportistas/' + id)} target="_blank" rel="noopener noreferrer">Administrar flota (nueva pestaña)</Link>
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {vehiculos.map((item, i) => <li key={i} className="p-4 text-sm text-neutral-900">{item.patente} — {item.marca} {item.modelo} · {item.capacidad || '—'} kg</li>)}
            </ul>
            {vehiculos.length === 0 && <p className="text-sm text-neutral-600">Sin vehículos registrados.</p>}
          </section>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Car size={20} className="text-orange-600" /> Vehiculos</h3>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setVehiculos(prev => [...prev, { ...EMPTY_VEHICULO }])}>
                Agregar
              </Button>
            </div>
            {vehiculos.length === 0 && (
              <p className="text-sm text-neutral-400 py-8 text-center">No hay vehiculos registrados. Presione "Agregar" para incluir uno.</p>
            )}
            {vehiculos.map((v, i) => (
              <div key={i} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">Vehiculo {i + 1}</span>
                  <button onClick={() => setVehiculos(prev => prev.filter((_, j) => j !== i))} aria-label={`Quitar vehículo ${i + 1}`} type="button" className="min-h-11 min-w-11 inline-flex items-center justify-center text-error-700 hover:bg-error-50 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-error-700">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Patente *" value={v.patente} errorMessage={!isEdit && attempted.has(3) && !v.patente.trim() ? 'La patente es obligatoria' : undefined} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], patente: e.target.value }; setVehiculos(nv); }} placeholder="AB123CD" />
                  <Input label="Marca" value={v.marca} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], marca: e.target.value }; setVehiculos(nv); }} placeholder="Mercedes" />
                  <Input label="Modelo" value={v.modelo} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], modelo: e.target.value }; setVehiculos(nv); }} placeholder="Atego 1726" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Ano *" type="number" step="1" value={v.anio} errorMessage={!isEdit && attempted.has(3) && (!v.anio.trim() || !Number.isInteger(Number(v.anio))) ? 'El año debe ser un número entero' : undefined} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], anio: e.target.value }; setVehiculos(nv); }} placeholder="2024" />
                  <Input label="Capacidad (kg) *" type="number" min="0" step="any" inputMode="decimal" value={v.capacidad} errorMessage={!isEdit && attempted.has(3) ? vehicleCapacityError(v.capacidad) : undefined} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], capacidad: e.target.value }; setVehiculos(nv); }} placeholder="10000" />
                  <Input label="Habilitacion" value={v.numeroHabilitacion} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], numeroHabilitacion: e.target.value }; setVehiculos(nv); }} placeholder="VEH-XXXX" />
                  <Input label="Vencimiento *" type="date" value={v.vencimiento} errorMessage={!isEdit && attempted.has(3) && (!v.vencimiento || !Number.isFinite(Date.parse(v.vencimiento))) ? 'Indicá el vencimiento' : undefined} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], vencimiento: e.target.value }; setVehiculos(nv); }} />
                </div>
              </div>
            ))}
          </div>
        ))}

        {step === 4 && (isEdit ? (
          <section className="space-y-4" aria-label="Choferes registrados">
            <h3 className="text-lg font-bold text-neutral-900">Choferes registrados</h3>
            <p className="text-sm text-neutral-700">Esta edición guarda los datos del transportista, no su flota. Los vehículos y choferes se administran desde la pestaña Flota y Conductores de su ficha.</p>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-primary-700 px-4 font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" to={mp('/admin/actores/transportistas/' + id)} target="_blank" rel="noopener noreferrer">Administrar flota (nueva pestaña)</Link>
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {choferes.map((item, i) => <li key={i} className="p-4 text-sm text-neutral-900">{item.nombre} {item.apellido} — DNI {item.dni}</li>)}
            </ul>
            {choferes.length === 0 && <p className="text-sm text-neutral-600">Sin choferes registrados.</p>}
          </section>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><User size={20} className="text-orange-600" /> Choferes</h3>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setChoferes(prev => [...prev, { ...EMPTY_CHOFER }])}>
                Agregar
              </Button>
            </div>
            {choferes.length === 0 && (
              <p className="text-sm text-neutral-400 py-8 text-center">No hay choferes registrados. Presione "Agregar" para incluir uno.</p>
            )}
            {choferes.map((c, i) => (
              <div key={i} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">Chofer {i + 1}</span>
                  <button onClick={() => setChoferes(prev => prev.filter((_, j) => j !== i))} aria-label={`Quitar chofer ${i + 1}`} type="button" className="min-h-11 min-w-11 inline-flex items-center justify-center text-error-700 hover:bg-error-50 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-error-700">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Nombre *" value={c.nombre} errorMessage={attempted.has(4) && !c.nombre.trim() ? 'El nombre es obligatorio' : undefined} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], nombre: e.target.value }; setChoferes(nc); }} placeholder="Juan" />
                  <Input label="Apellido" value={c.apellido} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], apellido: e.target.value }; setChoferes(nc); }} placeholder="Perez" />
                  <Input label="DNI *" value={c.dni} errorMessage={attempted.has(4) && !c.dni.trim() ? 'El DNI es obligatorio' : undefined} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], dni: e.target.value }; setChoferes(nc); }} placeholder="12345678" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Licencia" value={c.licencia} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], licencia: e.target.value }; setChoferes(nc); }} placeholder="LIC-XXXX" />
                  <Input label="Vencimiento *" type="date" value={c.vencimiento} errorMessage={attempted.has(4) && (!c.vencimiento || !Number.isFinite(Date.parse(c.vencimiento))) ? 'Indicá el vencimiento' : undefined} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], vencimiento: e.target.value }; setChoferes(nc); }} />
                  <Input label="Telefono" value={c.telefono} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], telefono: e.target.value }; setChoferes(nc); }} placeholder="261-XXXX" />
                </div>
              </div>
            ))}
          </div>
        ))}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Check size={20} className="text-orange-600" /> Confirmar datos</h3>
            <section aria-label="Documentación del transportista" className="space-y-3 border-b border-neutral-200 pb-5">
              <h4 className="font-semibold text-neutral-900">Documentación · opcional al registrar</h4>
              <DocumentUpload documentos={savedDocuments} isAdmin={false} isPending={isPending} initialTipo="OTRO"
                onUpload={(file, tipo, anio) => setPendingDocuments(previous => ({ ...previous, [tipo]: { file, anio } }))}
                onDownload={doc => void generadorFiscalService.downloadDocumento(doc.id, doc.nombre)} />
              {Object.entries(pendingDocuments).map(([tipo, selection]) => <div key={tipo} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2">
                <p className="min-w-0 break-words text-sm text-neutral-800">{selection.file.name} · Pendiente de guardar</p>
                <Button variant="ghost" disabled={isPending} aria-label={`Quitar ${selection.file.name}`} onClick={() => setPendingDocuments(previous => { const next = { ...previous }; delete next[tipo]; return next; })}>Quitar</Button>
              </div>)}
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Razon Social', form.razonSocial], ['CUIT', form.cuit], ['Email', form.email],
                ['Telefono', form.telefono], ['Domicilio', form.domicilio], ['Localidad', form.localidad],
                ['Habilitacion', form.numeroHabilitacion], ['Vencimiento', form.vencimientoHabilitacion],
                ['Expediente DPA', form.expedienteDPA], ['Resolucion DPA', form.resolucionDPA],
                ['Corrientes', form.corrientesAutorizadas], ['Coordenadas', form.coordenadas],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">{label}</span>
                  <span className="text-neutral-900 font-medium text-right truncate max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
            {vehiculos.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-700 mb-2">Vehiculos ({vehiculos.length})</p>
                <div className="space-y-1">
                  {vehiculos.map((v, i) => (
                    <p key={i} className="text-sm text-neutral-600">{v.patente} — {v.marca} {v.modelo} ({v.anio})</p>
                  ))}
                </div>
              </div>
            )}
            {choferes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-700 mb-2">Choferes ({choferes.length})</p>
                <div className="space-y-1">
                  {choferes.map((c, i) => (
                    <p key={i} className="text-sm text-neutral-600">{c.nombre} {c.apellido} — DNI {c.dni}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </fieldset>
      </Card>

      {/* Navigation */}
      {documentError && <p role="alert" aria-label="Adjuntos pendientes" className="rounded-xl border border-error-300 bg-error-50 p-4 text-sm text-error-900">{documentError}</p>}
      <div className="flex items-center justify-between">
        <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => step > 1 ? setStep(step - 1) : navigate(backPath)} disabled={isPending}>
          {step === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        {step < STEPS.length ? (
          <Button rightIcon={<ArrowRight size={16} />} disabled={isPending} onClick={() => goStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button onClick={handleSubmit} isLoading={isPending}>
            {savedActorId ? 'Reintentar adjuntos' : isEdit ? 'Guardar Cambios' : 'Crear Transportista'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default NuevoTransportistaPage;

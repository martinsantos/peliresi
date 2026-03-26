/**
 * SITREP v6 - NuevoTransportistaPage
 * ===================================
 * Wizard para crear/editar transportistas con todos los campos DPA + vehiculos + choferes
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Truck, MapPin, Shield,
  Plus, Trash2, Loader2, Car, User,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
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
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const isEdit = !!id;

  const { data: existing } = useTransportista(isEdit ? id! : '');
  const createMutation = useCreateTransportista();
  const updateMutation = useUpdateTransportista();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    razonSocial: '', cuit: '', domicilio: '', localidad: '',
    telefono: '', email: '', password: '', nombre: '',
    numeroHabilitacion: '', vencimientoHabilitacion: '',
    coordenadas: '',
    corrientesAutorizadas: '', expedienteDPA: '', resolucionDPA: '',
    resolucionSSP: '', actaInspeccion: '', actaInspeccion2: '',
  });
  const [vehiculos, setVehiculos] = useState<VehiculoForm[]>([]);
  const [choferes, setChoferes] = useState<ChoferForm[]>([]);

  useEffect(() => {
    if (!isEdit || !existing) return;
    const t = existing;
    setForm({
      razonSocial: t.razonSocial || '', cuit: t.cuit || '',
      domicilio: t.domicilio || '', localidad: t.localidad || '',
      telefono: t.telefono || '', email: t.email || t.usuario?.email || '',
      password: '', nombre: t.usuario?.nombre || '',
      numeroHabilitacion: t.numeroHabilitacion || '',
      vencimientoHabilitacion: t.vencimientoHabilitacion ? new Date(t.vencimientoHabilitacion).toISOString().split('T')[0] : '',
      coordenadas: t.latitud ? `${t.latitud}, ${t.longitud}` : '',
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
        anio: v.anio ? String(v.anio) : '', capacidad: v.capacidad || '',
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
  }, [existing, isEdit]);

  const up = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const parseCoords = (coords: string) => {
    const parts = coords?.split(',').map(s => s.trim()).filter(Boolean);
    const lat = parts?.[0] ? Number(parts[0]) : undefined;
    const lng = parts?.[1] ? Number(parts[1]) : undefined;
    return lat && lng && !isNaN(lat) && !isNaN(lng) ? { latitud: lat, longitud: lng } : {};
  };

  const handleSubmit = async () => {
    if (!form.razonSocial || !form.cuit || !form.email) {
      toast.error('Campos requeridos', 'Razon social, CUIT y email son obligatorios');
      setStep(1);
      return;
    }

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
      payload.password = form.password || form.cuit.replace(/\D/g, '');
      payload.nombre = form.nombre || form.razonSocial;
      // Include vehiculos and choferes on create
      if (vehiculos.length > 0) {
        payload.vehiculos = vehiculos.filter(v => v.patente).map(v => ({
          patente: v.patente, marca: v.marca, modelo: v.modelo,
          anio: v.anio ? Number(v.anio) : undefined,
          capacidad: v.capacidad || undefined,
          numeroHabilitacion: v.numeroHabilitacion || undefined,
          vencimiento: v.vencimiento || new Date().toISOString(),
        }));
      }
      if (choferes.length > 0) {
        payload.choferes = choferes.filter(c => c.nombre && c.dni).map(c => ({
          nombre: c.nombre, apellido: c.apellido || '',
          dni: c.dni, licencia: c.licencia || '',
          vencimiento: c.vencimiento || new Date().toISOString(),
          telefono: c.telefono || '',
        }));
      }
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, data: payload });
        toast.success('Actualizado', `Transportista ${form.razonSocial} actualizado`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Creado', `Transportista ${form.razonSocial} creado. Password inicial: ${payload.password}`);
      }
      const backPath = isMobile ? '/mobile/actores/transportistas' : '/admin/actores/transportistas';
      navigate(backPath);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo guardar');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const backPath = isMobile ? '/mobile/actores/transportistas' : '/admin/actores/transportistas';

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
          Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-xl">
            <Truck size={22} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{isEdit ? 'Editar' : 'Nuevo'} Transportista</h2>
            <p className="text-xs text-neutral-500">Paso {step} de {STEPS.length}</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-neutral-200 p-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex flex-col items-center gap-1.5 transition-all ${isActive ? 'scale-105' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isActive ? 'bg-orange-500 text-white shadow-lg' :
                  isDone ? 'bg-orange-100 text-orange-600' :
                  'bg-neutral-100 text-neutral-400'
                }`}>
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${
                  isActive ? 'text-orange-600' : isDone ? 'text-orange-600' : 'text-neutral-400'
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
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Truck size={20} className="text-orange-600" /> Datos Basicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Razon Social *" value={form.razonSocial} onChange={e => up('razonSocial', e.target.value)} placeholder="Transporte S.A." />
              <Input label="CUIT *" value={form.cuit} onChange={e => up('cuit', e.target.value)} placeholder="30-12345678-9" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Email *" type="email" value={form.email} onChange={e => up('email', e.target.value)} placeholder="contacto@empresa.com" />
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
                <Input label="Password inicial" type="password" value={form.password} onChange={e => up('password', e.target.value)} placeholder="Default: CUIT" />
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

        {step === 3 && (
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
                  <button onClick={() => setVehiculos(prev => prev.filter((_, j) => j !== i))} className="p-1 text-error-500 hover:bg-error-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Patente *" value={v.patente} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], patente: e.target.value }; setVehiculos(nv); }} placeholder="AB123CD" />
                  <Input label="Marca" value={v.marca} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], marca: e.target.value }; setVehiculos(nv); }} placeholder="Mercedes" />
                  <Input label="Modelo" value={v.modelo} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], modelo: e.target.value }; setVehiculos(nv); }} placeholder="Atego 1726" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Ano" type="number" value={v.anio} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], anio: e.target.value }; setVehiculos(nv); }} placeholder="2024" />
                  <Input label="Capacidad" value={v.capacidad} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], capacidad: e.target.value }; setVehiculos(nv); }} placeholder="10 tn" />
                  <Input label="Habilitacion" value={v.numeroHabilitacion} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], numeroHabilitacion: e.target.value }; setVehiculos(nv); }} placeholder="VEH-XXXX" />
                  <Input label="Vencimiento" type="date" value={v.vencimiento} onChange={e => { const nv = [...vehiculos]; nv[i] = { ...nv[i], vencimiento: e.target.value }; setVehiculos(nv); }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
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
                  <button onClick={() => setChoferes(prev => prev.filter((_, j) => j !== i))} className="p-1 text-error-500 hover:bg-error-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Nombre *" value={c.nombre} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], nombre: e.target.value }; setChoferes(nc); }} placeholder="Juan" />
                  <Input label="Apellido" value={c.apellido} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], apellido: e.target.value }; setChoferes(nc); }} placeholder="Perez" />
                  <Input label="DNI *" value={c.dni} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], dni: e.target.value }; setChoferes(nc); }} placeholder="12345678" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Input label="Licencia" value={c.licencia} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], licencia: e.target.value }; setChoferes(nc); }} placeholder="LIC-XXXX" />
                  <Input label="Vencimiento" type="date" value={c.vencimiento} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], vencimiento: e.target.value }; setChoferes(nc); }} />
                  <Input label="Telefono" value={c.telefono} onChange={e => { const nc = [...choferes]; nc[i] = { ...nc[i], telefono: e.target.value }; setChoferes(nc); }} placeholder="261-XXXX" />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Check size={20} className="text-orange-600" /> Confirmar datos</h3>
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
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => step > 1 ? setStep(step - 1) : navigate(backPath)} disabled={isPending}>
          {step === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        {step < STEPS.length ? (
          <Button rightIcon={<ArrowRight size={16} />} onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button onClick={handleSubmit} isLoading={isPending}>
            {isEdit ? 'Guardar Cambios' : 'Crear Transportista'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default NuevoTransportistaPage;

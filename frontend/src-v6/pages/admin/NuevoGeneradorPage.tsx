/**
 * SITREP v6 - Nuevo / Editar Generador Page
 * ==========================================
 * Formulario dedicado para crear o editar un generador de residuos peligrosos.
 * Ruta crear: /admin/actores/generadores/nuevo
 * Ruta editar: /admin/actores/generadores/:id/editar
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Factory,
  MapPin,
  Lock,
  Biohazard,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { useGenerador, useCreateGenerador, useUpdateGenerador } from '../../hooks/useActores';
import { CORRIENTES_Y } from '../../data/corrientes-y';

const INITIAL_FORM = {
  razonSocial: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroInscripcion: '',
  categoria: '',
  actividad: '',
  rubro: '',
  corrientesControl: '',
};

const CATEGORIAS = [
  'Grandes Generadores',
  'Medianos Generadores',
  'Pequeños Generadores',
];

const NuevoGeneradorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const isEdit = Boolean(id);

  const [form, setForm] = useState(INITIAL_FORM);

  const { data: existing, isLoading: loadingExisting } = useGenerador(id || '');
  const createMutation = useCreateGenerador();
  const updateMutation = useUpdateGenerador();

  const backPath = isMobile
    ? '/mobile/admin/actores/generadores'
    : '/admin/actores/generadores';

  // Populate form when editing
  useEffect(() => {
    if (!isEdit || !existing) return;
    const g = existing as any;
    setForm({
      razonSocial: g.razonSocial || '',
      cuit: g.cuit || '',
      domicilio: g.domicilio || '',
      telefono: g.telefono || '',
      email: g.email || g.usuario?.email || '',
      password: '',
      nombre: g.usuario?.nombre || '',
      numeroInscripcion: g.numeroInscripcion || '',
      categoria: g.categoria || '',
      actividad: g.actividad || '',
      rubro: g.rubro || '',
      corrientesControl: g.corrientesControl || '',
    });
  }, [existing, isEdit]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    if (!form.razonSocial.trim()) {
      toast.error('Campo requerido', 'Razón Social es obligatoria');
      return false;
    }
    if (!form.cuit.trim()) {
      toast.error('Campo requerido', 'CUIT es obligatorio');
      return false;
    }
    if (!form.email.trim()) {
      toast.error('Campo requerido', 'Email es obligatorio');
      return false;
    }
    if (!isEdit && !form.password.trim()) {
      toast.error('Campo requerido', 'Password inicial es obligatorio al crear');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            razonSocial: form.razonSocial,
            cuit: form.cuit,
            domicilio: form.domicilio,
            telefono: form.telefono,
            email: form.email,
            numeroInscripcion: form.numeroInscripcion,
            categoria: form.categoria,
            actividad: form.actividad,
            rubro: form.rubro,
            corrientesControl: form.corrientesControl,
          },
        });
        toast.success('Guardado', `Generador ${form.razonSocial} actualizado`);
      } else {
        await createMutation.mutateAsync({
          email: form.email,
          password: form.password || 'TempPass123!',
          nombre: form.nombre || form.razonSocial,
          razonSocial: form.razonSocial,
          cuit: form.cuit,
          domicilio: form.domicilio,
          telefono: form.telefono,
          numeroInscripcion: form.numeroInscripcion,
          categoria: form.categoria,
          actividad: form.actividad,
          rubro: form.rubro,
          corrientesControl: form.corrientesControl,
        });
        toast.success('Creado', `Generador ${form.razonSocial} creado exitosamente`);
      }
      navigate(backPath);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo guardar el generador');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const corrientesCodes = form.corrientesControl
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
            Volver
          </Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-neutral-500">Cargando generador...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-4xl xl:mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
          Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Factory size={22} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              {isEdit ? 'Editar Generador' : 'Nuevo Generador'}
            </h2>
            <p className="text-sm text-neutral-500">
              {isEdit ? 'Modificar datos del generador' : 'Registrar un nuevo generador de residuos peligrosos'}
            </p>
          </div>
        </div>
      </div>

      {/* Sección 1: Identificación */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Factory size={18} className="text-purple-600" />
            <h3 className="font-semibold text-neutral-900">Identificación</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Razón Social *"
              value={form.razonSocial}
              onChange={(e) => update('razonSocial', e.target.value)}
              placeholder="Empresa S.A."
            />
            <Input
              label="CUIT *"
              value={form.cuit}
              onChange={(e) => update('cuit', e.target.value)}
              placeholder="30-12345678-9"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => update('categoria', e.target.value)}
              className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm bg-white"
            >
              <option value="">Seleccionar categoría...</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Input
            label="N° Inscripción DGFA"
            value={form.numeroInscripcion}
            onChange={(e) => update('numeroInscripcion', e.target.value)}
            placeholder="G-000XXX"
          />
        </CardContent>
      </Card>

      {/* Sección 2: Contacto */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-info-600" />
            <h3 className="font-semibold text-neutral-900">Contacto</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Domicilio"
            value={form.domicilio}
            onChange={(e) => update('domicilio', e.target.value)}
            placeholder="Av. San Martín 1234, Mendoza"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label="Teléfono"
                value={form.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                placeholder="+54 261 4XX-XXXX"
              />
            </div>
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="contacto@empresa.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sección 3: Actividad Regulatoria */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Biohazard size={18} className="text-warning-600" />
            <h3 className="font-semibold text-neutral-900">Actividad Regulatoria</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Rubro"
            value={form.rubro}
            onChange={(e) => update('rubro', e.target.value)}
            placeholder="Ej: INDUSTRIA QUIMICA"
          />
          <Input
            label="Actividad"
            value={form.actividad}
            onChange={(e) => update('actividad', e.target.value)}
            placeholder="Ej: Generación de energía eléctrica"
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Corrientes Y (Ley 24.051) — separadas por coma
            </label>
            <input
              value={form.corrientesControl}
              onChange={(e) => update('corrientesControl', e.target.value)}
              placeholder="Ej: Y8, Y9, Y12, Y48"
              className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
            />
            {corrientesCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {corrientesCodes.map((code) => (
                  <span
                    key={code}
                    className="text-[11px] px-1.5 py-0.5 bg-warning-50 text-warning-700 border border-warning-200 rounded"
                    title={CORRIENTES_Y[code] || code}
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección 4: Acceso (solo creación) */}
      {!isEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-neutral-500" />
              <h3 className="font-semibold text-neutral-900">Acceso al Sistema</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre del Responsable"
                value={form.nombre}
                onChange={(e) => update('nombre', e.target.value)}
                placeholder="Juan Pérez"
              />
              <Input
                label="Password Inicial *"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <p className="text-xs text-neutral-500">
              El responsable podrá cambiar su contraseña desde su perfil al ingresar por primera vez.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate(backPath)} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          leftIcon={isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Generador'}
        </Button>
      </div>
    </div>
  );
};

export default NuevoGeneradorPage;

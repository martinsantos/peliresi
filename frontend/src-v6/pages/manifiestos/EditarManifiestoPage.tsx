/**
 * SITREP v6 - Editar Manifiesto Page
 * ===================================
 * Formulario para editar manifiesto en estado BORRADOR
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  Factory,
  Truck,
  Package,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useManifiesto, useUpdateManifiesto } from '../../hooks/useManifiestos';
import { useTiposResiduo, useCatalogoGeneradores, useCatalogoTransportistas, useCatalogoOperadores } from '../../hooks/useCatalogos';
import { EstadoManifiesto } from '../../types/models';

export const EditarManifiestoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isGenerador } = useAuth();
  const isMobile = window.location.pathname.includes('/mobile') || window.location.pathname.includes('/app');

  // Load existing manifiesto
  const { data: manifiesto, isLoading: loadingManifiesto } = useManifiesto(id!);
  const updateManifiesto = useUpdateManifiesto();

  // Catalogs
  const { data: apiTiposResiduo } = useTiposResiduo();
  const { data: apiGeneradores } = useCatalogoGeneradores();
  const { data: apiTransportistas } = useCatalogoTransportistas();
  const { data: apiOperadores } = useCatalogoOperadores();

  const tiposResiduo = apiTiposResiduo || [];
  const generadoresList = apiGeneradores || [];
  const transportistasList = apiTransportistas || [];
  const operadoresList = apiOperadores || [];

  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    generadorId: '',
    generador: '',
    transportista: '',
    operador: '',
    fechaRetiro: new Date().toISOString().split('T')[0],
    observaciones: '',
    residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }] as { tipo: string; cantidad: string; unidad: string }[],
  });

  // Pre-populate form when manifiesto loads
  useEffect(() => {
    if (manifiesto && !initialized) {
      setFormData({
        generadorId: manifiesto.generadorId || '',
        generador: manifiesto.generador?.razonSocial || '',
        transportista: manifiesto.transportistaId || '',
        operador: manifiesto.operadorId || '',
        fechaRetiro: manifiesto.fechaRetiro
          ? new Date(manifiesto.fechaRetiro).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        observaciones: manifiesto.observaciones || '',
        residuos: manifiesto.residuos && manifiesto.residuos.length > 0
          ? manifiesto.residuos.map((r) => ({
              tipo: r.tipoResiduoId || '',
              cantidad: String(r.cantidad || ''),
              unidad: r.unidad || 'kg',
            }))
          : [{ tipo: '', cantidad: '', unidad: 'kg' }],
      });
      setInitialized(true);
    }
  }, [manifiesto, initialized]);

  // Selected actor details
  const selectedGenerador = generadoresList.find((g) => g.id === formData.generadorId);
  const selectedTransportista = transportistasList.find((t) => t.id === formData.transportista);
  const selectedOperador = operadoresList.find((o) => o.id === formData.operador);

  const handleAddResiduo = () => {
    setFormData({
      ...formData,
      residuos: [...formData.residuos, { tipo: '', cantidad: '', unidad: 'kg' }],
    });
  };

  const handleRemoveResiduo = (index: number) => {
    const newResiduos = formData.residuos.filter((_, i) => i !== index);
    setFormData({ ...formData, residuos: newResiduos });
  };

  const handleResiduoChange = (index: number, field: string, value: string) => {
    const newResiduos = [...formData.residuos];
    newResiduos[index] = { ...newResiduos[index], [field]: value };
    setFormData({ ...formData, residuos: newResiduos });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.generadorId) {
      errors.generador = 'El generador es requerido';
    }
    if (!formData.transportista) {
      errors.transportista = 'El transportista es requerido';
    }
    if (!formData.operador) {
      errors.operador = 'El operador es requerido';
    }

    const hasInvalidResiduos = formData.residuos.some(
      (r) => !r.tipo || !r.cantidad || Number(r.cantidad) <= 0
    );
    if (hasInvalidResiduos) {
      errors.residuos = 'Todos los residuos deben tener tipo y cantidad valida';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.warning('Formulario incompleto', 'Por favor completa todos los campos requeridos');
      return;
    }

    try {
      await updateManifiesto.mutateAsync({
        id: id!,
        generadorId: formData.generadorId,
        transportistaId: formData.transportista,
        operadorId: formData.operador,
        observaciones: formData.observaciones || undefined,
        residuos: formData.residuos.map((r) => ({
          tipoResiduoId: r.tipo,
          cantidad: Number(r.cantidad),
          unidad: r.unidad,
        })),
      });

      toast.success('Manifiesto actualizado', 'Los cambios fueron guardados exitosamente');
      navigate(isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`);
    } catch (err: any) {
      toast.error(
        'Error al actualizar manifiesto',
        err?.response?.data?.message || err?.message || 'Ocurrio un error inesperado'
      );
    }
  };

  // Loading state
  if (loadingManifiesto) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-primary-500" />
          <p className="text-neutral-600">Cargando manifiesto...</p>
        </div>
      </div>
    );
  }

  // Guard: only BORRADOR can be edited
  if (manifiesto && manifiesto.estado !== EstadoManifiesto.BORRADOR) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-bold text-neutral-900">Editar Manifiesto</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto p-6 mt-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-warning-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">No se puede editar</h3>
              <p className="text-neutral-600 mb-4">
                Este manifiesto tiene estado <span className="font-semibold">{manifiesto.estado}</span> y solo
                se pueden editar manifiestos en estado <span className="font-semibold">BORRADOR</span>.
              </p>
              <Button fullWidth onClick={() => navigate(isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`)}>
                Volver al Manifiesto
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Permission guard
  const canEdit = isAdmin || isGenerador;
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-bold text-neutral-900">Editar Manifiesto</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto p-6 mt-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-warning-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Acceso restringido</h3>
              <p className="text-neutral-600 mb-6">
                Solo los perfiles <span className="font-semibold">GENERADOR</span> y <span className="font-semibold">ADMIN</span> pueden editar manifiestos.
              </p>
              <Button fullWidth onClick={() => navigate(isMobile ? '/mobile/manifiestos' : '/manifiestos')}>
                Volver a Manifiestos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`)}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">
                Editar Manifiesto {manifiesto?.numero || ''}
              </h1>
              <p className="text-xs text-neutral-500">Paso {step} de 3</p>
            </div>
          </div>
          <Badge variant="soft" color="primary">
            <FileText size={14} className="mr-1" />
            Borrador
          </Badge>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="flex h-1 bg-neutral-200">
        <div
          className="bg-primary-500 transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Step 1: Datos del Generador */}
        {step === 1 && (
          <Card>
            <CardHeader
              title="Datos del Generador"
              icon={<Factory size={20} />}
              subtitle="Información del generador de residuos"
            />
            <CardContent className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Generador *
                </label>
                <Select
                  value={formData.generadorId}
                  onChange={(val) => {
                    const gen = generadoresList.find((g: any) => g.id === val);
                    setFormData({ ...formData, generadorId: val, generador: gen?.razonSocial || gen?.nombre || '' });
                  }}
                  options={[...generadoresList]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((g: any) => ({
                      value: g.id,
                      label: `${g.razonSocial || g.nombre || g.label}${g.cuit ? ` — ${g.cuit}` : ''}`,
                    }))}
                  placeholder="Buscar generador por nombre o CUIT..."
                  searchable
                  errorMessage={validationErrors.generador}
                  size="base"
                />
                {validationErrors.generador && (
                  <p className="text-xs text-error-500 mt-1">{validationErrors.generador}</p>
                )}
              </div>

              {selectedGenerador && (
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">CUIT</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedGenerador.cuit || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Teléfono</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedGenerador.telefono || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-0.5">Domicilio</label>
                    <p className="text-sm font-semibold text-neutral-900">{selectedGenerador.domicilio || '-'}</p>
                  </div>
                  {selectedGenerador.usuario?.email && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Email</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedGenerador.usuario.email}</p>
                    </div>
                  )}
                  {selectedGenerador.numeroInscripcion && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">N° Inscripción</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedGenerador.numeroInscripcion}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Residuos */}
        {step === 2 && (
          <Card>
            <CardHeader
              title="Residuos a Transportar"
              icon={<Package size={20} />}
              subtitle="Detalle de los residuos que serán transportados"
            />
            <CardContent className="space-y-4 animate-fade-in">
              {formData.residuos.map((residuo, index) => (
                <div key={index} className="p-4 bg-neutral-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Residuo #{index + 1}
                    </span>
                    {formData.residuos.length > 1 && (
                      <button
                        onClick={() => handleRemoveResiduo(index)}
                        className="text-error-500 hover:text-error-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div>
                    <Select
                      label="Tipo de Residuo *"
                      value={residuo.tipo}
                      onChange={(val) => handleResiduoChange(index, 'tipo', val)}
                      options={tiposResiduo.map((r: any) => ({
                        value: r.id,
                        label: `${r.codigo} - ${r.nombre || r.descripcion}`,
                      }))}
                      placeholder="Buscar tipo de residuo..."
                      searchable
                      errorMessage={validationErrors.residuos && !residuo.tipo ? 'Requerido' : undefined}
                      size="sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Cantidad *
                      </label>
                      <Input
                        type="number"
                        value={residuo.cantidad}
                        onChange={(e) => handleResiduoChange(index, 'cantidad', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Unidad
                      </label>
                      <select
                        value={residuo.unidad}
                        onChange={(e) => handleResiduoChange(index, 'unidad', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="kg">kg</option>
                        <option value="tn">tn</option>
                        <option value="lt">lt</option>
                        <option value="un">un</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                fullWidth
                leftIcon={<Plus size={18} />}
                onClick={handleAddResiduo}
              >
                Agregar Residuo
              </Button>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Anterior
                </Button>
                <Button onClick={() => setStep(3)}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Transporte y Operador */}
        {step === 3 && (
          <Card>
            <CardHeader
              title="Transporte y Destino"
              icon={<Truck size={20} />}
              subtitle="Información del transportista y destino final"
            />
            <CardContent className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Transportista *
                </label>
                <Select
                  value={formData.transportista}
                  onChange={(val) => setFormData({ ...formData, transportista: val })}
                  options={[...transportistasList]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((t: any) => ({
                      value: t.id,
                      label: `${t.razonSocial || t.nombre || t.label}${t.cuit ? ` — ${t.cuit}` : ''}`,
                    }))}
                  placeholder="Buscar transportista por nombre o CUIT..."
                  searchable
                  errorMessage={validationErrors.transportista}
                  size="base"
                />
              </div>

              {selectedTransportista && (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-2 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">CUIT</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedTransportista.cuit || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Teléfono</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedTransportista.telefono || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-0.5">Domicilio</label>
                    <p className="text-sm font-semibold text-neutral-900">{selectedTransportista.domicilio || '-'}</p>
                  </div>
                  {selectedTransportista.numeroHabilitacion && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">N° Habilitación</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedTransportista.numeroHabilitacion}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Operador / Destino *
                </label>
                <Select
                  value={formData.operador}
                  onChange={(val) => setFormData({ ...formData, operador: val })}
                  options={[...operadoresList]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((o: any) => ({
                      value: o.id,
                      label: `${o.razonSocial || o.nombre || o.label}${o.cuit ? ` — ${o.cuit}` : ''}`,
                    }))}
                  placeholder="Buscar operador por nombre o CUIT..."
                  searchable
                  errorMessage={validationErrors.operador}
                  size="base"
                />
              </div>

              {selectedOperador && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-2 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">CUIT</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedOperador.cuit || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Teléfono</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedOperador.telefono || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-0.5">Domicilio</label>
                    <p className="text-sm font-semibold text-neutral-900">{selectedOperador.domicilio || '-'}</p>
                  </div>
                  {selectedOperador.numeroHabilitacion && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">N° Habilitación</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedOperador.numeroHabilitacion}</p>
                    </div>
                  )}
                  {selectedOperador.categoria && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Categoría</label>
                      <p className="text-sm font-semibold text-neutral-900">{selectedOperador.categoria}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fecha Estimada de Retiro *
                </label>
                <Input
                  type="date"
                  value={formData.fechaRetiro}
                  onChange={(e) => setFormData({ ...formData, fechaRetiro: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Anterior
                </Button>
                <Button
                  leftIcon={updateManifiesto.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  onClick={handleSubmit}
                  disabled={updateManifiesto.isPending}
                >
                  {updateManifiesto.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EditarManifiestoPage;

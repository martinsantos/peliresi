/**
 * SITREP v6 - Nuevo Manifiesto Page
 * ==================================
 * Formulario para crear nuevo manifiesto de residuos
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateManifiesto } from '../../hooks/useManifiestos';
import { useTiposResiduo, useCatalogoGeneradores, useCatalogoTransportistas, useCatalogoOperadores } from '../../hooks/useCatalogos';
import type { CatalogoItem } from '../../types/api';

function ActorSummary({ actor, label }: { actor?: CatalogoItem; label: string }) {
  if (!actor) return null;
  const fields: Array<[string, unknown]> = [
    ['CUIT', actor.cuit], ['Domicilio', actor.domicilio], ['Teléfono', actor.telefono],
    ['Email', actor.usuario?.email], ['Inscripción', actor.numeroInscripcion],
    ['Habilitación', actor.numeroHabilitacion], ['Categoría', actor.categoria],
  ];
  const available = fields.filter(([, value]) => value != null && value !== '');
  return <details className="group border-b border-neutral-200 pb-2">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded text-sm font-medium text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
      {label}<ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
    </summary>
    {available.length ? <dl className="grid gap-3 py-2 sm:grid-cols-2">{available.map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-xs text-neutral-600">{name}</dt><dd className="break-words text-sm text-neutral-900">{String(value)}</dd></div>)}</dl> : <p className="pb-2 text-sm text-neutral-600">El catálogo no informa datos complementarios.</p>}
  </details>;
}


/** Parse corrientes Basel codes from various formats: "Y8-Y48", "Y8,Y48", "Y4/Y8/Y9", "Y8, Y9 e Y48", ["Y8","Y48"] */
function parseCorrientes(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => s.trim()).filter(Boolean);
  // Split by comma, slash, or dash-between-Y-codes (e.g. "Y8-Y9-Y48")
  return raw.split(/[,/]|(?<=\d)-(?=Y)/i).map(s => s.replace(/\s*e\s*$/, '').trim()).filter(Boolean);
}

export const NuevoManifiestoPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isGenerador } = useAuth();
  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);
  const focusError = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [validationErrors, step]);

  // API hooks
  const createManifiesto = useCreateManifiesto();
  const { data: apiTiposResiduo } = useTiposResiduo();
  const { data: apiGeneradores } = useCatalogoGeneradores();
  const { data: apiTransportistas } = useCatalogoTransportistas();
  const { data: apiOperadores } = useCatalogoOperadores();

  // Use API catalogos only
  const tiposResiduo = apiTiposResiduo || [];
  const generadoresList = apiGeneradores || [];
  const transportistasList = apiTransportistas || [];
  const operadoresList = apiOperadores || [];

  // Form state
  const [formData, setFormData] = useState({
    generador: currentUser?.rol === 'GENERADOR' ? currentUser?.sector || '' : '',
    generadorId: currentUser?.rol === 'GENERADOR' ? currentUser?.actorId || '' : '',
    modalidad: 'FIJO' as 'FIJO' | 'IN_SITU',
    transportista: '',
    operador: '',
    fechaRetiro: new Date().toISOString().split('T')[0],
    observaciones: '',
    residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }],
  });

  // Selected actor details (auto-populated from catalogs)
  const selectedGenerador = generadoresList.find((g) => g.id === formData.generadorId);
  const selectedTransportista = transportistasList.find((t) => t.id === formData.transportista);
  const selectedOperador = operadoresList.find((o) => o.id === formData.operador);

  // Cross-filter: only show operadores that can handle ALL selected residuos
  const selectedResiduoIds = useMemo(
    () => formData.residuos.map((r) => r.tipo).filter(Boolean),
    [formData.residuos]
  );
  const operadoresFiltrados = useMemo(() => {
    let filtered = operadoresList;

    // Filter by modalidad: check modalidades array, tipoOperador, or categoria
    filtered = filtered.filter((op: any) => {
      const modalidades: string[] = op.modalidades || [];
      const tipo = (op.tipoOperador || op.categoria || '').toUpperCase();
      if (formData.modalidad === 'IN_SITU') {
        return modalidades.includes('IN_SITU') || tipo.includes('IN SITU') || tipo.includes('IN_SITU');
      }
      // FIJO
      return modalidades.includes('FIJO') || tipo.includes('FIJO') || modalidades.length === 0;
    });

    // Filter by residuos compatibility (strict: operador must have tratamiento for each residuo)
    if (selectedResiduoIds.length > 0) {
      filtered = filtered.filter((op: any) => {
        const opResiduoIds = new Set(
          (op.tratamientos || [])
            .filter((t: any) => t.activo !== false)
            .map((t: any) => t.tipoResiduoId)
        );
        return selectedResiduoIds.every((id) => opResiduoIds.has(id));
      });
    }

    return filtered;
  }, [operadoresList, selectedResiduoIds, formData.modalidad]);

  // Cross-filter: residuos by generador's corrientesControl
  const genCorrientes = useMemo(() => {
    const gen = selectedGenerador as any;
    return parseCorrientes(gen?.corrientesControl || gen?.categoriasControl);
  }, [selectedGenerador]);

  const residuosFiltrados = useMemo(() => {
    if (genCorrientes.length === 0) return tiposResiduo; // no data = show all
    const filtered = tiposResiduo.filter((r: any) => genCorrientes.includes(r.codigo));
    return filtered.length > 0 ? filtered : tiposResiduo; // fallback if no match
  }, [tiposResiduo, genCorrientes]);
  const hasDeclaredResidueMatch = genCorrientes.length > 0 && tiposResiduo.some((residuo) => genCorrientes.includes(residuo.codigo));

  // Cross-filter: transportistas by selected residuos' codigos
  const selectedCodigos = useMemo(() => {
    return selectedResiduoIds
      .map(id => (tiposResiduo as any[]).find((r: any) => r.id === id)?.codigo)
      .filter(Boolean) as string[];
  }, [selectedResiduoIds, tiposResiduo]);

  const transportistasFiltrados = useMemo(() => {
    if (selectedCodigos.length === 0) return transportistasList;
    return transportistasList.filter((t: any) => {
      const transCorrientes = parseCorrientes(t.corrientesAutorizadas);
      if (transCorrientes.length === 0) return true; // No data = don't filter out
      return selectedCodigos.every(c => transCorrientes.includes(c));
    });
  }, [transportistasList, selectedCodigos]);

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

  const validateForm = (targetStep?: number): boolean => {
    const errors: Record<string, string> = {};

    if ((!targetStep || targetStep === 1) && !formData.generadorId && !formData.generador) {
      errors.generador = 'Seleccioná un generador para continuar.';
    }
    if ((!targetStep || targetStep === 3) && formData.modalidad !== 'IN_SITU' && !formData.transportista) {
      errors.transportista = 'Seleccioná el transportista.';
    }
    if ((!targetStep || targetStep === 3) && !formData.operador) {
      errors.operador = 'Seleccioná el operador de destino.';
    }

    const hasInvalidResiduos = formData.residuos.some(
      (r) => !r.tipo || !r.cantidad || !Number.isFinite(Number(r.cantidad)) || Number(r.cantidad) <= 0
    );
    if ((!targetStep || targetStep === 2) && hasInvalidResiduos) {
      errors.residuos = 'Completá el tipo y una cantidad mayor que cero en cada residuo, o quitá la fila que no corresponda.';
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      focusError.current = true;
      if (!targetStep) setStep(errors.generador ? 1 : errors.residuos ? 2 : 3);
    }
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    if (!validateForm()) {
      return;
    }

    submitting.current = true;
    try {
      const result = await createManifiesto.mutateAsync({
        generadorId: formData.generadorId || formData.generador,
        ...(formData.modalidad !== 'IN_SITU' && { transportistaId: formData.transportista }),
        operadorId: formData.operador,
        modalidad: formData.modalidad,
        fechaEstimadaRetiro: formData.fechaRetiro || undefined,
        observaciones: formData.observaciones || undefined,
        residuos: formData.residuos.map((r) => ({
          tipoResiduoId: r.tipo,
          cantidad: Number(r.cantidad),
          unidad: r.unidad,
        })),
      });

      toast.success('Manifiesto creado', `El manifiesto ${result.numero || result.id} fue creado exitosamente`);
      navigate(`/manifiestos/${result.id}`);
    } catch (err: any) {
      toast.error(
        'Error al crear manifiesto',
        err?.response?.data?.message || err?.message || 'Ocurrio un error inesperado'
      );
    } finally {
      submitting.current = false;
    }
  };

  // Removed isMobile — React Router handles /app/ basename

  // Only GENERADOR and ADMIN can create manifiestos
  const canCreate = isAdmin || isGenerador;

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-bold text-neutral-900">Nuevo Manifiesto</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto p-6 mt-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-warning-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Acceso restringido</h3>
              <p className="text-neutral-600 mb-4">
                El perfil <span className="font-semibold">{currentUser?.rol || 'actual'}</span> no tiene permisos para crear manifiestos.
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                Solo los perfiles <span className="font-semibold">GENERADOR</span> y <span className="font-semibold">ADMIN</span> pueden crear nuevos manifiestos de residuos.
              </p>
              <Button fullWidth onClick={() => navigate('/manifiestos')}>
                Volver a Manifiestos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div ref={formRef} className="mx-auto max-w-3xl min-w-0 pt-4 pb-6">
      {/* Header */}
      <header className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              aria-label="Volver a Manifiestos"
              onClick={() => navigate('/manifiestos')}
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Nuevo Manifiesto</h1>
            </div>
          </div>
          <Badge variant="soft" color="neutral" className="shrink-0">
            Sin guardar
          </Badge>
        </div>
      </header>

      <ol aria-label="Etapas del formulario" className="flex gap-4 py-3 text-sm text-neutral-600">
        {['Generador', 'Residuos', 'Destino'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step === index + 1 ? 'font-semibold text-primary-800' : ''}>{index + 1}. {label}</li>)}
      </ol>

      <div>
        {/* Step 1: Datos del Generador */}
        {step === 1 && (
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Datos del Generador"
            />
            <CardContent className="space-y-4">
              <div>
                <Select
                  label="Generador *"
                  value={formData.generadorId}
                  onChange={(val) => {
                    if (val === formData.generadorId) return;
                    const gen = generadoresList.find((g: any) => g.id === val);
                    setFormData({ ...formData, generadorId: val, generador: gen?.razonSocial || gen?.nombre || '', residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }], transportista: '', operador: '' });
                  }}
                  options={[...generadoresList]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((g: any) => ({
                      value: g.id,
                      label: `${g.razonSocial || g.nombre || g.label} — ${g.cuit || ''}`,
                    }))}
                  renderOption={(opt) => {
                    const gen = generadoresList.find((g: any) => g.id === opt.value) as any;
                    const corrientes = gen ? parseCorrientes(gen.corrientesControl || gen.categoriasControl) : [];
                    return (
                      <div>
                        <div className="text-sm font-medium text-neutral-900 truncate">{gen?.razonSocial || opt.label}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-neutral-500 font-mono">{gen?.cuit || ''}</span>
                          {corrientes.length > 0 && (
                            <>
                              <span className="text-neutral-300">·</span>
                              {corrientes.slice(0, 6).map((c: string) => (
                                <span key={c} className="inline-block px-1.5 py-0 rounded bg-warning-100 text-warning-700 text-[10px] font-semibold">{c}</span>
                              ))}
                              {corrientes.length > 6 && <span className="text-[10px] text-neutral-400">+{corrientes.length - 6}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }}
                  placeholder="Buscar generador por nombre o CUIT..."
                  searchable
                  errorMessage={validationErrors.generador}
                  size="base"
                  disabled={isGenerador}
                />
              </div>

              <ActorSummary actor={selectedGenerador} label="Datos del generador" />

              {!selectedGenerador && (
                <p className="text-xs text-neutral-400 italic">Seleccioná un generador para ver sus datos</p>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => { if (validateForm(1)) setStep(2); }}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Residuos */}
        {step === 2 && (
          <Card className="p-4 sm:p-5">
            <CardHeader 
              title="Residuos a Transportar" 
            />
            <CardContent className="space-y-4">
              {hasDeclaredResidueMatch && (
                <div className="flex items-center gap-2 p-2.5 bg-primary-50 border border-primary-200 rounded-xl text-xs text-primary-700">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>
                    <strong>{residuosFiltrados.length}</strong> residuos inscriptos para {(selectedGenerador as any)?.razonSocial || 'el generador'}
                    <span className="ml-1 text-primary-500">({genCorrientes.join(', ')})</span>
                  </span>
                </div>
              )}
              {genCorrientes.length > 0 && !hasDeclaredResidueMatch && (
                <div className="flex items-center gap-2 p-2.5 bg-warning-50 border border-warning-200 rounded-xl text-xs text-warning-700">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    No se encontraron residuos para las corrientes <strong>{genCorrientes.join(', ')}</strong> del generador. Mostrando todos los tipos de residuo.
                  </span>
                </div>
              )}
              {formData.residuos.map((residuo, index) => (
                <div key={index} className="p-4 bg-neutral-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Residuo #{index + 1}
                    </span>
                    {formData.residuos.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Quitar residuo ${index + 1}`}
                        onClick={() => handleRemoveResiduo(index)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-700 hover:bg-error-50"
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
                      options={residuosFiltrados.map((r: any) => ({
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
                      <Input
                        label="Cantidad *"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={residuo.cantidad}
                        onChange={(e) => handleResiduoChange(index, 'cantidad', e.target.value)}
                        placeholder="0"
                        errorMessage={validationErrors.residuos && (!residuo.cantidad || Number(residuo.cantidad) <= 0) ? 'Ingresá una cantidad mayor que cero.' : undefined}
                      />
                    </div>
                    <Select
                      label="Unidad"
                      value={residuo.unidad}
                      onChange={(val) => handleResiduoChange(index, 'unidad', val)}
                      options={[
                        { value: 'kg', label: 'kg' },
                        { value: 'tn', label: 'tn' },
                        { value: 'lt', label: 'lt' },
                        { value: 'un', label: 'un' },
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
              ))}

              {validationErrors.residuos && (
                <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
                  {validationErrors.residuos}
                </div>
              )}

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
                <Button
                  onClick={() => {
                    if (!validateForm(2)) return;
                    setValidationErrors(prev => { const n = {...prev}; delete n.residuos; return n; });
                    // A previously selected transport must still support the updated residues.
                    if (formData.transportista && !transportistasFiltrados.some((t) => t.id === formData.transportista)) {
                      setFormData(prev => ({ ...prev, transportista: '' }));
                    }
                    // Clear operador if no longer valid for the selected residuos
                    if (formData.operador) {
                      const curResiduoIds = formData.residuos.map(r => r.tipo).filter(Boolean);
                      if (curResiduoIds.length > 0) {
                        const op = operadoresList.find((o: any) => o.id === formData.operador);
                        if (op) {
                          const opResiduoIds = new Set(
                            ((op as any).tratamientos || [])
                              .filter((t: any) => t.activo !== false)
                              .map((t: any) => t.tipoResiduoId)
                          );
                          const stillValid = curResiduoIds.every(id => opResiduoIds.has(id));
                          if (!stillValid) {
                            setFormData(prev => ({ ...prev, operador: '' }));
                          }
                        }
                      }
                    }
                    setStep(3);
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Transporte y Operador */}
        {step === 3 && (
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Transporte y Destino"
            />
            <CardContent className="space-y-4">
              {/* Modalidad selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Modalidad de operacion *
                </label>
                <div role="group" aria-label="Modalidad de operación" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={formData.modalidad === 'FIJO'}
                    onClick={() => {
                      if (formData.modalidad === 'FIJO') return;
                      setFormData(prev => ({ ...prev, modalidad: 'FIJO', operador: '' }));
                      setValidationErrors(prev => { const n = {...prev}; delete n.transportista; return n; });
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.modalidad === 'FIJO'
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <Truck size={20} className={formData.modalidad === 'FIJO' ? 'text-primary-600' : 'text-neutral-400'} />
                    <div>
                      <p className={`text-sm font-semibold ${formData.modalidad === 'FIJO' ? 'text-primary-700' : 'text-neutral-700'}`}>Fijo</p>
                      <p className="text-xs text-neutral-500">Requiere transporte</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={formData.modalidad === 'IN_SITU'}
                    onClick={() => {
                      if (formData.modalidad === 'IN_SITU') return;
                      setFormData(prev => ({ ...prev, modalidad: 'IN_SITU', transportista: '', operador: '' }));
                      setValidationErrors(prev => { const n = {...prev}; delete n.transportista; return n; });
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.modalidad === 'IN_SITU'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <MapPin size={20} className={formData.modalidad === 'IN_SITU' ? 'text-emerald-600' : 'text-neutral-400'} />
                    <div>
                      <p className={`text-sm font-semibold ${formData.modalidad === 'IN_SITU' ? 'text-emerald-700' : 'text-neutral-700'}`}>In Situ</p>
                      <p className="text-xs text-neutral-500">Operador en sitio</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* In Situ note */}
              {formData.modalidad === 'IN_SITU' && (
                <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 animate-fade-in">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  <span>El operador trabajara directamente en el domicilio del generador. No se requiere transporte.</span>
                </div>
              )}

              {/* Transportista - only shown for FIJO */}
              {formData.modalidad === 'FIJO' && (
                <>
                  {selectedCodigos.length > 0 && transportistasFiltrados.length < transportistasList.length && (
                    <div className="flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
                      <Info size={14} className="shrink-0" />
                      <span>Mostrando <strong>{transportistasFiltrados.length}</strong> transportistas habilitados para los residuos seleccionados</span>
                    </div>
                  )}
                  <div>
                    <Select
                      label="Transportista *"
                      value={formData.transportista}
                      onChange={(val) => setFormData({ ...formData, transportista: val })}
                      options={[...transportistasFiltrados]
                        .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                        .map((t: any) => ({
                          value: t.id,
                          label: `${t.razonSocial || t.nombre || t.label}${t.cuit ? ` — ${t.cuit}` : ''}`,
                        }))}
                      placeholder={transportistasFiltrados.length === 0 ? 'No hay transportistas habilitados para estos residuos' : 'Buscar transportista por nombre o CUIT...'}
                      searchable
                      errorMessage={validationErrors.transportista}
                      size="base"
                    />
                  </div>

                  <ActorSummary actor={selectedTransportista} label="Datos del transportista" />
                </>
              )}

              <div>
                {selectedResiduoIds.length > 0 && (
                  <div className="mb-2 text-sm text-neutral-600">
                    <span>
                      Mostrando {operadoresFiltrados.length} operador{operadoresFiltrados.length !== 1 ? 'es' : ''} habilitado{operadoresFiltrados.length !== 1 ? 's' : ''} para los residuos seleccionados
                    </span>
                  </div>
                )}
                <Select
                  label="Operador / Destino *"
                  value={formData.operador}
                  onChange={(val) => setFormData({ ...formData, operador: val })}
                  options={[...operadoresFiltrados]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((o: any) => ({
                      value: o.id,
                      label: `${o.razonSocial || o.nombre || o.label}${o.cuit ? ` — ${o.cuit}` : ''}`,
                    }))}
                  placeholder={operadoresFiltrados.length === 0 && selectedResiduoIds.length > 0
                    ? 'No hay operadores habilitados para estos residuos'
                    : 'Buscar operador por nombre o CUIT...'}
                  searchable
                  errorMessage={validationErrors.operador}
                  size="base"
                />
              </div>

              <ActorSummary actor={selectedOperador} label="Datos del operador" />

              <div>
                <Input
                  label="Fecha estimada de retiro"
                  type="date"
                  value={formData.fechaRetiro}
                  onChange={(e) => setFormData({ ...formData, fechaRetiro: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="manifest-observaciones" className="block text-sm font-medium text-neutral-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  id="manifest-observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-neutral-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20 focus:outline-none resize-y"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Anterior
                </Button>
                <Button
                  leftIcon={createManifiesto.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  onClick={handleSubmit}
                  disabled={createManifiesto.isPending}
                >
                  {createManifiesto.isPending ? 'Guardando...' : 'Crear Manifiesto'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NuevoManifiestoPage;

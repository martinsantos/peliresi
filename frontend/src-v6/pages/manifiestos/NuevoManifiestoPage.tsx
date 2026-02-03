/**
 * SITREP v6 - Nuevo Manifiesto Page
 * ==================================
 * Formulario para crear nuevo manifiesto de residuos
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  Factory,
  Truck,
  Building2,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
  QrCode
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

// Mock data
const residuosDisponibles = [
  { id: 'RES-001', codigo: '180103', descripcion: 'Residuos de procedencia hospitalaria', categoria: 'Anatomopatológico' },
  { id: 'RES-002', codigo: '180106', descripcion: 'Objetos punzantes o cortantes', categoria: 'Cortopunzante' },
  { id: 'RES-003', codigo: '180108', descripcion: 'Residuos biológicos', categoria: 'Biológico' },
];

const transportistas = [
  { id: 1, nombre: 'Transportes Andes S.A.', cuit: '30-12345678-9' },
  { id: 2, nombre: 'EcoTransporte AR', cuit: '30-87654321-0' },
  { id: 3, nombre: 'Transporte Logístico', cuit: '30-11223344-5' },
];

const operadores = [
  { id: 1, nombre: 'Planta Las Heras', direccion: 'Las Heras, Mendoza' },
  { id: 2, nombre: 'Incineradora Eco', direccion: 'Godoy Cruz, Mendoza' },
  { id: 3, nombre: 'Planta de Tratamiento Norte', direccion: 'Guaymallén, Mendoza' },
];

export const NuevoManifiestoPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isGenerador, isTransportista, isOperador } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    generador: currentUser.rol === 'GENERADOR' ? currentUser.sector : '',
    transportista: '',
    operador: '',
    fechaRetiro: new Date().toISOString().split('T')[0],
    observaciones: '',
    residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }],
  });

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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simular API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    
    const newManifiestoId = 'M-2025-' + String(Math.floor(Math.random() * 1000)).padStart(4, '0');
    toast.success('Manifiesto creado', `El manifiesto ${newManifiestoId} fue creado exitosamente`);
    
    // Redirigir según el contexto (mobile o desktop)
    const isMobile = window.location.pathname.includes('/mobile');
    navigate(isMobile ? `/mobile/manifiestos` : `/manifiestos`);
  };

  const isMobile = window.location.pathname.includes('/mobile');

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isMobile ? '/mobile/manifiestos' : '/manifiestos')}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Nuevo Manifiesto</h1>
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
              subtitle="Información del establecimiento que genera los residuos"
            />
            <CardContent className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Establecimiento Generador *
                </label>
                <Input
                  value={formData.generador}
                  onChange={(e) => setFormData({ ...formData, generador: e.target.value })}
                  placeholder="Nombre del establecimiento"
                  disabled={currentUser.rol === 'GENERADOR'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    CUIT *
                  </label>
                  <Input placeholder="30-12345678-9" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Teléfono
                  </label>
                  <Input placeholder="261-4123456" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Dirección de Retiro *
                </label>
                <Input placeholder="Calle, número, localidad" />
              </div>

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
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Tipo de Residuo *
                    </label>
                    <select
                      value={residuo.tipo}
                      onChange={(e) => handleResiduoChange(index, 'tipo', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">Seleccionar tipo</option>
                      {residuosDisponibles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo} - {r.descripcion}
                        </option>
                      ))}
                    </select>
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
                <select
                  value={formData.transportista}
                  onChange={(e) => setFormData({ ...formData, transportista: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Seleccionar transportista</option>
                  {transportistas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.cuit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Operador / Destino *
                </label>
                <select
                  value={formData.operador}
                  onChange={(e) => setFormData({ ...formData, operador: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Seleccionar operador</option>
                  {operadores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} - {o.direccion}
                    </option>
                  ))}
                </select>
              </div>

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
                  leftIcon={isSubmitting ? undefined : <Save size={18} />}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Manifiesto'}
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

/**
 * SITREP v6 - Manifiesto Actions
 * ===============================
 * Workflow action buttons + confirmation dialogs for the manifiesto detail page.
 */

import React, { useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Download,
  PenTool,
  ClipboardCheck,
  Scale,
  Beaker,
  XCircle,
  Award,
  RotateCcw,
  Truck,
  CheckCircle,
  FlaskConical,
  Flame,
  Leaf,
  Recycle,
  Package,
  Microscope,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Button } from '../../../components/ui/ButtonV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SignaturePad } from '../../../components/ui/SignaturePad';
import { toast } from '../../../components/ui/Toast';
import { formatNumber, formatEstado } from '../../../utils/formatters';
import type { Manifiesto } from '../../../types/models';
import { EstadoManifiesto } from '../../../types/models';

const METODOS_TRATAMIENTO: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'INCINERACION', label: 'Incineración', icon: <Flame size={16} className="inline" /> },
  { id: 'TRATAMIENTO_FISICOQUIMICO', label: 'Fisicoquímico', icon: <FlaskConical size={16} className="inline" /> },
  { id: 'TRATAMIENTO_BIOLOGICO', label: 'Biológico', icon: <Leaf size={16} className="inline" /> },
  { id: 'RECICLADO', label: 'Reciclaje', icon: <Recycle size={16} className="inline" /> },
  { id: 'RELLENO_SEGURIDAD', label: 'Relleno seguridad', icon: <Package size={16} className="inline" /> },
  { id: 'OTRO', label: 'Otro', icon: <Microscope size={16} className="inline" /> },
];

const ESTADOS_FLUJO = [
  EstadoManifiesto.BORRADOR,
  EstadoManifiesto.PENDIENTE_APROBACION,
  EstadoManifiesto.APROBADO,
  EstadoManifiesto.EN_TRANSITO,
  EstadoManifiesto.ENTREGADO,
  EstadoManifiesto.RECIBIDO,
  EstadoManifiesto.EN_TRATAMIENTO,
  EstadoManifiesto.TRATADO,
];

function getEstadoBadgeColor(estado: EstadoManifiesto): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (estado) {
    case EstadoManifiesto.EN_TRANSITO: return 'info';
    case EstadoManifiesto.TRATADO:
    case EstadoManifiesto.RECIBIDO:
    case EstadoManifiesto.ENTREGADO: return 'success';
    case EstadoManifiesto.PENDIENTE_APROBACION:
    case EstadoManifiesto.EN_TRATAMIENTO: return 'warning';
    case EstadoManifiesto.RECHAZADO:
    case EstadoManifiesto.CANCELADO: return 'error';
    default: return 'neutral';
  }
}

interface MutationState {
  isPending: boolean;
}

interface ManifiestoActionsProps {
  manifiesto: Partial<Manifiesto>;
  manifiestoId: string;
  isAdmin: boolean;
  userRol: string;
  isActionPending: boolean;
  mutations: {
    firmar: MutationState;
    confirmarRetiro: MutationState;
    confirmarEntrega: MutationState;
    confirmarRecepcion: MutationState;
    pesaje: MutationState;
    registrarTratamiento: MutationState;
    cerrar: MutationState;
    rechazar: MutationState;
    registrarIncidente: MutationState;
    revertir: MutationState;
  };
  onFirmar: () => void;
  onConfirmarRetiro: () => void;
  onConfirmarEntrega: () => void;
  onConfirmarRecepcion: () => void;
  onPesaje: (residuos: { id: string; cantidadRecibida: number }[], observaciones?: string) => void;
  onTratamiento: (metodo: string, observaciones?: string) => void;
  onCerrar: () => void;
  onRechazar: (motivo: string, descripcion?: string) => void;
  onIncidente: (tipo: string, descripcion?: string) => void;
  onCancelar: () => void;
  onRevertir: (estadoNuevo: string, motivo?: string) => void;
  onDescargarPDF: () => void;
  onDescargarCertificado: () => void;
  isCancelling: boolean;
}

const ManifiestoActions: React.FC<ManifiestoActionsProps> = ({
  manifiesto: m,
  manifiestoId,
  isAdmin,
  userRol,
  isActionPending,
  mutations,
  onFirmar,
  onConfirmarRetiro,
  onConfirmarEntrega,
  onConfirmarRecepcion,
  onPesaje,
  onTratamiento,
  onCerrar,
  onRechazar,
  onIncidente,
  onCancelar,
  onRevertir,
  onDescargarPDF,
  onDescargarCertificado,
  isCancelling,
}) => {
  // Modal state for pesaje
  const [showPesajeModal, setShowPesajeModal] = useState(false);
  const [pesajeData, setPesajeData] = useState<Record<string, number>>({});
  const [pesajeObs, setPesajeObs] = useState('');

  // Modal state for tratamiento
  const [showTratamientoModal, setShowTratamientoModal] = useState(false);
  const [tratamientoMetodo, setTratamientoMetodo] = useState('');
  const [tratamientoObs, setTratamientoObs] = useState('');

  // Modal state for rechazar
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [rechazarDescripcion, setRechazarDescripcion] = useState('');

  // Modal state for incidente
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [incidenteTipo, setIncidenteTipo] = useState('');
  const [incidenteDescripcion, setIncidenteDescripcion] = useState('');

  // Cancel confirmation
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Modal state for reversion
  const [showReversionModal, setShowReversionModal] = useState(false);
  const [reversionEstado, setReversionEstado] = useState('');
  const [reversionMotivo, setReversionMotivo] = useState('');

  // Modal state for firma digital
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState('');

  const handlePesaje = () => {
    const residuosData = Object.entries(pesajeData).map(([resId, cant]) => ({
      id: resId,
      cantidadRecibida: cant,
    }));
    if (residuosData.length === 0) {
      toast.warning('Datos incompletos', 'Ingresa al menos un peso');
      return;
    }
    onPesaje(residuosData, pesajeObs || undefined);
    setShowPesajeModal(false);
  };

  const handleTratamiento = () => {
    if (!tratamientoMetodo) {
      toast.warning('Datos incompletos', 'Selecciona un metodo de tratamiento');
      return;
    }
    onTratamiento(tratamientoMetodo, tratamientoObs || undefined);
    setShowTratamientoModal(false);
  };

  const handleRechazar = () => {
    if (!rechazarMotivo) {
      toast.warning('Datos incompletos', 'Selecciona un motivo de rechazo');
      return;
    }
    onRechazar(rechazarMotivo, rechazarDescripcion || undefined);
    setShowRechazarModal(false);
    setRechazarMotivo('');
    setRechazarDescripcion('');
  };

  const handleIncidente = () => {
    if (!incidenteTipo) {
      toast.warning('Datos incompletos', 'Selecciona un tipo de incidente');
      return;
    }
    onIncidente(incidenteTipo, incidenteDescripcion || undefined);
    setShowIncidenteModal(false);
    setIncidenteTipo('');
    setIncidenteDescripcion('');
  };

  const handleRevertir = () => {
    if (!reversionEstado) {
      toast.warning('Datos incompletos', 'Selecciona un estado destino');
      return;
    }
    onRevertir(reversionEstado, reversionMotivo || undefined);
    setShowReversionModal(false);
    setReversionEstado('');
    setReversionMotivo('');
  };

  const handleFirmaConfirm = () => {
    onFirmar();
    setShowFirmaModal(false);
    setFirmaBase64('');
  };

  const handleCancelConfirm = () => {
    onCancelar();
    setShowCancelModal(false);
  };

  return (
    <>
      <Card>
        <CardHeader title="Acciones" />
        <CardContent>
          <div className="space-y-2 animate-fade-in">
            {/* State-based action buttons with role guards */}
            {m.estado === EstadoManifiesto.BORRADOR && (isAdmin || userRol === 'GENERADOR') && (
              <Button
                fullWidth
                leftIcon={mutations.firmar.isPending ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                onClick={() => setShowFirmaModal(true)}
                disabled={isActionPending}
              >
                Firmar Manifiesto
              </Button>
            )}

            {m.estado === EstadoManifiesto.APROBADO && (isAdmin || userRol === 'TRANSPORTISTA') && (
              <Button
                fullWidth
                leftIcon={mutations.confirmarRetiro.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                onClick={onConfirmarRetiro}
                disabled={isActionPending}
              >
                Confirmar Retiro
              </Button>
            )}

            {m.estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
              <Button
                fullWidth
                leftIcon={mutations.confirmarEntrega.isPending ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                onClick={onConfirmarEntrega}
                disabled={isActionPending}
              >
                Confirmar Entrega
              </Button>
            )}

            {m.estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
              <Button
                fullWidth
                variant="outline"
                leftIcon={mutations.registrarIncidente.isPending ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                onClick={() => setShowIncidenteModal(true)}
                disabled={isActionPending}
              >
                Registrar Incidente
              </Button>
            )}

            {m.estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
              <Button
                fullWidth
                leftIcon={mutations.confirmarRecepcion.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                onClick={onConfirmarRecepcion}
                disabled={isActionPending}
              >
                Confirmar Recepcion
              </Button>
            )}

            {m.estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
              <Button
                fullWidth
                variant="outline"
                leftIcon={mutations.rechazar.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                onClick={() => setShowRechazarModal(true)}
                disabled={isActionPending}
                className="!text-error-600 !border-error-200 hover:!bg-error-50"
              >
                Rechazar Carga
              </Button>
            )}

            {m.estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
              <Button
                fullWidth
                leftIcon={<Scale size={16} />}
                onClick={() => setShowPesajeModal(true)}
                disabled={isActionPending}
              >
                Registrar Pesaje
              </Button>
            )}

            {m.estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
              <Button
                fullWidth
                leftIcon={<Beaker size={16} />}
                onClick={() => setShowTratamientoModal(true)}
                disabled={isActionPending}
              >
                Registrar Tratamiento
              </Button>
            )}

            {(m.estado === EstadoManifiesto.EN_TRATAMIENTO || m.estado === EstadoManifiesto.RECIBIDO) && (isAdmin || userRol === 'OPERADOR') && (
              <Button
                fullWidth
                leftIcon={mutations.cerrar.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                onClick={onCerrar}
                disabled={isActionPending}
                className="!bg-success-600 hover:!bg-success-700"
              >
                Cerrar Manifiesto
              </Button>
            )}

            <Button variant="outline" fullWidth leftIcon={<Download size={16} />} onClick={onDescargarPDF}>
              Descargar PDF
            </Button>

            {m.estado === EstadoManifiesto.TRATADO && (
              <Button fullWidth leftIcon={<Award size={16} />} onClick={onDescargarCertificado} className="!bg-success-600 hover:!bg-success-700">
                Descargar Certificado
              </Button>
            )}

            {m.estado !== EstadoManifiesto.CANCELADO && m.estado !== EstadoManifiesto.TRATADO && (isAdmin || userRol === 'GENERADOR') && (
              <Button variant="danger" fullWidth leftIcon={<XCircle size={16} />} onClick={() => setShowCancelModal(true)}>
                Cancelar Manifiesto
              </Button>
            )}

            {isAdmin && m.estado !== EstadoManifiesto.BORRADOR && (
              <Button
                variant="outline"
                fullWidth
                leftIcon={<RotateCcw size={16} />}
                onClick={() => setShowReversionModal(true)}
                className="!text-amber-600 !border-amber-200 hover:!bg-amber-50"
              >
                Revertir Estado
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pesaje Modal */}
      {showPesajeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Scale size={20} /> Registrar Pesaje
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(m.residuos || []).map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{r.tipoResiduo?.nombre || r.descripcion || 'Residuo'}</p>
                    <p className="text-xs text-neutral-500">Declarado: {formatNumber(r.cantidad)} {r.unidad}</p>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="Peso real"
                      value={pesajeData[r.id] || ''}
                      onChange={(e) => setPesajeData({ ...pesajeData, [r.id]: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones</label>
              <textarea
                value={pesajeObs}
                onChange={(e) => setPesajeObs(e.target.value)}
                placeholder="Observaciones del pesaje..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowPesajeModal(false)} disabled={mutations.pesaje.isPending}>
                Cancelar
              </Button>
              <Button onClick={handlePesaje} disabled={mutations.pesaje.isPending}>
                {mutations.pesaje.isPending ? 'Registrando...' : 'Confirmar Pesaje'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tratamiento Modal */}
      {showTratamientoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Beaker size={20} /> Registrar Tratamiento
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Método de Tratamiento *</label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_TRATAMIENTO.map((met) => (
                    <button
                      key={met.id}
                      type="button"
                      onClick={() => setTratamientoMetodo(met.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        tratamientoMetodo === met.id
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="text-2xl">{met.icon}</span>
                      <span className={`text-xs font-medium ${
                        tratamientoMetodo === met.id ? 'text-primary-700' : 'text-neutral-600'
                      }`}>{met.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones</label>
                <textarea
                  value={tratamientoObs}
                  onChange={(e) => setTratamientoObs(e.target.value)}
                  placeholder="Observaciones del tratamiento..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowTratamientoModal(false)} disabled={mutations.registrarTratamiento.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleTratamiento} disabled={mutations.registrarTratamiento.isPending}>
                {mutations.registrarTratamiento.isPending ? 'Registrando...' : 'Confirmar Tratamiento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rechazar Modal */}
      {showRechazarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <XCircle size={20} className="text-error-500" /> Rechazar Carga
            </h3>
            <div className="space-y-3">
              <div>
                <Select
                  label="Motivo de rechazo *"
                  value={rechazarMotivo}
                  onChange={(val) => setRechazarMotivo(val)}
                  options={[
                    { value: 'documentacion_incompleta', label: 'Documentación incompleta' },
                    { value: 'carga_no_coincide', label: 'Carga no coincide con manifiesto' },
                    { value: 'residuo_no_autorizado', label: 'Residuo no autorizado' },
                    { value: 'capacidad_excedida', label: 'Capacidad excedida' },
                    { value: 'condiciones_inseguras', label: 'Condiciones inseguras' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                  placeholder="Seleccionar motivo"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  value={rechazarDescripcion}
                  onChange={(e) => setRechazarDescripcion(e.target.value)}
                  placeholder="Detalle del motivo de rechazo..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowRechazarModal(false)} disabled={mutations.rechazar.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRechazar} disabled={mutations.rechazar.isPending}>
                {mutations.rechazar.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incidente Modal */}
      {showIncidenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-warning-500" /> Registrar Incidente
            </h3>
            <div className="space-y-3">
              <div>
                <Select
                  label="Tipo de incidente *"
                  value={incidenteTipo}
                  onChange={(val) => setIncidenteTipo(val)}
                  options={[
                    { value: 'accidente', label: 'Accidente vehicular' },
                    { value: 'derrame', label: 'Derrame de residuos' },
                    { value: 'robo', label: 'Robo o asalto' },
                    { value: 'desvio', label: 'Desvío de ruta' },
                    { value: 'averia', label: 'Avería mecánica' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                  placeholder="Seleccionar tipo"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  value={incidenteDescripcion}
                  onChange={(e) => setIncidenteDescripcion(e.target.value)}
                  placeholder="Describe el incidente..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowIncidenteModal(false)} disabled={mutations.registrarIncidente.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleIncidente} disabled={mutations.registrarIncidente.isPending}>
                {mutations.registrarIncidente.isPending ? 'Registrando...' : 'Registrar Incidente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error-50 rounded-full flex items-center justify-center">
                <XCircle size={20} className="text-error-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Cancelar Manifiesto</h3>
                <p className="text-sm text-neutral-500">Esta accion no se puede deshacer</p>
              </div>
            </div>
            <p className="text-neutral-700 mb-6">
              Estas seguro de que deseas cancelar el manifiesto <span className="font-mono font-semibold">{m.numero || manifiestoId}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={isCancelling}>
                Volver
              </Button>
              <Button variant="danger" onClick={handleCancelConfirm} disabled={isCancelling}>
                {isCancelling ? 'Cancelando...' : 'Cancelar Manifiesto'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reversion Modal */}
      {showReversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <RotateCcw size={20} className="text-amber-500" /> Revertir Estado
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Estado actual: <Badge variant="soft" color={getEstadoBadgeColor(m.estado || EstadoManifiesto.BORRADOR)}>{formatEstado(m.estado || EstadoManifiesto.BORRADOR)}</Badge>
            </p>
            <div className="space-y-3">
              <div>
                <Select
                  label="Estado destino *"
                  value={reversionEstado}
                  onChange={(val) => setReversionEstado(val)}
                  options={ESTADOS_FLUJO
                    .filter((est) => {
                      const currentIdx = ESTADOS_FLUJO.indexOf(m.estado as EstadoManifiesto);
                      const estIdx = ESTADOS_FLUJO.indexOf(est);
                      return estIdx < currentIdx && estIdx >= 0;
                    })
                    .map((est) => ({
                      value: est,
                      label: formatEstado(est),
                    }))}
                  placeholder="Seleccionar estado"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={reversionMotivo}
                  onChange={(e) => setReversionMotivo(e.target.value)}
                  placeholder="Motivo de la reversión..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => { setShowReversionModal(false); setReversionEstado(''); setReversionMotivo(''); }} disabled={mutations.revertir.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleRevertir} disabled={mutations.revertir.isPending} className="!bg-amber-600 hover:!bg-amber-700">
                {mutations.revertir.isPending ? 'Revirtiendo...' : 'Confirmar Reversión'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Firma Digital Modal */}
      {showFirmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <PenTool size={20} className="text-primary-600" /> Firma Digital del Manifiesto
            </h3>

            {/* Resumen */}
            <div className="bg-neutral-50 rounded-xl p-4 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Manifiesto:</span>
                <span className="font-mono font-semibold text-neutral-900">{m.numero || manifiestoId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Generador:</span>
                <span className="text-neutral-900">{m.generador?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Transportista:</span>
                <span className="text-neutral-900">{m.transportista?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Operador:</span>
                <span className="text-neutral-900">{m.operador?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Fecha/Hora:</span>
                <span className="text-neutral-900">{new Date().toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Firma */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Firma del responsable</label>
              {firmaBase64 ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-xl border border-success-300 bg-success-50 p-2">
                    <img src={firmaBase64} alt="Firma" className="max-h-32" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFirmaBase64('')}
                    className="text-sm text-neutral-500 hover:text-neutral-700 underline"
                  >
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <SignaturePad
                  onConfirm={(dataUrl) => setFirmaBase64(dataUrl)}
                />
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowFirmaModal(false); setFirmaBase64(''); }} disabled={mutations.firmar.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleFirmaConfirm} disabled={mutations.firmar.isPending || !firmaBase64}>
                {mutations.firmar.isPending ? 'Firmando...' : 'Confirmar y Firmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManifiestoActions;

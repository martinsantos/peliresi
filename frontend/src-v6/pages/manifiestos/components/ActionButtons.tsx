/**
 * ManifiestoActions — Action Buttons
 * Renders the appropriate workflow buttons based on estado/role.
 */
import React from 'react';
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
  MapPin,
} from 'lucide-react';
import { Button } from '../../../components/ui/ButtonV2';
import { EstadoManifiesto } from '../../../types/models';

interface MutationState {
  isPending: boolean;
}

export interface ActionButtonsProps {
  estado: EstadoManifiesto | undefined;
  isAdmin: boolean;
  userRol: string;
  isActionPending: boolean;
  isInSitu?: boolean;
  isCancelling: boolean;
  mutations: {
    firmar: MutationState;
    confirmarRetiro: MutationState;
    confirmarEntrega: MutationState;
    confirmarRecepcion: MutationState;
    confirmarRecepcionInSitu: MutationState;
    registrarIncidente: MutationState;
    cerrar: MutationState;
  };
  onOpenFirmaModal: () => void;
  onConfirmarRetiro: () => void;
  onConfirmarEntrega: () => void;
  onConfirmarRecepcion: () => void;
  onConfirmarRecepcionInSitu: () => void;
  onOpenPesajeModal: () => void;
  onOpenTratamientoModal: () => void;
  onCerrar: () => void;
  onOpenRechazarModal: () => void;
  onOpenIncidenteModal: () => void;
  onOpenCancelModal: () => void;
  onOpenReversionModal: () => void;
  onDescargarPDF: () => void;
  onDescargarCertificado: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  estado,
  isAdmin,
  userRol,
  isActionPending,
  isInSitu,
  isCancelling,
  mutations,
  onOpenFirmaModal,
  onConfirmarRetiro,
  onConfirmarEntrega,
  onConfirmarRecepcion,
  onConfirmarRecepcionInSitu,
  onOpenPesajeModal,
  onOpenTratamientoModal,
  onCerrar,
  onOpenRechazarModal,
  onOpenIncidenteModal,
  onOpenCancelModal,
  onOpenReversionModal,
  onDescargarPDF,
  onDescargarCertificado,
}) => {
  return (
    <div className="space-y-2 animate-fade-in">
      {/* State-based action buttons with role guards */}
      {estado === EstadoManifiesto.BORRADOR && (isAdmin || userRol === 'GENERADOR') && (
        <Button
          fullWidth
          leftIcon={mutations.firmar.isPending ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
          onClick={onOpenFirmaModal}
          disabled={isActionPending}
        >
          Firmar Manifiesto
        </Button>
      )}

      {/* Confirmar Retiro — only for FIJO (transport required) */}
      {!isInSitu && estado === EstadoManifiesto.APROBADO && (isAdmin || userRol === 'TRANSPORTISTA') && (
        <Button
          fullWidth
          leftIcon={mutations.confirmarRetiro.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
          onClick={onConfirmarRetiro}
          disabled={isActionPending}
        >
          Confirmar Retiro
        </Button>
      )}

      {/* Confirmar Recepcion In Situ — APROBADO + no transportista */}
      {isInSitu && estado === EstadoManifiesto.APROBADO && (isAdmin || userRol === 'OPERADOR') && (
        <Button
          fullWidth
          leftIcon={mutations.confirmarRecepcionInSitu.isPending ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
          onClick={onConfirmarRecepcionInSitu}
          disabled={isActionPending}
          className="!bg-emerald-600 hover:!bg-emerald-700"
        >
          Confirmar Recepcion In Situ
        </Button>
      )}

      {/* Confirmar Entrega — only for FIJO */}
      {!isInSitu && estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
        <Button
          fullWidth
          leftIcon={mutations.confirmarEntrega.isPending ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
          onClick={onConfirmarEntrega}
          disabled={isActionPending}
        >
          Confirmar Entrega
        </Button>
      )}

      {/* Registrar Incidente — only for FIJO */}
      {!isInSitu && estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
        <Button
          fullWidth
          variant="outline"
          leftIcon={mutations.registrarIncidente.isPending ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
          onClick={onOpenIncidenteModal}
          disabled={isActionPending}
        >
          Registrar Incidente
        </Button>
      )}

      {estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
        <Button
          fullWidth
          leftIcon={mutations.confirmarRecepcion.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
          onClick={onConfirmarRecepcion}
          disabled={isActionPending}
        >
          Confirmar Recepcion
        </Button>
      )}

      {estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
        <Button
          fullWidth
          variant="outline"
          leftIcon={<XCircle size={16} />}
          onClick={onOpenRechazarModal}
          disabled={isActionPending}
          className="!text-error-600 !border-error-200 hover:!bg-error-50"
        >
          Rechazar Carga
        </Button>
      )}

      {estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
        <Button
          fullWidth
          leftIcon={<Scale size={16} />}
          onClick={onOpenPesajeModal}
          disabled={isActionPending}
        >
          Registrar Pesaje
        </Button>
      )}

      {estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
        <Button
          fullWidth
          leftIcon={<Beaker size={16} />}
          onClick={onOpenTratamientoModal}
          disabled={isActionPending}
        >
          Registrar Tratamiento
        </Button>
      )}

      {(estado === EstadoManifiesto.EN_TRATAMIENTO || estado === EstadoManifiesto.RECIBIDO) && (isAdmin || userRol === 'OPERADOR') && (
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

      {estado === EstadoManifiesto.TRATADO && (
        <Button fullWidth leftIcon={<Award size={16} />} onClick={onDescargarCertificado} className="!bg-success-600 hover:!bg-success-700">
          Descargar Certificado
        </Button>
      )}

      {estado !== EstadoManifiesto.CANCELADO && estado !== EstadoManifiesto.TRATADO && (isAdmin || userRol === 'GENERADOR') && (
        <Button variant="danger" fullWidth leftIcon={<XCircle size={16} />} onClick={onOpenCancelModal}>
          Cancelar Manifiesto
        </Button>
      )}

      {isAdmin && estado !== EstadoManifiesto.BORRADOR && (
        <Button
          variant="outline"
          fullWidth
          leftIcon={<RotateCcw size={16} />}
          onClick={onOpenReversionModal}
          className="!text-amber-600 !border-amber-200 hover:!bg-amber-50"
        >
          Revertir Estado
        </Button>
      )}
    </div>
  );
};

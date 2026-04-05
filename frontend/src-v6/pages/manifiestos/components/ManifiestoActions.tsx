/**
 * SITREP v6 - Manifiesto Actions
 * ===============================
 * Workflow action buttons + confirmation dialogs for the manifiesto detail page.
 * Controller/orchestrator: manages modal visibility state.
 * UI delegated to ActionButtons and ActionModals.
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import type { Manifiesto } from '../../../types/models';
import { ActionButtons } from './ActionButtons';
import { ActionModals } from './ActionModals';

interface MutationState {
  isPending: boolean;
}

interface ManifiestoActionsProps {
  manifiesto: Partial<Manifiesto>;
  manifiestoId: string;
  isAdmin: boolean;
  userRol: string;
  isActionPending: boolean;
  isInSitu?: boolean;
  mutations: {
    firmar: MutationState;
    confirmarRetiro: MutationState;
    confirmarEntrega: MutationState;
    confirmarRecepcion: MutationState;
    confirmarRecepcionInSitu: MutationState;
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
  onConfirmarRecepcionInSitu: () => void;
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
  isInSitu,
  mutations,
  onFirmar,
  onConfirmarRetiro,
  onConfirmarEntrega,
  onConfirmarRecepcion,
  onConfirmarRecepcionInSitu,
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
  // Modal visibility state (centralized here in the controller)
  const [showPesajeModal, setShowPesajeModal] = useState(false);
  const [showTratamientoModal, setShowTratamientoModal] = useState(false);
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReversionModal, setShowReversionModal] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);

  return (
    <>
      <Card>
        <CardHeader title="Acciones" />
        <CardContent>
          <ActionButtons
            estado={m.estado}
            isAdmin={isAdmin}
            userRol={userRol}
            isActionPending={isActionPending}
            isInSitu={isInSitu}
            isCancelling={isCancelling}
            mutations={{
              firmar: mutations.firmar,
              confirmarRetiro: mutations.confirmarRetiro,
              confirmarEntrega: mutations.confirmarEntrega,
              confirmarRecepcion: mutations.confirmarRecepcion,
              confirmarRecepcionInSitu: mutations.confirmarRecepcionInSitu,
              registrarIncidente: mutations.registrarIncidente,
              cerrar: mutations.cerrar,
            }}
            onOpenFirmaModal={() => setShowFirmaModal(true)}
            onConfirmarRetiro={onConfirmarRetiro}
            onConfirmarEntrega={onConfirmarEntrega}
            onConfirmarRecepcion={onConfirmarRecepcion}
            onConfirmarRecepcionInSitu={onConfirmarRecepcionInSitu}
            onOpenPesajeModal={() => setShowPesajeModal(true)}
            onOpenTratamientoModal={() => setShowTratamientoModal(true)}
            onCerrar={onCerrar}
            onOpenRechazarModal={() => setShowRechazarModal(true)}
            onOpenIncidenteModal={() => setShowIncidenteModal(true)}
            onOpenCancelModal={() => setShowCancelModal(true)}
            onOpenReversionModal={() => setShowReversionModal(true)}
            onDescargarPDF={onDescargarPDF}
            onDescargarCertificado={onDescargarCertificado}
          />
        </CardContent>
      </Card>

      <ActionModals
        manifiesto={m}
        manifiestoId={manifiestoId}
        isInSitu={isInSitu}
        mutations={{
          firmar: mutations.firmar,
          pesaje: mutations.pesaje,
          registrarTratamiento: mutations.registrarTratamiento,
          rechazar: mutations.rechazar,
          registrarIncidente: mutations.registrarIncidente,
          revertir: mutations.revertir,
        }}
        showPesajeModal={showPesajeModal}
        showTratamientoModal={showTratamientoModal}
        showRechazarModal={showRechazarModal}
        showIncidenteModal={showIncidenteModal}
        showCancelModal={showCancelModal}
        showReversionModal={showReversionModal}
        showFirmaModal={showFirmaModal}
        onClosePesaje={() => setShowPesajeModal(false)}
        onCloseTratamiento={() => setShowTratamientoModal(false)}
        onCloseRechazar={() => setShowRechazarModal(false)}
        onCloseIncidente={() => setShowIncidenteModal(false)}
        onCloseCancel={() => setShowCancelModal(false)}
        onCloseReversion={() => setShowReversionModal(false)}
        onCloseFirma={() => setShowFirmaModal(false)}
        onPesaje={onPesaje}
        onTratamiento={onTratamiento}
        onRechazar={onRechazar}
        onIncidente={onIncidente}
        onCancelar={onCancelar}
        onRevertir={onRevertir}
        onFirmar={onFirmar}
        isCancelling={isCancelling}
      />
    </>
  );
};

export default ManifiestoActions;

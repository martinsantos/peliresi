import { ManifestProposalApprovals } from './ManifestProposalApprovals';
/**
 * SITREP v6 - Manifiesto Actions
 * ===============================
 * Workflow action buttons + confirmation dialogs for the manifiesto detail page.
 * Controller/orchestrator: manages modal visibility state.
 * UI delegated to ActionButtons and ActionModals.
 */

import { ManifestNextStep } from '../../../components/ManifestNextStep';
import { ClipboardCheck } from 'lucide-react';
import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import type { Manifiesto } from '../../../types/models';
import { ActionButtons } from './ActionButtons';
import { ActionModals } from './ActionModals';
import { ConfirmManifestClosure } from './ConfirmManifestClosure';
import { manifestProposalsVisible } from '../../../utils/manifestFeatures';

interface MutationState {
  isPending: boolean;
}

interface ManifiestoActionsProps {
  manifiesto: Partial<Manifiesto>;
  manifiestoId: string;
  isAdmin: boolean;
  userRol: string;
  isActionPending: boolean;
  deliveryPending?: boolean;
  deliveryChecking?: boolean;
  deliveryCheckError?: boolean;
  onRetryDeliveryCheck?: () => void;
  isInSitu?: boolean;
  training?: boolean;
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
  onFirmar: (firma: string) => Promise<boolean>;
  onConfirmarRetiro: () => void;
  onConfirmarEntrega: () => void;
  onConfirmarRecepcion: () => void;
  onConfirmarRecepcionInSitu: () => void;
  onPesaje: (residuos: { id: string; cantidadRecibida: number }[], observaciones?: string) => Promise<boolean>;
  onTratamiento: (metodo: string, observaciones?: string) => Promise<boolean>;
  onCerrar: () => Promise<boolean>;
  onRechazar: (motivo: string, descripcion?: string) => Promise<boolean>;
  onIncidente: (tipo: string, descripcion: string) => Promise<boolean>;
  onCancelar: () => Promise<boolean>;
  onRevertir: (estadoNuevo: string, motivo?: string) => Promise<boolean>;
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
  deliveryPending,
  deliveryChecking,
  deliveryCheckError,
  onRetryDeliveryCheck,
  isInSitu,
  training,
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
  const [showCloseModal, setShowCloseModal] = useState(false);
  const legacyDraftBlocked = m.estado === 'BORRADOR' && !m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1') && manifestProposalsVisible({training});

  return (
    <>
      <Card>
        <CardHeader title="Acciones" icon={<ClipboardCheck size={22}/>} />
        <CardContent>
          {m.estado === 'BORRADOR' && !m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1') && <section aria-label="Estado del borrador" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <h3 className="font-bold">{legacyDraftBlocked ? 'Este borrador necesita una nueva propuesta' : isInSitu ? 'Tratamiento en origen · sin transporte' : 'Borrador pendiente de firma'}</h3>
            <p className="mt-1">{legacyDraftBlocked ? 'Creá una nueva propuesta con generador, transporte y operador. Las tres partes deben aprobar antes de iniciar; este borrador se conserva.' : 'El generador debe revisar y firmar para continuar. Todavía no se inició la operación.'}</p>
            {!legacyDraftBlocked && <p className="mt-1">{isInSitu ? 'Después de la firma, el operador podrá registrar la recepción in situ.' : 'Este borrador conserva el circuito anterior; no es una propuesta enviada para tres aprobaciones.'}</p>}
          </section>}
          {m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1') && <ManifestProposalApprovals id={manifiestoId} estado={m.estado} onSign={() => setShowFirmaModal(true)} />}
          {['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','CANCELADO','RECHAZADO'].includes(m.estado || '') && <div className="mb-4"><ManifestNextStep work={{estado:m.estado,modalidad:m.modalidad,pesajePendiente:m.residuos?.some(r=>!r.cantidadRecibida)}} role={userRol}/></div>}
          {deliveryPending && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Hay una entrega guardada en este dispositivo. Revisá la sincronización antes de continuar.</p>}
          {deliveryCheckError && <p role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-800">No pudimos revisar las entregas guardadas. <button type="button" className="font-semibold underline" onClick={onRetryDeliveryCheck}>Reintentar</button></p>}
          <ActionButtons
            pesajePendiente={m.residuos?.some(r=>!r.cantidadRecibida) ?? true}
            estado={m.estado}
            isAdmin={isAdmin}
            userRol={userRol}
            isActionPending={isActionPending}
            deliveryUnavailable={deliveryPending || deliveryChecking || deliveryCheckError}
            legacyDraftBlocked={legacyDraftBlocked}
            pickupBlocked={!!(m.estado === 'APROBADO' && m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1') && !m.eventos?.some(e=>['INICIO_COORDINACION','INICIO_COORDINACION_CAP'].includes(e.tipo)))}
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
            onCerrar={() => setShowCloseModal(true)}
            onOpenRechazarModal={() => setShowRechazarModal(true)}
            onOpenIncidenteModal={() => setShowIncidenteModal(true)}
            onOpenCancelModal={() => setShowCancelModal(true)}
            onOpenReversionModal={() => setShowReversionModal(true)}
            onDescargarPDF={onDescargarPDF}
            training={training}
            operatorCertificates={m.eventos?.some(e=>['CERTIFICACION_OPERADOR_V1','CERTIFICADO_OPERADOR_V1'].includes(e.tipo))}
            immutableProposal={m.eventos?.some(e => ['PROPUESTA_PARTES_V1','CERTIFICADO_OPERADOR_V1'].includes(e.tipo))}
            onDescargarCertificado={onDescargarCertificado}
          />
        </CardContent>
      </Card>

      <ConfirmManifestClosure open={showCloseModal} received={m.estado === 'RECIBIDO'} onClose={() => setShowCloseModal(false)} onConfirm={onCerrar} />

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

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
import { PendingIncidentNotice, type PendingIncidentNoticeProps } from '../../../components/manifiestos/PendingIncidentNotice';

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
  onRetryApprovalCheck?: () => void;
  incidentNotice?: PendingIncidentNoticeProps;
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
  onRetryApprovalCheck,
  incidentNotice,
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
  const legacyBlocked = ['BORRADOR','APROBADO'].includes(m.estado || '') && !m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1');
  const pendingWithoutProposal = m.estado === 'PENDIENTE_APROBACION' && !m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1');
  const inconsistentProposal = ['PENDIENTE_APROBACION','APROBADO'].includes(m.estado || '') && ['INCONSISTENTE','RECHAZADA'].includes(m.aprobacionOperacion || '');
  const originWithoutCarrier = m.estado === 'APROBADO' && !!isInSitu && !m.transportistaId;
  const proposalsVisible = manifestProposalsVisible({training});
  const pesajePendiente = Array.isArray(m.residuos) && m.residuos.length > 0 ? m.residuos.some(r => !r.cantidadRecibida) : undefined;
  const pesajeUnavailable = m.estado === 'RECIBIDO' && pesajePendiente === undefined;

  return (
    <>
      <Card>
        <CardHeader title="Acciones" icon={<ClipboardCheck size={22}/>} />
        <CardContent>
          {legacyBlocked && <section aria-label="Aprobaciones pendientes" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <h3 className="font-bold">Este manifiesto necesita una nueva propuesta</h3>
            <p className="mt-1">{proposalsVisible ? 'Creá una nueva propuesta con generador, transporte y operador.' : 'Contactá a Ambiente para habilitar una nueva propuesta con generador, transporte y operador.'} Las tres partes deben aprobar antes de iniciar; este registro se conserva.</p>
          </section>}
          {(pendingWithoutProposal || inconsistentProposal) && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">No se pueden comprobar las aprobaciones. Contactá a Ambiente para revisar este manifiesto; el historial se conserva y no se puede iniciar.</p>}
          {m.estado === 'APROBADO' && !m.aprobacionOperacion && !legacyBlocked && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">No se pudo verificar si están cumplidas las aprobaciones. Actualizá el manifiesto antes de continuar. {onRetryApprovalCheck && <button type="button" className="min-h-11 font-semibold underline" onClick={onRetryApprovalCheck}>Actualizar manifiesto</button>}</p>}
          {m.estado === 'APROBADO' && !proposalsVisible && !legacyBlocked && !inconsistentProposal && !originWithoutCarrier && m.aprobacionOperacion && m.aprobacionOperacion !== 'LISTA' && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">La operación todavía no está lista para iniciarse. Contactá a Ambiente para revisar las aprobaciones y la coordinación.</p>}
          {originWithoutCarrier && !legacyBlocked && !proposalsVisible && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Esta propuesta anterior no tiene transporte aprobador. Contactá a Ambiente para habilitar una nueva propuesta con las tres partes.</p>}
          {!inconsistentProposal && m.eventos?.some(e=>e.tipo==='PROPUESTA_PARTES_V1') && <ManifestProposalApprovals id={manifiestoId} estado={m.estado} onSign={() => setShowFirmaModal(true)} />}
          {!pesajeUnavailable && ['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','CANCELADO','RECHAZADO'].includes(m.estado || '') && <div className="mb-4"><ManifestNextStep work={{estado:m.estado,modalidad:m.modalidad,pesajePendiente}} role={userRol}/></div>}
          {pesajeUnavailable && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Pesaje por comprobar</p><p>No pudimos comprobar el pesaje. Actualizá el manifiesto y, si el problema continúa, consultá a Ambiente.</p>{onRetryApprovalCheck && <button type="button" className="min-h-11 font-semibold underline" onClick={onRetryApprovalCheck}>Actualizar manifiesto</button>}</div>}
          {deliveryPending && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Hay una entrega guardada en este dispositivo. Revisá la sincronización antes de continuar.</p>}
          {deliveryCheckError && <p role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-800">No pudimos revisar las entregas guardadas. <button type="button" className="font-semibold underline" onClick={onRetryDeliveryCheck}>Reintentar</button></p>}
          {!showIncidenteModal && incidentNotice && <div className="mb-4"><PendingIncidentNotice {...incidentNotice} /></div>}
          <ActionButtons
            pesajePendiente={pesajePendiente ?? true}
            pesajeUnavailable={pesajeUnavailable}
            estado={m.estado}
            isAdmin={isAdmin}
            userRol={userRol}
            isActionPending={isActionPending}
            deliveryUnavailable={deliveryPending || deliveryChecking || deliveryCheckError}
            incidentUnavailable={!!incidentNotice && (incidentNotice.checking || !!incidentNotice.pending || !!incidentNotice.storageError)}
            legacyDraftBlocked={legacyBlocked}
            pickupBlocked={m.estado === 'APROBADO' && m.aprobacionOperacion !== 'LISTA'}
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
        incidentNotice={incidentNotice}
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

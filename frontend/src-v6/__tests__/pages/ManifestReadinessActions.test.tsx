import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ManifiestoActions from '../../pages/manifiestos/components/ManifiestoActions';
import { EstadoManifiesto, type Manifiesto } from '../../types/models';

vi.mock('../../pages/manifiestos/components/ManifestProposalApprovals', () => ({ ManifestProposalApprovals: () => <div>Panel de aprobaciones</div> }));
const pending = { isPending: false };
const marker = [{ tipo: 'PROPUESTA_PARTES_V1' }] as NonNullable<Manifiesto['eventos']>;
const mutations = { firmar: pending, confirmarRetiro: pending, confirmarEntrega: pending, confirmarRecepcion: pending, confirmarRecepcionInSitu: pending, pesaje: pending, registrarTratamiento: pending, cerrar: pending, rechazar: pending, registrarIncidente: pending, revertir: pending };
function mount(manifiesto: Partial<Manifiesto>, role = 'TRANSPORTISTA', isInSitu = false) {
  const noop = vi.fn(), reload = vi.fn(), action = vi.fn();
  const view = render(<ManifiestoActions manifiesto={manifiesto} manifiestoId="qa" userRol={role} isAdmin={false} isActionPending={false} isCancelling={false} isInSitu={isInSitu} mutations={mutations}
    onRetryApprovalCheck={reload} onCerrar={noop} onFirmar={noop} onConfirmarRetiro={action} onConfirmarEntrega={noop} onConfirmarRecepcion={noop} onConfirmarRecepcionInSitu={action}
    onPesaje={noop} onTratamiento={noop} onRechazar={noop} onIncidente={noop} onCancelar={noop} onRevertir={noop} onDescargarPDF={noop} onDescargarCertificado={noop} />);
  return { ...view, reload, action };
}
describe('physical start uses the server readiness of the complete proposal', () => {
  it.each(['INCONSISTENTE', 'RECHAZADA', 'FALTAN_APROBACIONES', 'FALTA_COORDINACION', undefined] as const)('blocks pickup when readiness is %s', state => {
    const { action } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: state });
    const button = screen.getByRole('button', { name: 'Confirmar Retiro' });
    expect(button).toBeDisabled(); fireEvent.click(button); expect(action).not.toHaveBeenCalled();
    if (state === 'INCONSISTENTE' || state === 'RECHAZADA') expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
  });
  it('allows the action when the server verifies all decisions and coordination', () => {
    const { action } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: 'LISTA' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Retiro' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('also blocks in-situ receipt for an inconsistent proposal', () => {
    mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: 'INCONSISTENTE', transportistaId: 't' }, 'OPERADOR', true);
    expect(screen.getByRole('button', { name: 'Confirmar Recepcion In Situ' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
  });
  it('offers an explicit retry if readiness was not received', () => {
    const { reload } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar manifiesto' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it('directs a pending record without a proposal to review rather than displaying a fictitious approval', () => {
    mount({ estado: EstadoManifiesto.PENDIENTE_APROBACION, eventos: [] }, 'GENERADOR');
    expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
    expect(screen.queryByRole('button', { name: 'Firmar Manifiesto' })).not.toBeInTheDocument();
  });
});

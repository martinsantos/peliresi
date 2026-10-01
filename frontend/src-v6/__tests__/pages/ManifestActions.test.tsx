import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionButtons, type ActionButtonsProps } from '../../pages/manifiestos/components/ActionButtons';
import { EstadoManifiesto } from '../../types/models';

function input(estado: EstadoManifiesto, userRol: string, isInSitu = false): ActionButtonsProps {
  return {
    estado, userRol, isAdmin: userRol === 'ADMIN', isInSitu, isActionPending: false, isCancelling: false,
    mutations: { firmar: { isPending: false }, confirmarRetiro: { isPending: false }, confirmarEntrega: { isPending: false }, confirmarRecepcion: { isPending: false }, confirmarRecepcionInSitu: { isPending: false }, registrarIncidente: { isPending: false }, cerrar: { isPending: false } },
    onOpenFirmaModal: vi.fn(), onConfirmarRetiro: vi.fn(), onConfirmarEntrega: vi.fn(), onConfirmarRecepcion: vi.fn(), onConfirmarRecepcionInSitu: vi.fn(), onOpenPesajeModal: vi.fn(), onOpenTratamientoModal: vi.fn(), onCerrar: vi.fn(), onOpenRechazarModal: vi.fn(), onOpenIncidenteModal: vi.fn(), onOpenCancelModal: vi.fn(), onOpenReversionModal: vi.fn(), onDescargarPDF: vi.fn(), onDescargarCertificado: vi.fn(),
  };
}
const workflows = [
  [EstadoManifiesto.BORRADOR, 'GENERADOR', 'Firmar Manifiesto', 'onOpenFirmaModal', false],
  [EstadoManifiesto.APROBADO, 'TRANSPORTISTA', 'Confirmar Retiro', 'onConfirmarRetiro', false],
  [EstadoManifiesto.APROBADO, 'OPERADOR', 'Confirmar Recepcion In Situ', 'onConfirmarRecepcionInSitu', true],
  [EstadoManifiesto.EN_TRANSITO, 'TRANSPORTISTA', 'Confirmar Entrega', 'onConfirmarEntrega', false],
  [EstadoManifiesto.EN_TRANSITO, 'TRANSPORTISTA', 'Registrar Incidente', 'onOpenIncidenteModal', false],
  [EstadoManifiesto.ENTREGADO, 'OPERADOR', 'Confirmar Recepcion', 'onConfirmarRecepcion', false],
  [EstadoManifiesto.ENTREGADO, 'OPERADOR', 'Rechazar Carga', 'onOpenRechazarModal', false],
  [EstadoManifiesto.RECIBIDO, 'OPERADOR', 'Registrar Pesaje', 'onOpenPesajeModal', false],
  [EstadoManifiesto.RECIBIDO, 'OPERADOR', 'Registrar Tratamiento', 'onOpenTratamientoModal', false],
  [EstadoManifiesto.EN_TRATAMIENTO, 'OPERADOR', 'Cerrar Manifiesto', 'onCerrar', false],
  [EstadoManifiesto.TRATADO, 'OPERADOR', 'Descargar Certificado', 'onDescargarCertificado', false],
] as const;
describe('manifest workflow actions', () => {
  it.each(workflows)('%s / %s exposes and wires %s', (estado, role, name, handler, inSitu) => {
    const props = input(estado, role, inSitu);
    render(<ActionButtons {...props} />);
    fireEvent.click(screen.getByRole('button', { name, exact: true }));
    expect(props[handler]).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button', { name: 'Descargar PDF', exact: true })).toHaveLength(1);
  });
  it.each(workflows.slice(0, -1))('%s protects %s workflow controls from an unrelated viewer', (estado, _role, name, _handler, inSitu) => {
    render(<ActionButtons {...input(estado, 'AUDITOR', inSitu)} />);
    expect(screen.queryByRole('button', { name, exact: true })).not.toBeInTheDocument();
  });
  it('blocks cancellation and reversion during another mutation', () => {
    const props = input(EstadoManifiesto.APROBADO, 'ADMIN');
    render(<ActionButtons {...props} isActionPending />);
    expect(screen.getByRole('button', { name: 'Cancelar Manifiesto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revertir Estado' })).toBeDisabled();
  });
  it.each([EstadoManifiesto.TRATADO, EstadoManifiesto.CANCELADO])('does not offer cancellation from %s', estado => {
    render(<ActionButtons {...input(estado, 'ADMIN')} />);
    expect(screen.queryByRole('button', { name: 'Cancelar Manifiesto' })).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionModals, type ActionModalsProps } from '../../pages/manifiestos/components/ActionModals';
import { EstadoManifiesto } from '../../types/models';

vi.mock('../../services/api', () => ({ api: { get: vi.fn().mockResolvedValue({ data: { data: { tratamientos: [] } } }) } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

function defaults(): ActionModalsProps {
  return {
    manifiesto: { numero: 'QA-2026-000001', estado: EstadoManifiesto.TRATADO, residuos: [{ id: 'r1', cantidad: 10, unidad: 'kg' }] as any }, manifiestoId: 'qa',
    mutations: { firmar: { isPending: false }, pesaje: { isPending: false }, registrarTratamiento: { isPending: false }, rechazar: { isPending: false }, registrarIncidente: { isPending: false }, revertir: { isPending: false } },
    showFirmaModal: false, showPesajeModal: false, showTratamientoModal: false, showRechazarModal: false, showIncidenteModal: false, showCancelModal: false, showReversionModal: false,
    onCloseFirma: vi.fn(), onClosePesaje: vi.fn(), onCloseTratamiento: vi.fn(), onCloseRechazar: vi.fn(), onCloseIncidente: vi.fn(), onCloseCancel: vi.fn(), onCloseReversion: vi.fn(),
    onFirmar: vi.fn().mockResolvedValue(true), onPesaje: vi.fn().mockResolvedValue(true), onTratamiento: vi.fn().mockResolvedValue(true), onRechazar: vi.fn().mockResolvedValue(true), onIncidente: vi.fn().mockResolvedValue(true), onCancelar: vi.fn().mockResolvedValue(true), onRevertir: vi.fn().mockResolvedValue(true), isCancelling: false,
  };
}
const cases = [
  { show: 'showPesajeModal', action: 'onPesaje', close: 'onClosePesaje', confirm: 'Confirmar Pesaje', fill: () => fireEvent.change(screen.getByPlaceholderText('Peso real'), { target: { value: '7.5' } }), saved: '7.5' },
  { show: 'showTratamientoModal', action: 'onTratamiento', close: 'onCloseTratamiento', confirm: 'Confirmar Tratamiento', fill: () => { fireEvent.click(screen.getByRole('button', { name: /Incineración/ })); fireEvent.change(screen.getByPlaceholderText('Observaciones del tratamiento...'), { target: { value: 'QA conservar tratamiento' } }); }, saved: 'QA conservar tratamiento' },
  { show: 'showRechazarModal', action: 'onRechazar', close: 'onCloseRechazar', confirm: 'Confirmar Rechazo', fill: () => { fireEvent.click(screen.getByRole('button', { name: 'Motivo de rechazo *' })); fireEvent.click(screen.getByRole('option', { name: 'Carga no coincide con manifiesto' })); fireEvent.change(screen.getByPlaceholderText('Detalle del motivo de rechazo...'), { target: { value: 'QA conservar rechazo' } }); }, saved: 'QA conservar rechazo' },
  { show: 'showIncidenteModal', action: 'onIncidente', close: 'onCloseIncidente', confirm: 'Registrar Incidente', fill: () => { fireEvent.click(screen.getByRole('button', { name: 'Tipo de incidente *' })); fireEvent.click(screen.getByRole('option', { name: 'Avería mecánica' })); fireEvent.change(screen.getByPlaceholderText('Describe el incidente...'), { target: { value: 'QA conservar incidente' } }); }, saved: 'QA conservar incidente' },
  { show: 'showReversionModal', action: 'onRevertir', close: 'onCloseReversion', confirm: 'Confirmar Reversión', fill: () => { fireEvent.click(screen.getByRole('button', { name: 'Estado destino *' })); fireEvent.click(screen.getByRole('option', { name: 'Aprobado' })); fireEvent.change(screen.getByPlaceholderText('Motivo de la reversión...'), { target: { value: 'QA conservar motivo' } }); }, saved: 'QA conservar motivo' },
  { show: 'showCancelModal', action: 'onCancelar', close: 'onCloseCancel', confirm: 'Cancelar Manifiesto', fill: () => {}, saved: undefined },
] as const;

describe('manifest action dialogs do not discard unconfirmed work', () => {
  for (const item of cases) {
    it.each(['unconfirmed', 'rejected'])(`${item.action} retains the form when %s`, async mode => {
      const input = defaults();
      input[item.show] = true;
      const callback = vi.fn(() => mode === 'rejected' ? Promise.reject(new Error('network')) : Promise.resolve(false));
      Object.assign(input, { [item.action]: callback });
      render(<ActionModals {...input} />);
      item.fill();
      fireEvent.click(screen.getByRole('button', { name: item.confirm, exact: true }));
      await waitFor(() => expect(callback).toHaveBeenCalledOnce());
      await waitFor(() => expect(screen.getByRole('button', { name: item.confirm, exact: true })).toBeEnabled());
      expect(input[item.close]).not.toHaveBeenCalled();
      if (item.saved) expect(screen.getByDisplayValue(item.saved)).toBeInTheDocument();
    });
    it(`${item.action} waits for success and rejects repeated taps`, async () => {
      const input = defaults();
      input[item.show] = true;
      let resolve!: (value: boolean) => void;
      const callback = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
      Object.assign(input, { [item.action]: callback });
      render(<ActionModals {...input} />);
      item.fill();
      const button = screen.getByRole('button', { name: item.confirm, exact: true });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(callback).toHaveBeenCalledOnce();
      expect(input[item.close]).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
      resolve(true);
      await waitFor(() => expect(input[item.close]).toHaveBeenCalledOnce());
    });
  }
});

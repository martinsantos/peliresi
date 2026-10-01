import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionModals, type ActionModalsProps } from '../../pages/manifiestos/components/ActionModals';

const signature = 'data:image/png;base64,cXVhc2lnbmF0dXJl';
// Unit-only capture adapter. The browser suite draws on the real canvas and calls the real API.
vi.mock('../../components/ui/SignaturePad', () => ({ SignaturePad: ({ onConfirm }: { onConfirm: (value: string) => void }) =>
  <button onClick={() => onConfirm(signature)}>Capturar firma QA</button> }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

function props(onFirmar: ActionModalsProps['onFirmar']): ActionModalsProps {
  return {
    manifiesto: { numero: 'QA-2026-000001' }, manifiestoId: 'qa',
    mutations: { firmar: { isPending: false }, pesaje: { isPending: false }, registrarTratamiento: { isPending: false }, rechazar: { isPending: false }, registrarIncidente: { isPending: false }, revertir: { isPending: false } },
    showFirmaModal: true, showPesajeModal: false, showTratamientoModal: false, showRechazarModal: false, showIncidenteModal: false, showCancelModal: false, showReversionModal: false,
    onCloseFirma: vi.fn(), onClosePesaje: vi.fn(), onCloseTratamiento: vi.fn(), onCloseRechazar: vi.fn(), onCloseIncidente: vi.fn(), onCloseCancel: vi.fn(), onCloseReversion: vi.fn(),
    onFirmar, onPesaje: vi.fn(), onTratamiento: vi.fn(), onRechazar: vi.fn(), onIncidente: vi.fn(), onCancelar: vi.fn(), onRevertir: vi.fn(), isCancelling: false,
  };
}
describe('manifest handwritten signature', () => {
  it('sends the captured image and closes only after server confirmation', async () => {
    let resolve!: (value: boolean) => void;
    const onFirmar = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const input = props(onFirmar);
    render(<ActionModals {...input} />);
    expect(screen.getByRole('button', { name: 'Confirmar y Firmar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma QA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Firmar' }));
    expect(onFirmar).toHaveBeenCalledExactlyOnceWith(signature);
    expect(input.onCloseFirma).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmando...' })).toBeDisabled();
    resolve(true);
    await waitFor(() => expect(input.onCloseFirma).toHaveBeenCalledOnce());
  });
  it.each(['rejected', 'unconfirmed'])('retains the image when save is %s', async mode => {
    const onFirmar = vi.fn(() => mode === 'rejected' ? Promise.reject(new Error('network')) : Promise.resolve(false));
    const input = props(onFirmar);
    render(<ActionModals {...input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma QA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Firmar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar y Firmar' })).toBeEnabled());
    expect(input.onCloseFirma).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Firma', exact: true })).toHaveAttribute('src', signature);
  });
});

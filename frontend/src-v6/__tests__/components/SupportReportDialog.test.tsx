import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ create: vi.fn(), sent: vi.fn(), navigate: vi.fn(), user: { id: 'owner', nombre: 'Usuario', rol: 'GENERADOR' }, impersonation: null as unknown }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: mocks.impersonation, exitImpersonation: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useMobilePrefix', () => ({ useMobilePrefix: () => (value: string) => value }));
vi.mock('../../services/support.service', () => ({ supportService: { create: mocks.create, sent: mocks.sent }, supportError: () => 'No se confirmó el envío.' }));
import { SupportReportDialog } from '../../components/SupportReportDialog';
const fill = () => {
  fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'No abre el manifiesto' } });
  fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'El detalle queda vacío después de entrar.' } });
};
describe('report problem preserves the human workflow', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.user.id = 'owner'; mocks.impersonation = null; mocks.create.mockResolvedValue({ id: 'ticket' }); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
  it('keeps a timeout request frozen, retries the same key and clears only after acknowledgement', async () => {
    mocks.create.mockRejectedValueOnce(new Error('timeout'));
    render(<SupportReportDialog open onClose={vi.fn()} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await screen.findByText('Envío pendiente de confirmación. El texto se conserva sin cambios.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar ticket' })).not.toBeDisabled());
    expect(screen.getByLabelText('Asunto')).toBeDisabled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/soporte/ticket'));
    expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toBeNull();
  });
  it('lets a user close without submitting or losing the locally saved text', async () => {
    const close = vi.fn(); render(<SupportReportDialog open onClose={close} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar luego' }));
    expect(close).toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('does not claim delivery or call the network while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<SupportReportDialog open onClose={vi.fn()} />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket' }));
    await screen.findByRole('alert'); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('sitrep-soporte:v1:owner')).toContain('No abre el manifiesto');
  });
  it('does not send a human administrator report under an impersonated customer', () => {
    mocks.impersonation = { adminUser: { id: 'admin' } };
    render(<SupportReportDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Volver a mi sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar ticket' })).not.toBeInTheDocument();
  });
  it('does not leak the previous account draft after a role/session switch', () => {
    const { rerender } = render(<SupportReportDialog open onClose={vi.fn()} />); fill(); mocks.user.id = 'second-owner';
    rerender(<SupportReportDialog open onClose={vi.fn()} />); expect(screen.getByLabelText('Asunto')).toHaveValue('');
  });
});

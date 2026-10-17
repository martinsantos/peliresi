import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prefs: {} as Record<string, unknown>, put: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }, auth: { currentUser: { id: 7, nombre: 'QA Generador', email: 'qa@night-qa.invalid', rol: 'GENERADOR' }, isAdmin: false } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../services/auth.service', () => ({ authService: { getMe: () => Promise.resolve(mocks.prefs), changePassword: vi.fn() } }));
vi.mock('../../components/ui/Toast', () => ({ toast: mocks.toast, ToastContainer: () => null }));
vi.mock('../../services/api', () => ({ default: { put: mocks.put } }));
vi.mock('../../hooks/usePWAInstall', () => ({ usePWAInstall: () => ({ canInstall: false, isInstalled: false, isIOS: false, install: vi.fn() }) }));
vi.mock('../../components/InstallPWAButton', () => ({ InstallPWAButton: () => null }));
import ConfiguracionPage from '../../pages/configuracion/ConfiguracionPage';

const view = () => render(<MemoryRouter initialEntries={['/configuracion?tab=notificaciones']}><ConfiguracionPage /></MemoryRouter>);

describe('Notification channels that do not deliver are not offered', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.put.mockResolvedValue({ data: { success: true } }); });
  it('shows no WhatsApp or Telegram switch when they are off', async () => {
    mocks.prefs = { notifEmail: true, notifWhatsapp: false, notifTelegram: false };
    view();
    expect(await screen.findByText('Recibir alertas por email')).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument();
  });
  it('lets a stored WhatsApp opt-in be turned off without offering to turn it on', async () => {
    mocks.prefs = { notifEmail: true, notifWhatsapp: true, notifTelegram: false };
    view();
    const off = await screen.findByRole('button', { name: 'Desactivar WhatsApp' });
    expect(screen.getByRole('status')).toHaveTextContent('WhatsApp todavía no envía avisos');
    fireEvent.click(off);
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/admin/preferencias-notificacion', { notifWhatsapp: false }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Desactivar WhatsApp' })).not.toBeInTheDocument());
  });
});

import { authService } from '../../services/auth.service';
describe('Password change follows the server rule and shows its reason', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.prefs = {}; });
  const fill = async () => {
    render(<MemoryRouter initialEntries={['/configuracion?tab=seguridad']}><ConfiguracionPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'Actual-2026' } });
  };
  it('applies the server strength rule before sending', async () => {
    await fill();
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'abcdefgh' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'abcdefgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(authService.changePassword).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith('Error', 'La contraseña debe contener al menos una mayúscula');
  });
  it('sends once and shows the server reason instead of blaming the current password', async () => {
    let finish: (value: unknown) => void = () => undefined;
    vi.mocked(authService.changePassword).mockImplementation(() => new Promise((_, reject) => { finish = reject; }));
    await fill();
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Nueva-2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Nueva-2026' } });
    const submit = screen.getByRole('button', { name: 'Cambiar contraseña' });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(authService.changePassword).toHaveBeenCalledTimes(1);
    finish({ isAxiosError: true, response: { data: { message: 'La contraseña cambió durante la operación. Volvé a iniciar sesión.' } } });
    await waitFor(() => expect(submit).not.toBeDisabled());
    expect(mocks.toast.error).toHaveBeenCalledWith('Error', 'La contraseña cambió durante la operación. Volvé a iniciar sesión.');
  });
});

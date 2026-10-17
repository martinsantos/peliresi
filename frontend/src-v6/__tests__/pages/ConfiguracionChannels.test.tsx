import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prefs: {} as Record<string, unknown>, put: vi.fn(), auth: { currentUser: { id: 7, nombre: 'QA Generador', email: 'qa@night-qa.invalid', rol: 'GENERADOR' }, isAdmin: false } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../services/auth.service', () => ({ authService: { getMe: () => Promise.resolve(mocks.prefs), changePassword: vi.fn() } }));
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

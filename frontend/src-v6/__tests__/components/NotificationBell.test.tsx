import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../../components/NotificationBell';

const service = vi.hoisted(() => ({ list: vi.fn(), marcarLeida: vi.fn() }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: service }));
vi.mock('../../services/api', () => ({ getAccessToken: () => 'unit-token' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'inspector' } }) }));
const notice = { id: 'notice', titulo: 'Inspección asignada · GRP-2026-00001', mensaje: 'Visita programada', leida: false, tipo: 'INFO_GENERAL', createdAt: new Date().toISOString(), datos: JSON.stringify({ inspeccionId: 'assigned' }) };
function Path() { return <output data-testid="path">{useLocation().pathname}</output>; }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><NotificationBell basePath="/app" /><Path /></MemoryRouter></QueryClientProvider>);
  return client;
}
describe('assignment notification delivery', () => {
  beforeEach(() => { service.list.mockReset().mockResolvedValue({ items: [], noLeidas: 0 }); service.marcarLeida.mockReset().mockResolvedValue({}); });
  it('uses the same support symbol and opens its native ticket', async () => {
    service.list.mockResolvedValue({ items: [{ ...notice, titulo: 'Ticket derivado a tu atención', datos: JSON.stringify({ tipo: 'soporte', ruta: '/soporte/native-ticket' }) }], noLeidas: 1 });
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Notificaciones', exact: true }));
    const title = await screen.findByText('Ticket derivado a tu atención');
    expect(title.closest('button')?.querySelector('svg.lucide-life-buoy')).not.toBeNull();
    fireEvent.click(title); await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/app/soporte/native-ticket'));
  });

  it('refreshes on opening so a newly assigned visit does not wait for the polling interval', async () => {
    const client = setup();
    await waitFor(() => expect(client.getQueryState(['notificaciones', 'bell', 'inspector'])?.status).toBe('success'));
    service.list.mockResolvedValue({ items: [notice], noLeidas: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones', exact: true }));
    expect(await screen.findByText(notice.titulo)).toBeVisible();
  });

  it('does not present a failed request as an empty inbox and offers retry', async () => {
    service.list.mockRejectedValue(new Error('offline'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron actualizar los avisos');
    expect(screen.queryByText('No hay notificaciones pendientes')).toBeNull();
    service.list.mockResolvedValue({ items: [notice], noLeidas: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar', exact: true }));
    expect(await screen.findByText(notice.titulo)).toBeVisible();
  });

  it('navigates to the assigned dossier even if acknowledging the notice fails', async () => {
    service.list.mockResolvedValue({ items: [notice], noLeidas: 1 });
    service.marcarLeida.mockRejectedValue(new Error('offline'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }));
    fireEvent.click(await screen.findByText(notice.titulo));
    expect(screen.getByTestId('path')).toHaveTextContent('/app/inspecciones/assigned');
    await waitFor(() => expect(service.marcarLeida).toHaveBeenCalledWith('notice'));
  });

  it('refreshes the unread count only after the acknowledgement completes', async () => {
    service.list.mockResolvedValue({ items: [notice], noLeidas: 1 });
    let finish!: () => void;
    service.marcarLeida.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }));
    fireEvent.click(await screen.findByText(notice.titulo));
    await waitFor(() => expect(service.marcarLeida).toHaveBeenCalled());
    const calls = service.list.mock.calls.length;
    service.list.mockResolvedValue({ items: [{ ...notice, leida: true }], noLeidas: 0 });
    finish();
    await waitFor(() => expect(service.list.mock.calls.length).toBeGreaterThan(calls));
    expect(await screen.findByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible();
  });

  it('keeps the true unread count in its accessible label above 99', async () => {
    service.list.mockResolvedValue({ items: [notice], noLeidas: 140 });
    setup();
    expect(await screen.findByRole('button', { name: 'Notificaciones (140 sin leer)', exact: true })).toBeVisible();
  });
  it('uses the readable inverse error token for the small unread counter', async () => {
    service.list.mockResolvedValue({ items: [notice], noLeidas: 140 });
    setup();
    const counter = await screen.findByText('9+', { exact: true });
    // Contract only: real computed contrast is measured separately in E2E.
    expect(counter).toHaveClass('bg-error-700', 'text-white');
    expect(screen.getByRole('button', { name: 'Notificaciones (140 sin leer)', exact: true })).toBeVisible();
  });
});

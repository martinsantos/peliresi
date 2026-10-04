import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useHref, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificacionesPage from '../../pages/notificaciones/NotificacionesPage';

const service = vi.hoisted(() => ({ list: vi.fn(), marcarLeida: vi.fn(), marcarTodasLeidas: vi.fn(), eliminar: vi.fn() }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: service }));
const notice = { id: 'notice', titulo: 'Inspección asignada · GRP-2026-00001', mensaje: 'Visita programada', leida: false, tipo: 'INFO_GENERAL', prioridad: 'NORMAL', createdAt: '2026-10-01T12:00:00Z', datos: JSON.stringify({ inspeccionId: 'assigned' }) };
const response = { items: [notice], total: 45, noLeidas: 31, page: 1, limit: 20, totalPages: 3 };
function Location() {
  const location = useLocation(), navigate = useNavigate();
  const href = useHref(location.pathname + location.search);
  return <><span data-testid="location">{href}</span><button onClick={() => navigate(-1)}>Test atrás</button></>;
}
function setup(path = '/notificaciones') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter basename={path.startsWith('/app/') ? '/app' : '/'} initialEntries={[path]}><NotificacionesPage /><Location /></MemoryRouter></QueryClientProvider>);
  return client;
}
describe('notification inbox states and interaction', () => {
  beforeEach(() => {
    service.list.mockReset().mockResolvedValue(response);
    for (const mutation of [service.marcarLeida, service.marcarTodasLeidas, service.eliminar]) mutation.mockReset().mockResolvedValue({});
  });
  it('does not reuse a supposedly fresh minute-old workflow state when reopening the inbox', async () => {
    const client = setup();
    await screen.findByText(notice.titulo);
    const query = client.getQueryCache().find({ queryKey: ['notificaciones', 'list'], exact: false });
    expect(query?.isStale()).toBe(true);
  });
  it('uses the current linked case resolution without claiming the manifest itself was closed', async () => {
    service.list.mockResolvedValue({ ...response, items: [{ ...notice,
      titulo: 'Seguimiento de manifiesto', manifiestoId: 'qa-manifest', seguimientoEstado: 'RESUELTA',
      datos: JSON.stringify({ tipo: 'seguimiento_cierre', version: 1, casoId: 'case' }),
      manifiesto: { numero: 'QA', estado: 'RECIBIDO' },
    }] });
    setup(); expect(await screen.findByText('Caso resuelto · Ver manifiesto e historial')).toBeVisible();
    expect(screen.queryByText('Seguimiento finalizado · Ver historial')).toBeNull();
  });

  it('keeps a closed follow-up as history rather than a current pending task and opens its actual manifest', async () => {
    service.list.mockResolvedValue({ ...response, items: [{ ...notice,
      titulo: 'Seguimiento de manifiesto', mensaje: 'QA seguimiento recibido hace 3 días', manifiestoId: 'qa-manifest',
      datos: JSON.stringify({ tipo: 'seguimiento_cierre', version: 1, estadoDetectado: 'RECIBIDO' }),
      manifiesto: { numero: 'QA', estado: 'TRATADO' },
    }] });
    setup('/app/notificaciones');
    expect(await screen.findByText('Seguimiento finalizado · Ver historial')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir aviso: Seguimiento de manifiesto', exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/app/manifiestos/qa-manifest');
  });

  it('does not promise an opening destination for a general notice without a linked record', async () => {
    service.list.mockResolvedValue({ ...response, items: [{ ...notice, titulo: 'Aviso general', datos: null }] });
    setup();
    expect(await screen.findByText('Aviso general')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Abrir aviso: Aviso general', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída: Aviso general', exact: true }));
    await waitFor(() => expect(service.marcarLeida).toHaveBeenCalledWith('notice'));
    expect(screen.getByTestId('location')).toHaveTextContent('/notificaciones');
  });

  it('distinguishes loading from an empty inbox', async () => {
    let finish!: (value: typeof response) => void;
    service.list.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando avisos');
    expect(screen.queryByText('No hay notificaciones')).toBeNull();
    await act(async () => finish(response));
    expect(await screen.findByText(notice.titulo)).toBeVisible();
  });

  it('offers recovery after a failed request instead of claiming there are no notices', async () => {
    service.list.mockRejectedValue(new Error('offline'));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los avisos');
    expect(screen.queryByText('No hay notificaciones')).toBeNull();
    service.list.mockResolvedValue(response);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar', exact: true }));
    expect(await screen.findByText(notice.titulo)).toBeVisible();
  });

  it('shows the global unread count and navigates to older real pages', async () => {
    service.list.mockImplementation(async (filters: { page?: number }) => ({ ...response, page: filters.page ?? 1, items: [{ ...notice, titulo: filters.page === 2 ? 'Aviso anterior' : notice.titulo }] }));
    setup();
    expect(await screen.findByRole('button', { name: 'No leídas (31)', exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente página', exact: true }));
    expect(await screen.findByText('Aviso anterior')).toBeVisible();
    expect(service.list).toHaveBeenLastCalledWith({ page: 2, limit: 20, leida: undefined });
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=2');
    fireEvent.click(screen.getByRole('button', { name: 'Test atrás', exact: true }));
    expect(await screen.findByText(notice.titulo)).toBeVisible();
  });

  it('resets pagination when switching to unread and preserves back navigation', async () => {
    setup('/notificaciones?pagina=2');
    await screen.findByText(notice.titulo);
    fireEvent.click(screen.getByRole('button', { name: 'No leídas (31)', exact: true }));
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ page: 1, limit: 20, leida: false }));
    expect(screen.getByTestId('location')).toHaveTextContent('avisos=sin-leer');
    expect(screen.getByTestId('location')).not.toHaveTextContent('pagina=2');
  });

  it('opens an assignment via the whole native button despite acknowledgement failure', async () => {
    service.marcarLeida.mockRejectedValue(new Error('offline'));
    setup('/app/notificaciones');
    fireEvent.click(await screen.findByRole('button', { name: `Abrir aviso: ${notice.titulo}`, exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/app/inspecciones/assigned');
    await waitFor(() => expect(service.marcarLeida).toHaveBeenCalledWith('notice'));
  });

  it('reports mutation failure and keeps the notice available', async () => {
    service.marcarLeida.mockRejectedValue(new Error('offline'));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: `Marcar como leída: ${notice.titulo}`, exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio');
    expect(screen.getByText(notice.titulo)).toBeVisible();
  });

  it('only shows empty after a successful response', async () => {
    service.list.mockResolvedValue({ ...response, items: [], total: 0, noLeidas: 0, totalPages: 0 });
    setup();
    expect(await screen.findByText('No hay notificaciones')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Marcar todas leídas', exact: true })).toBeNull();
  });

  it('returns to the real last unread page after acknowledging its final notice', async () => {
    let read = false;
    service.list.mockImplementation(async (filters: { page?: number }) => ({
      ...response, page: filters.page, items: read && filters.page === 2 ? [] : [notice],
      total: read ? 20 : 21, totalPages: read ? 1 : 2,
    }));
    service.marcarLeida.mockImplementation(async () => { read = true; });
    setup('/notificaciones?avisos=sin-leer&pagina=2');
    fireEvent.click(await screen.findByRole('button', { name: `Marcar como leída: ${notice.titulo}`, exact: true }));
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ page: 1, limit: 20, leida: false }));
    expect(screen.queryByText('No hay notificaciones')).toBeNull();
    expect(screen.getByTestId('location')).not.toHaveTextContent('pagina=2');
  });
});

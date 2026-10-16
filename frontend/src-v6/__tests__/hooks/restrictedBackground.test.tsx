import { act, renderHook, waitFor, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({
  restricted: true, unread: vi.fn(), notices: vi.fn(), list: vi.fn(), sync: vi.fn(), process: vi.fn(), get: vi.fn(), push: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  currentUser: { id: 'pending-carrier' }, isTransportista: true, isRestricted: mocks.restricted,
}) }));
vi.mock('../../services/api', () => ({ getAccessToken: () => 'synthetic-unit-token', default: { get: mocks.get } }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: { getNoLeidas: mocks.unread, list: mocks.notices } }));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { list: mocks.list } }));
vi.mock('../../services/offline-sync', () => ({ syncOfflineData: mocks.sync }));
vi.mock('../../services/indexeddb', () => ({ processSyncQueue: mocks.process }));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOnline: true }) }));
vi.mock('../../hooks/usePushNotifications', () => ({ usePushNotifications: mocks.push }));
vi.mock('../../components/ui/Toast', () => ({ toast: { add: vi.fn(), remove: vi.fn() } }));
import { useNotificacionesNoLeidas } from '../../hooks/useNotificaciones';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useActiveTripRecovery } from '../../hooks/useActiveTripRecovery';
import { NotificacionesPoller } from '../../components/NotificacionesPoller';
import { toast } from '../../components/ui/Toast';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.restricted = true; localStorage.clear();
  mocks.unread.mockResolvedValue(0); mocks.list.mockResolvedValue({ items: [] });
  mocks.notices.mockResolvedValue({ items: [], noLeidas: 0 });
  mocks.process.mockResolvedValue({ processed: 0, pending: 0 }); mocks.sync.mockResolvedValue(undefined);
  mocks.get.mockResolvedValue({ data: { data: { notificaciones: [] } } });
});
describe('restricted applicants do not start full-access background services', () => {
  it.each([1, 2])('uses the correct unread notice wording for %s', async count => {
    mocks.restricted = false; mocks.notices.mockResolvedValue({ items: [], noLeidas: count });
    const poller = render(<NotificacionesPoller />, { wrapper });
    await waitFor(() => expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: `${count} ${count === 1 ? 'aviso' : 'avisos'} sin leer` })));
    poller.unmount();
  });
  it('does not poll counters, recover trips, download manifests or process business mutations, even on manual retry', async () => {
    const { result, unmount } = renderHook(() => {
      useNotificacionesNoLeidas(); useActiveTripRecovery(); return useOfflineSync();
    }, { wrapper });
    await act(async () => { await result.current.retry(); });
    for (const fn of [mocks.unread, mocks.list, mocks.sync, mocks.process]) expect(fn).not.toHaveBeenCalled();
    unmount();
  });
  it('does not subscribe push or mount the notice poller for a restricted applicant', () => {
    const { unmount } = render(<NotificacionesPoller />, { wrapper });
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.notices).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
    unmount();
  });
  it('preserves counters, trip recovery, offline processing and notice polling for full-access accounts', async () => {
    mocks.restricted = false;
    const hook = renderHook(() => { useNotificacionesNoLeidas(); useActiveTripRecovery(); return useOfflineSync(); }, { wrapper });
    const poller = render(<NotificacionesPoller />, { wrapper });
    await waitFor(() => {
      for (const fn of [mocks.unread, mocks.list, mocks.process, mocks.notices, mocks.push]) expect(fn).toHaveBeenCalled();
    });
    expect(mocks.notices).toHaveBeenCalledWith({ limit: 20, leida: false });
    hook.unmount(); poller.unmount();
  });
});

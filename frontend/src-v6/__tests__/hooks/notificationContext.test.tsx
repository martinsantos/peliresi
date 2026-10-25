import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNotificaciones, useNotificacionesNoLeidas } from '../../hooks/useNotificaciones';

const state = vi.hoisted(() => ({ user: { id: 'account-a', rol: 'GENERADOR', actorId: 'g' } as any, restricted: false, list: vi.fn(), unread: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user, isRestricted: state.restricted }) }));
vi.mock('../../services/api', () => ({ getAccessToken: () => 'qa-token' }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: { list: state.list, getNoLeidas: state.unread } }));
beforeEach(() => { state.user = { id: 'account-a', rol: 'GENERADOR', actorId: 'g' }; state.restricted = false; state.list.mockReset(); state.unread.mockReset(); });
afterEach(cleanup);

it.each([
  ['cuenta', { id: 'account-b', rol: 'GENERADOR', actorId: 'g2' }],
  ['actividad', { id: 'account-a', rol: 'OPERADOR', actorId: 'o' }],
  ['autorización', { id: 'account-a', rol: 'GENERADOR', actorId: 'g', empresaContexto: { empresaId: 'e', autorizacionId: 'p', revision: 2 } }],
])('does not show old notices or badge while the new %s is loading', async (_, next) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.list.mockResolvedValueOnce({ items: [{ id: 'private-a' }], noLeidas: 9 }).mockImplementation(() => new Promise(() => {}));
  state.unread.mockResolvedValueOnce({ count: 9 }).mockImplementation(() => new Promise(() => {}));
  const view = renderHook(() => ({ list: useNotificaciones(), unread: useNotificacionesNoLeidas() }), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(view.result.current.list.data).toBeDefined());
  await waitFor(() => expect(view.result.current.unread.data).toBeDefined());
  state.user = next; view.rerender();
  expect(view.result.current.list.data).toBeUndefined();
  expect(view.result.current.unread.data).toBeUndefined();
  view.unmount(); client.clear();
});

it('a response that arrives after account change cannot populate the new inbox', async () => {
  let resolveOld!: (value: any) => void;
  state.list.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ items: [{ id: 'new-account' }], noLeidas: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(() => useNotificaciones(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(state.list).toHaveBeenCalledTimes(1));
  state.user = { id: 'account-b', rol: 'OPERADOR' }; view.rerender();
  await act(async () => { resolveOld({ items: [{ id: 'private-a' }], noLeidas: 9 }); });
  await waitFor(() => expect(view.result.current.data?.items[0].id).toBe('new-account'));
  view.unmount(); client.clear();
});

it.each([null, 'restricted'])('does not query a full inbox without an authorized account: %s', async mode => {
  if (mode === null) state.user = null; else state.restricted = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(() => useNotificaciones(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  expect(state.list).not.toHaveBeenCalled();
  expect(view.result.current.data).toBeUndefined();
  view.unmount(); client.clear();
});

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const mock = vi.hoisted(() => ({ user: null as any, restricted: false, get: vi.fn(), write: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user, isRestricted: mock.restricted }) }));
vi.mock('../../services/generador-fiscal.service', () => ({
  generadorFiscalService: { getPagos: mock.get, getDDJJ: mock.get, getDocumentos: mock.get, createPago: mock.write },
  operadorFiscalService: { getPagos: mock.get, getDDJJ: mock.get, getDocumentos: mock.get },
  transportistaDocumentoService: { getDocumentos: mock.get },
}));
import { usePagosTEF, useDDJJ, useOperadorPagosTEF, useOperadorDDJJ, useCreatePago } from '../../hooks/useGeneradorFiscal';
import { useActorDocuments } from '../../hooks/useActorDocuments';
const readers: [string, () => any][] = [
  ['generator payments', () => usePagosTEF('actor')], ['generator DDJJ', () => useDDJJ('actor')],
  ['operator payments', () => useOperadorPagosTEF('actor')], ['operator DDJJ', () => useOperadorDDJJ('actor')],
  ...(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const).map(type => [`${type} documents`, () => useActorDocuments(type, 'actor')] as [string, () => any]),
];
let clients: QueryClient[] = [];
beforeEach(() => {
  mock.user = { id: 'account', rol: 'GENERADOR', actorId: 'actor', empresaContexto: { empresaId: 'company', actividadId: 'activity', establecimientoId: 'site', autorizacionId: 'grant', revision: 1, todasSedes: false } };
  mock.restricted = false; mock.get.mockReset().mockResolvedValue([{ id: 'private-record' }]); mock.write.mockReset().mockResolvedValue({ id: 'new' });
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients = []; });
function open(read: () => any) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } }); clients.push(client);
  return { client, ...renderHook(read, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }) };
}
it.each(readers)('%s hides cached data immediately on restriction and makes no new request', async (_, read) => {
  const h = open(read); await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
  mock.get.mockClear(); mock.restricted = true; h.rerender();
  expect(h.result.current.data).toBeUndefined(); expect(mock.get).not.toHaveBeenCalled();
});
it.each(readers)('%s does not fetch without an authenticated account', async (_, read) => {
  mock.user = null; open(read); await act(async () => { await Promise.resolve(); }); expect(mock.get).not.toHaveBeenCalled();
});
it.each(readers)('%s isolates each authorization dimension, even with a fresh cache', async (_, read) => {
  const h = open(read); await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
  for (const change of [
    (u: any) => ({ ...u, id: 'other-account' }), (u: any) => ({ ...u, rol: 'OPERADOR' }),
    (u: any) => ({ ...u, actorId: 'other-actor' }),
    ...['empresaId', 'actividadId', 'establecimientoId', 'autorizacionId', 'revision'].map(key => (u: any) => ({ ...u, empresaContexto: { ...u.empresaContexto, [key]: key === 'revision' ? 2 : 'other' } })),
    (u: any) => ({ ...u, training: true }), (u: any) => ({ ...u, esInspector: true }),
  ]) {
    mock.get.mockReturnValueOnce(new Promise(() => {})); mock.user = change(mock.user); h.rerender(); expect(h.result.current.data).toBeUndefined();
    await act(async () => { h.client.setQueriesData({ queryKey: [], type: 'active' }, [{ id: 'private-record' }]); });
  }
});
it.each(readers)('%s cannot substitute an old context response while the new request is pending', async (_, read) => {
  let resolve!: (value: unknown) => void; mock.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const h = open(read); await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
  mock.get.mockReturnValueOnce(new Promise(() => {})); mock.user = { ...mock.user, empresaContexto: { ...mock.user.empresaContexto, revision: 2 } }; h.rerender();
  await act(async () => { resolve([{ id: 'late-private' }]); }); expect(h.result.current.data).toBeUndefined();
});
it('a payment write still refreshes every authorized cache for that actor', async () => {
  const h = open(() => ({ pagos: usePagosTEF('actor'), create: useCreatePago() }));
  await waitFor(() => expect(h.result.current.pagos.isSuccess).toBe(true)); mock.get.mockClear();
  await act(async () => { await h.result.current.create.mutateAsync({ generadorId: 'actor', data: { anio: 2026 } }); });
  expect(mock.get).toHaveBeenCalledTimes(1);
});

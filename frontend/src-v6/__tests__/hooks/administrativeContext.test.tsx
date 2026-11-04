import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const m = vi.hoisted(() => ({ user: null as any, restricted: false, read: vi.fn(), support: vi.fn(), applications: vi.fn(), write: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: m.user, isRestricted: m.restricted }) }));
vi.mock('../../services/usuario.service', () => ({ usuarioService: { list: m.read, getById: m.read } }));
vi.mock('../../services/alerta.service', () => ({ alertaService: { listReglas: m.read, listAlertas: m.read, listAnomalias: m.read } }));
vi.mock('../../services/attention.service', () => ({ supportPending: m.support, applicationTotals: m.applications }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { enviar: m.write, revisar: m.write, observar: m.write, aprobar: m.write, rechazar: m.write } }));
import { useEnviarSolicitud, useRevisarSolicitud, useObservarSolicitud, useAprobarSolicitud, useRechazarSolicitud } from '../../hooks/useSolicitudes';
import { useUsuarios, useUsuario } from '../../hooks/useUsuarios';
import { useAlertas, useReglasAlerta, useAnomalias } from '../../hooks/useAlertas';
import { useAttentionCounts } from '../../hooks/useAttentionCounts';
import { AttentionBadge } from '../../components/AttentionBadge';
const readers: [string, () => any][] = [ ['users', () => useUsuarios()], ['user', () => useUsuario('same')], ['alerts', () => useAlertas()], ['rules', () => useReglasAlerta()], ['anomalies', () => useAnomalias()] ];
let clients: QueryClient[] = [];
beforeEach(() => { m.user = { id: 'account', rol: 'ADMIN_GENERADOR', actorId: 'actor', empresaContexto: { empresaId: 'company', actividadId: 'activity', revision: 1 } }; m.restricted = false; m.read.mockReset().mockResolvedValue(['private']); m.support.mockReset().mockResolvedValue(7); m.applications.mockReset().mockResolvedValue({ ENVIADA: 3, EN_REVISION: 2, OBSERVADA: 1, APROBADA: 9 }); });
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients = []; });
function open<T>(read: () => T) { const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } }); clients.push(client); return { client, ...renderHook(read, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }) }; }
it.each(readers)('%s hides old results when the same person changes role', async (_, read) => {
 const h = open(read); await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
 m.read.mockReturnValue(new Promise(() => {})); m.user = { ...m.user, rol: 'ADMIN_OPERADOR' }; h.rerender(); expect(h.result.current.data).toBeUndefined();
});
it.each(readers)('%s hides results on an authorization revision change', async (_, read) => {
 const h = open(read); await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
 m.read.mockReturnValue(new Promise(() => {})); m.user = { ...m.user, empresaContexto: { ...m.user.empresaContexto, revision: 2 } }; h.rerender(); expect(h.result.current.data).toBeUndefined();
});
it.each(readers)('%s never fetches or reuses results under a restricted session', async (_, read) => {
 const h = open(read); await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
 m.read.mockClear(); m.restricted = true; h.rerender(); expect(h.result.current.data).toBeUndefined(); expect(m.read).not.toHaveBeenCalled();
});
it('attention counts separate changed role totals and support responsibilities', async () => {
 const h = open(useAttentionCounts); await waitFor(() => expect(h.result.current.applicationPending).toBe(5));
 m.support.mockReturnValue(new Promise(() => {})); m.applications.mockReturnValue(new Promise(() => {})); m.user = { ...m.user, rol: 'ADMIN_OPERADOR' }; h.rerender();
 expect(h.result.current.support).toBeUndefined(); expect(h.result.current.applicationPending).toBeUndefined(); expect(h.result.current.supportState).toBe('loading');
});
it('leaving administration cannot retain administrative totals', async () => {
 const h = open(useAttentionCounts); await waitFor(() => expect(h.result.current.applicationPending).toBe(5));
 m.user = { ...m.user, rol: 'GENERADOR' }; h.rerender(); expect(h.result.current.applicationPending).toBeUndefined(); expect(h.result.current.applications).toBeUndefined(); expect(h.result.current.applicationsState).toBe('hidden');
});
it('restriction removes both counters without additional reads', async () => {
 const h = open(useAttentionCounts); await waitFor(() => expect(h.result.current.support).toBe(7));
 m.support.mockClear(); m.applications.mockClear(); m.restricted = true; h.rerender(); expect(h.result.current.support).toBeUndefined(); expect(h.result.current.applicationPending).toBeUndefined(); expect(m.support).not.toHaveBeenCalled(); expect(m.applications).not.toHaveBeenCalled();
});
it('failed refresh hides obsolete numbers and a later success restores actual zero', async () => {
 const h = open(useAttentionCounts); await waitFor(() => expect(h.result.current.applicationPending).toBe(5));
 m.support.mockRejectedValue(new Error('503')); m.applications.mockRejectedValue(new Error('503'));
 await act(async () => { await h.client.invalidateQueries({ queryKey: ['attention'] }); });
 await waitFor(() => expect(h.result.current.supportState).toBe('error'));
 expect(h.result.current.support).toBeUndefined(); expect(h.result.current.applicationPending).toBeUndefined();
 m.support.mockResolvedValue(0); m.applications.mockResolvedValue({ ENVIADA: 0, EN_REVISION: 0, OBSERVADA: 0, APROBADA: 9 });
 await act(async () => { await h.client.invalidateQueries({ queryKey: ['attention'] }); });
 await waitFor(() => expect(h.result.current.applicationPending).toBe(0)); expect(h.result.current.support).toBe(0); expect(h.result.current.supportState).toBe('ready');
});
it('an unavailable badge never renders a cached number as current', () => {
 render(<AttentionBadge count={12} state="error" />); expect(screen.getByLabelText(/Cantidad de pendientes no disponible/)).toHaveTextContent('?'); expect(screen.queryByText('12')).toBeNull();
});
it('loading, confirmed zero and disabled counts remain distinguishable', () => {
 const view = render(<AttentionBadge count={12} state="loading" />); expect(screen.getByLabelText('Consultando cantidad de pendientes')).toHaveTextContent('…');
 view.rerender(<AttentionBadge count={0} state="ready" />); expect(view.container).toBeEmptyDOMElement();
 view.rerender(<AttentionBadge count={12} state="hidden" />); expect(view.container).toBeEmptyDOMElement();
});
it('ready badge preserves numeric count and accessible singular', () => { render(<AttentionBadge count={1} state="ready" />); expect(screen.getByLabelText('1 pendiente de atender')).toHaveTextContent('1'); });

it.each([
 ['send', useEnviarSolicitud, 'application'], ['review', useRevisarSolicitud, {id:'application'}],
 ['observe', useObservarSolicitud, {id:'application',mensaje:'QA observation'}], ['approve', useAprobarSolicitud, {id:'application'}],
 ['reject', useRechazarSolicitud, {id:'application',motivoRechazo:'QA reason'}],
] as const)('%s confirmation refreshes the current pending count without waiting for polling', async (_, mutation, input) => {
 m.write.mockResolvedValue({ id: 'application' });
 const h = open(() => ({ counts: useAttentionCounts(), action: mutation() }));
 await waitFor(() => expect(h.result.current.counts.applicationPending).toBe(5));
 m.applications.mockResolvedValue({ ENVIADA: 1, EN_REVISION: 1, OBSERVADA: 3, APROBADA: 10 });
 await act(async () => { await (h.result.current.action.mutateAsync as (value: unknown) => Promise<unknown>)(input); });
 await waitFor(() => expect(h.result.current.counts.applicationPending).toBe(2));
});

import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useManifiestos, useManifiesto } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), cached: vi.fn() }));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: { list: mocks.list, getById: mocks.detail } }));
vi.mock('../../services/offline-sync', () => ({ getCachedManifiestos: mocks.cached }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'offline-qa', rol: 'GENERADOR', actorId: 'g-1' } }) }));
afterEach(() => { cleanup(); onlineManager.setOnline(true); vi.restoreAllMocks(); vi.clearAllMocks(); });
it('reconnection during a pending IndexedDB read does not strand the list on an empty offline copy', async () => {
  const connection = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false);
  let resolve!: (items: never[]) => void;
  mocks.cached.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  mocks.list.mockResolvedValue({ items: [{ id: 'live', numero: 'QA-LIVE', estado: EstadoManifiesto.APROBADO }], total: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useManifiestos(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(mocks.cached).toHaveBeenCalled());
  act(() => { connection.mockReturnValue(true); onlineManager.setOnline(true); });
  await act(async () => resolve([]));
  await waitFor(() => expect(result.current.data?.items[0]?.id).toBe('live'));
  expect(result.current.data).not.toHaveProperty('offline'); client.clear();
});
it('volver a montar el listado online no conserva una copia local como respuesta fresca', async () => {
  const connection = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false);
  mocks.cached.mockResolvedValue([{ id: 'own', numero: 'QA-OWN', estado: EstadoManifiesto.APROBADO }]);
  mocks.list.mockResolvedValue({ items: [{ id: 'own', numero: 'QA-OWN', estado: EstadoManifiesto.EN_TRANSITO }], total: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const first = renderHook(() => useManifiestos(), { wrapper });
  await waitFor(() => expect(first.result.current.data).toHaveProperty('offline', true));
  first.unmount(); connection.mockReturnValue(true); onlineManager.setOnline(true);
  const second = renderHook(() => useManifiestos(), { wrapper });
  await waitFor(() => expect(second.result.current.data?.items[0].estado).toBe(EstadoManifiesto.EN_TRANSITO));
  expect(second.result.current.data).not.toHaveProperty('offline'); client.clear();
});
it('al recuperar conexión reemplaza las copias de listado y detalle por la respuesta real', async () => {
  const connection = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false);
  const cached = { id: 'own', numero: 'QA-OWN', estado: EstadoManifiesto.APROBADO };
  mocks.cached.mockResolvedValue([cached]);
  mocks.list.mockResolvedValue({ items: [{ ...cached, estado: EstadoManifiesto.EN_TRANSITO }], total: 1 });
  mocks.detail.mockResolvedValue({ ...cached, estado: EstadoManifiesto.EN_TRANSITO });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => ({ list: useManifiestos(), detail: useManifiesto('own') }), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.detail.data).toHaveProperty('offline', true));
  await waitFor(() => expect(result.current.list.data).toHaveProperty('offline', true));
  connection.mockReturnValue(true); onlineManager.setOnline(true);
  await waitFor(() => expect(result.current.detail.data?.estado).toBe(EstadoManifiesto.EN_TRANSITO));
  expect(result.current.detail.data).not.toHaveProperty('offline');
  await waitFor(() => expect(result.current.list.data?.items[0].estado).toBe(EstadoManifiesto.EN_TRANSITO));
  expect(result.current.list.data).not.toHaveProperty('offline'); client.clear();
});
it('abre un detalle descargado por primera vez sin red ni una consulta pausada', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false);
  mocks.cached.mockResolvedValue([{ id: 'own-cached', numero: 'QA-OWN', estado: EstadoManifiesto.APROBADO }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useManifiesto('own-cached'), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toMatchObject({ id: 'own-cached', offline: true });
  expect(mocks.cached).toHaveBeenCalledWith('offline-qa');
  expect(mocks.detail).not.toHaveBeenCalled();
  client.clear();
});
it('un detalle sin copia offline termina con error explícito, no cargando indefinidamente', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false); mocks.cached.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useManifiesto('uncached'), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toContain('No hay una copia descargada');
  expect(mocks.detail).not.toHaveBeenCalled(); client.clear();
});
it('no disfraza un error online de detalle con datos de una copia anterior', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  onlineManager.setOnline(true); mocks.detail.mockRejectedValue(new Error('Servidor QA no disponible'));
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const { result } = renderHook(() => useManifiesto('online-id'), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toBe('Servidor QA no disponible');
  expect(mocks.cached).not.toHaveBeenCalled(); client.clear();
});
it('resuelve un filtro nuevo sin red con React Query real, sin esperar reconexión ni enviar peticiones', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  onlineManager.setOnline(false);
  mocks.cached.mockResolvedValue([
    { id: 'draft', estado: EstadoManifiesto.BORRADOR, numero: 'QA-0', createdAt: '2026-09-30T10:00:00Z' },
    { id: 'active', estado: EstadoManifiesto.APROBADO, numero: 'QA-1', createdAt: '2026-09-30T10:00:00Z' },
  ]);
  mocks.list.mockRejectedValue(new Error('sin red'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useManifiestos({ estado: EstadoManifiesto.APROBADO }), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.items.map(m => m.id)).toEqual(['active']);
  expect(result.current.data).toHaveProperty('offline', true);
  expect(mocks.cached).toHaveBeenCalledWith('offline-qa');
  expect(mocks.list).not.toHaveBeenCalled();
  client.clear();
});

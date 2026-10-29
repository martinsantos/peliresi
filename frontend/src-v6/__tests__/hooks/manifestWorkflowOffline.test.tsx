import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as hooks from '../../hooks/useManifiestoWorkflow';
import { installMockGpsLocks } from '../utils/mockGpsLocks';

const calls = vi.hoisted(() => Object.fromEntries(['create', 'update', 'firmar', 'confirmarRetiro', 'confirmarEntrega', 'pesaje', 'confirmarRecepcion', 'confirmarRecepcionInSitu', 'registrarTratamiento', 'rechazar', 'registrarIncidente', 'cerrar', 'cancelar', 'revertirEstado', 'validarQR'].map(name => [name, vi.fn()])));
const delivery = vi.hoisted(() => vi.fn());
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: calls }));
vi.mock('../../services/deliveryCommand', () => ({ submitDelivery: delivery }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'carrier-a', rol: 'TRANSPORTISTA', actorId: 'carrier' } }) }));
vi.mock('../../utils/supportSession', () => ({ supportRequestContext: () => 'carrier-a:transportista', supportSessionMatches: () => true }));
let restoreLocks: () => void;
beforeEach(() => { restoreLocks = installMockGpsLocks(); });
afterEach(() => { onlineManager.setOnline(true); vi.clearAllMocks(); restoreLocks(); });

describe('explicit workflow submissions do not wait in an invisible offline queue', () => {
  for (const [name, hook] of Object.entries(hooks)) {
    if (name === 'useConfirmarEntrega') continue;
    it(`${name} returns a failure without pausing or retrying`, async () => {
      for (const callback of Object.values(calls)) callback.mockRejectedValue(new Error('Network Error'));
      onlineManager.setOnline(false);
      const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 1 } } });
      const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
      const { result } = renderHook(hook as () => ReturnType<typeof hooks.useFirmarManifiesto>, { wrapper });
      act(() => { result.current.mutate({ id: 'qa', firma: 'synthetic-unit-input' } as any); });
      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 600 });
      expect(result.current.isPaused).toBe(false);
      expect(Object.values(calls).reduce((total, callback) => total + callback.mock.calls.length, 0)).toBe(1);
      client.clear();
    });
  }
});

it('returns an explicit pending result for an offline delivery saved by the delivery command', async () => {
  delivery.mockResolvedValueOnce({status:'pending',message:'Entrega guardada'}); onlineManager.setOnline(false);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {result} = renderHook(() => hooks.useConfirmarEntrega(), {wrapper});
  let answer: unknown;
  await act(async () => { answer = await result.current.mutateAsync({id:'qa'}); });
  expect(answer).toEqual({status:'pending',message:'Entrega guardada'});expect(delivery).toHaveBeenCalledOnce();client.clear();
});

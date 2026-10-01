import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as hooks from '../../hooks/useManifiestoWorkflow';

const calls = vi.hoisted(() => Object.fromEntries(['create', 'update', 'firmar', 'confirmarRetiro', 'confirmarEntrega', 'pesaje', 'confirmarRecepcion', 'confirmarRecepcionInSitu', 'registrarTratamiento', 'rechazar', 'registrarIncidente', 'cerrar', 'cancelar', 'revertirEstado', 'validarQR'].map(name => [name, vi.fn()])));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: calls }));
afterEach(() => { onlineManager.setOnline(true); vi.clearAllMocks(); });

describe('explicit workflow submissions do not wait in an invisible offline queue', () => {
  for (const [name, hook] of Object.entries(hooks)) {
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

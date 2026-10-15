import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BajaIntensidadPage from '../../pages/manifiestos/BajaIntensidadPage';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), user: { id: 'qa-operator', rol: 'OPERADOR' } }));
vi.mock('../../services/api', () => ({ api: mock }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
const id = '00000000-0000-4000-8000-000000000001';
const entry = { id, referencia: 'BI-' + id, version: 0, etapa: 'RECIBIDO', puedeRegistrar: true, puedeResolver: false,
  datos: { generador: { nombre: 'QA externo', identificacion: 'Declarada', domicilio: 'QA' },
    transportista: { nombre: 'QA externo transporte', identificacion: 'Declarada', domicilio: 'QA' },
    patente: 'QA-1', motivo: 'Sin alta', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
  revisiones: [{ objetivo: id, estado: 'PENDIENTE', solicitada: false }], eventos: [] };
function view(detail = false, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/manifiestos/baja-intensidad' + (detail ? '?registro=' + id : '')]}><BajaIntensidadPage /></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  mock.get.mockResolvedValue({ data: { data: { registro: entry, registros: [], total: 0 } } });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('disabled feature never fetches or shows write controls', () => {
  vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'false'); view();
  expect(screen.getByText('Circuito no habilitado.')).toBeVisible();
  expect(mock.get).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
});
it('pending conformity does not disable recording treatment, nor grant reviewer buttons', async () => {
  view(true); await screen.findByText('Operación: Recibido');
  expect(screen.getByText(/Pendiente de conformidad/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Hecho registrado con evidencia' } });
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Aprobar post facto' })).not.toBeInTheDocument();
});
it('failed write retains note, same request id on retry, no false confirmation', async () => {
  mock.post.mockRejectedValue(new Error('offline')); view(true); await screen.findByText('Operación: Recibido');
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Evidencia conservada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Evidencia conservada');
  expect(screen.getByText('Operación: Recibido')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2));
  expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('an HTTP error is not presented as zero records', async () => {
  mock.get.mockRejectedValue(new Error('unavailable')); view();
  await screen.findByRole('alert');
  expect(screen.queryByText(/^0 registros/)).not.toBeInTheDocument();
});
it('invalidates a fresh list after a write without discarding the returned detail', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const listKey = ['baja-intensidad', mock.user.id, null, 1];
  client.setQueryData(listKey, { registros: [entry], total: 1 });
  const updated = { ...entry, version: 1, etapa: 'TRATADO' };
  mock.post.mockResolvedValue({ data: { data: { registro: updated } } });
  view(true, client); await screen.findByText('Operación: Recibido');
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByText('Operación: Tratado');
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  expect(client.getQueryData(['baja-intensidad', mock.user.id, id])).toEqual({ registro: updated });
});

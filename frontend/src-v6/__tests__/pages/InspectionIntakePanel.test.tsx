import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InspectionIntakePanel } from '../../pages/inspecciones/InspectionIntakePanel';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), list: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mock }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: { list: mock.list } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-admin', rol: 'ADMIN' } }) }));
const row = { id: 'a'.repeat(64), origen: 'PARTICIPANTE_EVENTUAL', origenId: 'qa-record', referencia: 'BI-qa-record', tipoActor: 'GENERADOR', actorId: null,
  actorNombre: 'Externo artificial', motivos: ['PARTICIPANTE_SIN_ALTA', 'IDENTIDAD_INCOMPLETA'], estado: 'PENDIENTE', version: 0,
  huellaEvidencia: 'b'.repeat(64), createdAt: '2026-10-20T18:00:00Z', evidencia: { motivo: 'Declaración eventual', participante: { nombre: 'Externo artificial' } }, eventos: [] };
function view(online = true) {
  const onCreate = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><InspectionIntakePanel online={online} mobile={false} onCreate={onCreate} /></MemoryRouter></QueryClientProvider>);
  return Object.assign(onCreate, { client });
}
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue({ data: { data: { items: [row], total: 1, puedeEvaluar: true } } }); mock.list.mockResolvedValue({ items: [], total: 0 }); });
afterEach(cleanup);
it('shows scoped evidence, missing identity and explicit administration action, without opening automatically', async () => {
  const onCreate = view();
  fireEvent.click(await screen.findByRole('button', { name: /BI-qa-record/ }));
  expect(await screen.findByText('Sin alta vinculada · identidad pendiente de verificar')).toBeVisible();
  expect(mock.post).not.toHaveBeenCalled(); expect(onCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir inspección' }));
  expect(onCreate).toHaveBeenCalledWith(row);
});
it('does not turn a failed or offline queue into an empty-list success', async () => {
  mock.get.mockRejectedValue(new Error('offline')); view();
  await screen.findByRole('alert'); expect(screen.queryByText('Sin antecedentes para estos filtros.')).not.toBeInTheDocument();
  cleanup(); mock.get.mockClear(); view(false); expect(mock.get).not.toHaveBeenCalled();
  expect(screen.getByText('Sin conexión. La cola requiere datos actuales del servidor.')).toBeVisible();
});
it('keeps the reason and idempotency reference after a rejected decision', async () => {
  mock.post.mockRejectedValue(new Error('offline')); view();
  fireEvent.click(await screen.findByRole('button', { name: /BI-qa-record/ }));
  const reason = screen.getByLabelText('Motivo de evaluación');
  expect(screen.getByRole('button', { name: 'Descartar con motivo' })).toBeDisabled();
  fireEvent.change(reason, { target: { value: 'Identidad pendiente de verificar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Descartar con motivo' })); await screen.findByText(/Conservamos tu motivo/);
  expect(reason).toHaveValue('Identidad pendiente de verificar');
  fireEvent.click(screen.getByRole('button', { name: 'Descartar con motivo' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('cannot evaluate from a read-only inspector view', async () => {
  mock.get.mockResolvedValue({ data: { data: { items: [row], total: 1, puedeEvaluar: false } } }); view();
  fireEvent.click(await screen.findByRole('button', { name: /BI-qa-record/ }));
  expect(screen.queryByLabelText('Motivo de evaluación')).not.toBeInTheDocument(); expect(mock.list).not.toHaveBeenCalled();
});
it('sends pagination/filter criteria to the server, instead of filtering only a visible page', async () => {
  view(); await screen.findByRole('button', { name: /BI-qa-record/ });
  fireEvent.change(screen.getByLabelText('Estado del antecedente'), { target: { value: 'EN_EVALUACION' } });
  await waitFor(() => expect(mock.get).toHaveBeenLastCalledWith('/inspecciones/antecedentes', { params: { estado: 'EN_EVALUACION', tipoActor: '', search: '', page: 1 } }));
});
it('does not silently apply a draft reason to a newer server version', async () => {
  const { client } = view(); await screen.findByRole('button', { name: /BI-qa-record/ });
  fireEvent.change(screen.getByLabelText('Estado del antecedente'), { target: { value: '' } });
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
  fireEvent.click(await screen.findByRole('button', { name: /BI-qa-record/ }));
  fireEvent.change(screen.getByLabelText('Motivo de evaluación'), { target: { value: 'Mi evaluación todavía no enviada' } });
  mock.get.mockResolvedValue({ data: { data: { items: [{ ...row, estado: 'EN_EVALUACION', version: 1 }], total: 1, puedeEvaluar: true } } });
  await act(() => client.invalidateQueries({ queryKey: ['inspection-intakes'] }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Tomar en evaluación' })).toBeDisabled();
  expect(screen.getByLabelText('Motivo de evaluación')).toHaveValue('Mi evaluación todavía no enviada');
  expect(mock.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Usar versión actual' }));
  expect(screen.getByRole('button', { name: 'Tomar en evaluación' })).toBeEnabled();
});

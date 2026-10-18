import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { get, post } }));
import ConciliacionExterna from '../../pages/manifiestos/ConciliacionExterna';
const base = { revision: 0, vinculo: null, historial: [], puedeRevisar: true, pendiente: null,
  candidato: { id: 'qa-actor', razonSocial: 'QA Registrado', cuit: '30712345671', domicilio: 'QA' } };
function view() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <ConciliacionExterna id="qa-record" rol="generador" userId="qa-reviewer" />
</QueryClientProvider>); }
beforeEach(() => { get.mockReset(); post.mockReset(); get.mockResolvedValue({ data: { data: base } }); });
afterEach(cleanup);
it('never offers confirmation for missing CUIT or for an operator without review rights', async () => {
  get.mockResolvedValue({ data: { data: { ...base, candidato: null, pendiente: 'CUIT dudoso', puedeRevisar: false } } });
  view(); await screen.findByText('CUIT dudoso');
  expect(screen.queryByRole('button', { name: 'Confirmar vínculo' })).toBeNull();
  expect(post).not.toHaveBeenCalled();
});
it('requires a motive and prevents concurrent submissions while preserving original data', async () => {
  let resolve!: (value: unknown) => void;
  post.mockReturnValue(new Promise(r => { resolve = r; }));
  view(); const button = await screen.findByRole('button', { name: 'Confirmar vínculo' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo de conciliación'), { target: { value: 'Ficha verificada' } });
  fireEvent.click(button); fireEvent.click(button);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1]).toMatchObject({ revision: 0, rol: 'generador', accion: 'VINCULAR', actorId: 'qa-actor', motivo: 'Ficha verificada' });
  resolve({}); await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});
it('preserves typed motive on conflict and offers explicit refresh instead of overwriting', async () => {
  post.mockRejectedValue({ response: { data: { message: 'La conciliación cambió' } } });
  view(); await screen.findByRole('button', { name: 'Confirmar vínculo' });
  fireEvent.change(screen.getByLabelText('Motivo de conciliación'), { target: { value: 'Mi revisión' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculo' }));
  await screen.findByText('La conciliación cambió');
  expect(screen.getByLabelText('Motivo de conciliación')).toHaveValue('Mi revisión');
  expect(screen.getByRole('button', { name: 'Recargar vínculo' })).toBeEnabled();
});

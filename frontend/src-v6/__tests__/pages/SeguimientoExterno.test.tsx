import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', () => ({ api: { get } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-own', rol: 'OPERADOR' } }) }));
import SeguimientoExterno from '../../pages/manifiestos/SeguimientoExterno';
const result = { total: 21, pageSize: 20, primera: '2026-10-01T12:00:00Z', ultima: '2026-10-16T12:00:00Z',
  cantidades: [{ corriente: 'Y1', unidad: 'kg', cantidad: '105' }, { corriente: 'Y1', unidad: 'l', cantidad: '21' }],
  registros: [{ id: 'qa-record', createdAt: '2026-10-16T12:00:00Z', operador: 'QA Operador', etapa: 'REGISTRADO',
    participante: { nombre: 'QA externo', identificacion: 'QA-ID', domicilio: '' } }] };
function view() { return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SeguimientoExterno /></QueryClientProvider></MemoryRouter>); }
beforeEach(() => { get.mockReset(); get.mockResolvedValue({ data: { data: result } }); });
afterEach(cleanup);
it('has an unambiguous participant label and applies the selected role explicitly', async () => {
  view(); await screen.findByText('21 movimientos · Generadores');
  const selector = screen.getByRole('combobox', { name: 'Tipo de participante', exact: true });
  expect(screen.getByLabelText('Tipo de participante', { exact: true })).toBe(selector);
  fireEvent.change(selector, { target: { value: 'transportista' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/manifiestos/baja-intensidad/seguimiento', { params: { rol: 'transportista', identificacion: '', page: 1 } }));
});
it('shows aggregate totals beyond the visible page and separates units; filters only on submit', async () => {
  view(); await screen.findByText('21 movimientos · Generadores');
  expect(screen.getByText('Y1 · 105 kg')).toBeVisible(); expect(screen.getByText('Y1 · 21 l')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ver registro' })).toHaveAttribute('href', '/manifiestos/baja-intensidad?registro=qa-record');
  const calls = get.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Identificación exacta'), { target: { value: ' QA-ID ' } });
  expect(get).toHaveBeenCalledTimes(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/manifiestos/baja-intensidad/seguimiento', { params: { rol: 'generador', identificacion: 'QA-ID', page: 1 } }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/manifiestos/baja-intensidad/seguimiento', { params: { rol: 'generador', identificacion: 'QA-ID', page: 2 } }));
  await screen.findByText('21 movimientos · Generadores');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
});
it('does not present a failed query as zero activity and allows retry', async () => {
  get.mockRejectedValue(new Error('offline')); view(); await screen.findByRole('alert');
  expect(screen.queryByText('No hay movimientos para estos filtros.')).not.toBeInTheDocument();
  get.mockResolvedValue({ data: { data: { ...result, total: 0, registros: [], cantidades: [] } } });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('No hay movimientos para estos filtros.');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
});

it('tracks external operators too (spec v2 §4)', async () => {
  view(); await screen.findByText('21 movimientos · Generadores');
  fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de participante', exact: true }), { target: { value: 'operador' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/manifiestos/baja-intensidad/seguimiento', { params: { rol: 'operador', identificacion: '', page: 1 } }));
  await screen.findByText('21 movimientos · Operadores');
});

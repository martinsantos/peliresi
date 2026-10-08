import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import PerfilPage from '../../pages/perfil/PerfilPage';

const m = vi.hoisted(() => ({ get: vi.fn(), user: { id: 'user', actorId: 'op-1', rol: 'OPERADOR', nombre: 'QA usuario', email: 'qa@example.invalid' } }));
vi.mock('../../services/api', () => ({ default: { get: m.get }, api: { get: m.get } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: m.user, isGenerador: m.user.rol === 'GENERADOR', isOperador: m.user.rol === 'OPERADOR' }) }));
const actor = (id: string) => ({ id, razonSocial: 'QA establecimiento ' + id, cuit: '99-00000001-0', domicilio: 'QA domicilio', numeroInscripcion: 'QA-G-1', numeroHabilitacion: 'QA-O-1', vencimientoHabilitacion: '2026-10-03T22:30:00Z' });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = () => <QueryClientProvider client={client}><MemoryRouter><PerfilPage /></MemoryRouter></QueryClientProvider>;
  return { ...render(view()), view };
}
beforeEach(() => {
  m.user = { id: 'user', actorId: 'op-1', rol: 'OPERADOR', nombre: 'QA usuario', email: 'qa@example.invalid' };
  m.get.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith('/documentos')) return { data: { success: true, data: { documentos: [] } } };
    const key = url.includes('/generadores/') ? 'generador' : 'operador';
    return { data: { success: true, data: { [key]: actor(url.split('/').at(-1)!) } } };
  });
});
it('reads the actual nested operator response and calendar expiry, not empty or shifted fields', async () => {
  setup(); expect(await screen.findByText('QA establecimiento op-1')).toBeVisible();
  expect(screen.getByText('99-00000001-0')).toBeVisible();
  expect(screen.getByText('03/10/2026')).toBeVisible();
  expect(screen.getByText('Vigencia hasta finalizar ese día en Mendoza.')).toBeVisible();
  expect(m.get).toHaveBeenCalledWith('/actores/operadores/op-1');
});
it('retains a date-only 10/10 instead of showing the previous day at 21:00', async () => {
  m.get.mockResolvedValue({ data: { success: true, data: { operador: { ...actor('op-1'), vencimientoHabilitacion: '2026-10-10T00:00:00.000Z' } } } });
  setup(); expect(await screen.findByText('10/10/2026')).toBeVisible();
  expect(screen.queryByText(/9\/10\/2026/)).toBeNull();
});
it('does not invent a date or validity when the operator has none recorded', async () => {
  m.get.mockResolvedValue({ data: { success: true, data: { operador: { ...actor('op-1'), vencimientoHabilitacion: null } } } });
  setup(); expect(await screen.findByText('No informada')).toBeVisible();
  expect(screen.queryByText('Vigencia hasta finalizar ese día en Mendoza.')).toBeNull();
});
it('uses the generator response without querying another category', async () => {
  m.user = { ...m.user, rol: 'GENERADOR', actorId: 'g-1' }; setup();
  expect(await screen.findByText('QA establecimiento g-1')).toBeVisible();
  expect(screen.getByText('QA-G-1')).toBeVisible();
  expect(m.get.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(['/actores/generadores/g-1', '/actores/generadores/g-1/documentos']));
});
it('shows a real error and allows retry instead of silently displaying empty data', async () => {
  const original = m.get.getMockImplementation()!; let failed = false;
  m.get.mockImplementation(async (url: string) => { if (url === '/actores/operadores/op-1' && !failed) { failed = true; throw new Error('offline'); } return original(url); }); setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar datos del establecimiento' }));
  expect(await screen.findByText('QA establecimiento op-1')).toBeVisible();
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('does not retain the former actor after an identity change', async () => {
  const rendered = setup(); await screen.findByText('QA establecimiento op-1');
  m.user = { ...m.user, actorId: 'op-2' }; rendered.rerender(rendered.view());
  expect(await screen.findByText('QA establecimiento op-2')).toBeVisible();
  expect(screen.queryByText('QA establecimiento op-1')).toBeNull();
});
it('does not request an actor for an unbound administrative identity', async () => {
  m.user = { ...m.user, actorId: '', rol: 'ADMIN' }; setup();
  expect(screen.queryByText('Datos de mi Establecimiento')).toBeNull();
  expect(m.get).not.toHaveBeenCalled();
});
it('identifies loading rather than showing placeholder establishment fields', async () => {
  m.get.mockImplementation(() => new Promise(() => {})); setup();
  expect(await screen.findByText('Cargando datos de tu establecimiento…')).toBeVisible();
  expect(screen.queryByText('Razon Social')).toBeNull();
});

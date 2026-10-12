import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import UserSwitcherPage from '../../pages/auth/UserSwitcherPage';

const mocks = vi.hoisted(() => ({ impersonate: vi.fn(), query: vi.fn(), role: 'ADMIN' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'admin', rol: mocks.role } }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonateUser: mocks.impersonate }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: unknown) => mocks.query(options) }));
function renderPage() { render(<MemoryRouter><UserSwitcherPage /></MemoryRouter>); }
beforeEach(() => {
  mocks.role = 'ADMIN'; mocks.impersonate.mockReset(); mocks.query.mockReset();
  mocks.query.mockImplementation(({ queryKey }: { queryKey: [string, string, string, string, number] }) => {
    const [, , role, search, page] = queryKey;
    const total = search ? 1 : role === 'GENERADOR' ? 205 : 2;
    return { data: { usuarios: Array.from({ length: Math.min(total, 5) }, (_, i) => ({
      id: role + '-' + ((page - 1) * 5 + i), nombre: search || role + ' ' + ((page - 1) * 5 + i),
      email: 'example@qa.invalid', activo: true, rol: role,
    })), pagination: { total, pages: Math.ceil(total / 5) } } };
  });
});
it('shows five generators without starving small categories', () => {
  renderPage();
  expect(within(screen.getByRole('region', { name: 'Generadores' })).getAllByRole('button', { name: /GENERADOR [0-9]/ })).toHaveLength(5);
  expect(screen.getByRole('region', { name: 'Operadores' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Inspectores' })).toBeVisible();
});
it('can close and reopen a group and paginate independently', () => {
  renderPage();
  const group = screen.getByRole('region', { name: 'Generadores' });
  const header = within(group).getByRole('button', { name: /Generadores/ });
  fireEvent.click(header); expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(within(group).queryByText('GENERADOR 0')).not.toBeInTheDocument();
  fireEvent.click(header); fireEvent.click(within(group).getByRole('button', { name: 'Siguiente' }));
  expect(within(group).getByText('GENERADOR 5')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Operadores' })).getByText('OPERADOR 0')).toBeVisible();
});
it('searches server-side and resets group pagination', async () => {
  renderPage();
  fireEvent.click(within(screen.getByRole('region', { name: 'Generadores' })).getByRole('button', { name: 'Siguiente' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar usuario' }), { target: { value: 'Apellido distante' } });
  await waitFor(() => expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['admin-usuarios-switcher', 'admin', 'GENERADOR', 'Apellido distante', 1, false] })));
});
it('requests five active users per server page and separates inspectors from roles', async () => {
  const { api } = await import('../../services/api');
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { usuarios: [], pagination: { total: 0, pages: 0 } } } });
  renderPage();
  const options = mocks.query.mock.calls.map(([value]) => value);
  await options.find(value => value.queryKey[2] === 'GENERADOR').queryFn();
  expect(get).toHaveBeenLastCalledWith('/admin/usuarios', { params: { limit: 5, page: 1, activo: 'true', excludeSelf: 'true', sortBy: 'nombre', sortOrder: 'asc', esInspector: 'false', rol: 'GENERADOR' } });
  await options.find(value => value.queryKey[2] === 'INSPECTOR').queryFn();
  expect(get.mock.calls.at(-1)?.[1]?.params).not.toHaveProperty('rol');
  get.mockRestore();
});
it('reports a failed impersonation without claiming a session change', async () => {
  mocks.impersonate.mockRejectedValue(new Error('Denied'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  renderPage(); fireEvent.click(within(screen.getByRole('region', { name: 'Operadores' })).getByRole('button', { name: 'Ver como OPERADOR 0, example@qa.invalid' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión no cambió');
  log.mockRestore();
});
it('never queries the roster for non-admins', () => {
  mocks.role = 'GENERADOR'; renderPage();
  expect(screen.getByText('Cambio de usuario no disponible')).toBeVisible();
  expect(mocks.query).not.toHaveBeenCalled();
});

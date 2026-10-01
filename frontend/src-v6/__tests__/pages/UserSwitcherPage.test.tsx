import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import UserSwitcherPage from '../../pages/auth/UserSwitcherPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'admin', rol: 'ADMIN' } }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonateUser: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [
  { id: 'g', nombre: 'QA Generador', rol: 'GENERADOR', email: 'g@qa.invalid', activo: true },
  { id: 'o', nombre: 'QA Operador', rol: 'OPERADOR', email: 'o@qa.invalid', activo: true },
  { id: 'ao', nombre: 'QA Jefe', rol: 'ADMIN_OPERADOR', email: 'ao@qa.invalid', activo: true },
] }) }));

it('uses readable Spanish group names instead of mechanically appending s', () => {
  render(<MemoryRouter><UserSwitcherPage /></MemoryRouter>);
  expect(screen.getByText('Generadores', { exact: true })).toBeVisible();
  expect(screen.getByText('Operadores', { exact: true })).toBeVisible();
  expect(screen.getByText('Administradores de operadores', { exact: true })).toBeVisible();
  expect(screen.queryByText(/Generadors|Operadors|Operadoress/)).not.toBeInTheDocument();
});

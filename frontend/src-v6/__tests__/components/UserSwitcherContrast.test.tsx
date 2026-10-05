import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserSwitcher } from '../../components/ui/UserSwitcher';

const state = vi.hoisted(() => ({ role: 'ADMIN' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  currentUser: { id: 1, nombre: 'QA Usuario', avatar: 'QA', rol: state.role },
  users: [], switchUser: vi.fn(), getUsersByRole: () => [],
}) }));

describe('Current-role caption remains readable on every actor tint', () => {
  it.each([['ADMIN', 'Administrador'], ['GENERADOR', 'Generador'], ['TRANSPORTISTA', 'Transportista'], ['OPERADOR', 'Operador']])('%s uses an explicit dark foreground', (role, caption) => {
    state.role = role;
    render(<UserSwitcher />);
    const label = screen.getByText(caption, { exact: true });
    expect(label).toHaveClass('text-neutral-700');
    expect(label.closest('button')).toBeEnabled();
    expect(screen.getByText('QA Usuario')).toBeInTheDocument();
  });
});

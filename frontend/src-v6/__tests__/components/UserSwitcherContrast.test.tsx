import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UserSwitcher } from '../../components/ui/UserSwitcher';

const state = vi.hoisted(() => ({ role: 'ADMIN', users: [] as Array<{ id: number; nombre: string; avatar: string; rol: string; sector: string }> }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  currentUser: { id: 1, nombre: 'QA Usuario', avatar: 'QA', rol: state.role },
  users: state.users, switchUser: vi.fn(), getUsersByRole: () => state.users,
}) }));

describe('Current-role caption remains readable on every actor tint', () => {
  it.each([['ADMIN', 'Administrador'], ['GENERADOR', 'Generador'], ['TRANSPORTISTA', 'Transportista'], ['OPERADOR', 'Operador']])('%s uses an explicit dark foreground', (role, caption) => {
    state.role = role;
    render(<MemoryRouter><UserSwitcher /></MemoryRouter>);
    const label = screen.getByText(caption, { exact: true });
    expect(label).toHaveClass('text-neutral-700');
    expect(label.closest('button')).toBeEnabled();
    expect(screen.getByText('QA Usuario')).toBeInTheDocument();
  });
  it('retains an explicitly named 44px mobile account trigger and a bounded dropdown', () => {
    state.role = 'ADMIN';
    const { container } = render(<MemoryRouter><UserSwitcher /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Opciones de cuenta de QA Usuario', exact: true });
    expect(trigger).toHaveClass('h-11', 'w-11', 'sm:w-auto', 'transition-colors');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('svg.lucide-chevron-down')).toHaveClass('hidden', 'sm:block');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dropdown = container.querySelector('.absolute.right-0.top-full') as HTMLElement;
    expect(dropdown).toHaveClass('max-w-[calc(100vw-32px)]');
    expect(within(dropdown).getByText('Usuario Actual')).toBeVisible();
    expect(within(dropdown).getByText('QA Usuario', { selector: 'p.font-semibold' })).toBeVisible();
  });
  it('outside demo mode offers the profile instead of an empty account switcher', () => {
    state.role = 'GENERADOR'; state.users = [];
    render(<MemoryRouter><UserSwitcher /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de cuenta de QA Usuario', exact: true }));
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/mi-perfil');
    expect(screen.queryByText('Cambiar a:')).not.toBeInTheDocument();
    expect(screen.queryByText('Filtrar por rol')).not.toBeInTheDocument();
    expect(screen.queryByText(/usuarios disponibles/)).not.toBeInTheDocument();
  });
  it('keeps the demo switcher when demo accounts exist', () => {
    state.role = 'ADMIN'; state.users = [{ id: 2, nombre: 'Demo Generador', avatar: 'DG', rol: 'GENERADOR', sector: 'Demo' }];
    render(<MemoryRouter><UserSwitcher /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de cuenta de QA Usuario', exact: true }));
    expect(screen.getByText('Cambiar a:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Demo Generador/ })).toBeInTheDocument();
    state.users = [];
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppMobile from '../../AppMobile';

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ currentUser: null, isRestricted: false, isLoading: false }),
}));

describe('App public recovery retains the same institutional form frame as web', () => {
  it.each([
    ['/recuperar', 'Recuperar contraseña'],
    ['/reset-password?token=unit-only-no-request', 'Nueva contraseña'],
    ['/reset-password', 'Recuperar contraseña'],
    ['/registro', 'Crear cuenta en SITREP'],
  ])('frames the actual %s form without starting an account request', async (route, heading) => {
    render(<MemoryRouter initialEntries={[route]}><AppMobile /></MemoryRouter>);
    const title = await screen.findByRole('heading', { name: heading });
    const frame = title.closest('main');
    expect(frame).toHaveClass('auth-form-panel');
    expect(frame?.parentElement).toHaveClass('institutional', 'auth-shell');
    if (heading === 'Recuperar contraseña') expect(screen.getByRole('link', { name: /Volver al login/ })).toBeVisible();
    expect(screen.queryByText('Página no encontrada')).not.toBeInTheDocument();
  });
});

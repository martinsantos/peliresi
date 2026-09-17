import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../../pages/auth/LoginPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), authError: null }),
}));

describe('LoginPage registration cards', () => {
  it('offers real and non-mutating review entry points for every actor', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    for (const actor of ['Generador', 'Transportista', 'Operador']) {
      const slug = actor.toLowerCase();
      expect(screen.getByRole('link', { name: `Iniciar alta de ${actor}` }))
        .toHaveAttribute('href', `/inscripcion/${slug}`);
      expect(screen.getByRole('link', { name: `Probar formulario de ${actor} sin completar datos` }))
        .toHaveAttribute('href', `/inscripcion/${slug}?modo=revision`);
    }
  });
});

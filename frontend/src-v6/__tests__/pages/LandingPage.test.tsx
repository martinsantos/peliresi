import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../../pages/auth/LandingPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null }),
}));

describe('LandingPage', () => {
  it('routes public enrollment only to the three actor workflows', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Iniciar alta de Generador' })).toHaveAttribute('href', '/inscripcion/generador');
    expect(screen.getByRole('link', { name: 'Iniciar alta de Transportista' })).toHaveAttribute('href', '/inscripcion/transportista');
    expect(screen.getByRole('link', { name: 'Iniciar alta de Operador' })).toHaveAttribute('href', '/inscripcion/operador');
    expect(screen.getByRole('link', { name: /Probar formulario de Generador/i })).toHaveAttribute('href', '/inscripcion/generador?modo=revision');
    expect(screen.getByRole('link', { name: /Probar formulario de Transportista/i })).toHaveAttribute('href', '/inscripcion/transportista?modo=revision');
    expect(screen.getByRole('link', { name: /Probar formulario de Operador/i })).toHaveAttribute('href', '/inscripcion/operador?modo=revision');
    expect(screen.queryByText('Administradores Sectoriales')).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="qrserver"]')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR para abrir la App SITREP' })).toBeInTheDocument();
  });
});

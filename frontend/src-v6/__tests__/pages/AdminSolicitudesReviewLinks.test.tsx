import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminSolicitudesPage from '../../pages/admin/AdminSolicitudesPage';

vi.mock('../../hooks/useSolicitudes', () => ({
  useSolicitudes: () => ({
    data: { items: [], total: 0, totalPages: 1 },
    isLoading: false,
  }),
}));

describe('AdminSolicitudesPage review wizards', () => {
  it('exposes the three non-mutating actor review forms', () => {
    render(
      <MemoryRouter>
        <AdminSolicitudesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Formularios de prueba')).toBeInTheDocument();
    expect(screen.getByText(/no crea cuentas, no guarda solicitudes/i)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /formulario de prueba de Generador/i }))
      .toHaveAttribute('href', '/inscripcion/generador?modo=revision');
    expect(screen.getByRole('link', { name: /formulario de prueba de Transportista/i }))
      .toHaveAttribute('href', '/inscripcion/transportista?modo=revision');
    expect(screen.getByRole('link', { name: /formulario de prueba de Operador/i }))
      .toHaveAttribute('href', '/inscripcion/operador?modo=revision');
  });
});

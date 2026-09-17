import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import InspeccionesPage from '../../pages/inspecciones/InspeccionesPageV2';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN', esInspector: false }, isAdmin: true }),
}));

vi.mock('../../hooks/useInspecciones', () => ({
  useInspections: () => ({ data: { items: [], total: 0 }, isLoading: false }),
  useInspectionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogoGeneradores: () => ({ data: [{ id: 'g-1', razonSocial: 'Generador de prueba' }] }),
  useCatalogoTransportistas: () => ({ data: [] }),
  useCatalogoOperadores: () => ({ data: [] }),
}));

describe('InspeccionesPage', () => {
  it('shows the empty state and opens the actor-aware creation form', () => {
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Inspecciones' })).toBeInTheDocument();
    expect(screen.getByText('No hay inspecciones para estos filtros')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /nueva inspección/i }));
    expect(screen.getByRole('dialog', { name: 'Nueva inspección' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Generador de prueba' })).toBeInTheDocument();
  });
});

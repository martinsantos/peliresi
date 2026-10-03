import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CentroControlPage } from '../../pages/centro-control/CentroControlPage';

const centro = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-admin', rol: 'ADMIN' }, isAdmin: true, isTransportista: false }) }));
vi.mock('../../hooks/useCentroControl', () => ({ useCentroControl: centro }));
vi.mock('../../hooks/useDashboard', () => ({ useDashboardStats: () => ({ refetch: refresh }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useAlertas', () => ({ useAlertas: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useInspectionOperations', () => ({ useInspectionOperations: () => ({ data: { total: 0, items: [] }, refetch: refresh, isError: false, isPending: false }) }));
vi.mock('../../pages/centro-control/components/ControlFilters', () => ({ ControlFilters: () => null }));
vi.mock('../../pages/centro-control/components/ControlMap', () => ({ ControlMap: () => null }));
vi.mock('../../pages/centro-control/components/ControlStats', () => ({ ControlStats: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const activeData = { enTransito: [{ manifiestoId: 'qa-trip', numero: 'QA-VIAJE', transportista: 'QA Transporte', origen: 'QA Origen', destino: 'QA Destino', origenLatLng: null, destinoLatLng: null, ultimaPosicion: null, ruta: [] }] };
const page = <MemoryRouter><CentroControlPage /></MemoryRouter>;

describe('Centro de Control respects explicit panel choices across responses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not reopen a panel closed by the user when the first data response arrives', () => {
    centro.mockReturnValue({ data: null, refetch: refresh });
    const { rerender } = render(page);
    const active = screen.getByRole('button', { name: /^Viajes Activos/ });
    fireEvent.click(active);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    centro.mockReturnValue({ data: activeData, refetch: refresh });
    rerender(<MemoryRouter><CentroControlPage /></MemoryRouter>);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(0);
  });

  it('keeps the closed state after polling but permits a deliberate reopen with current trip data', () => {
    centro.mockReturnValue({ data: activeData, refetch: refresh });
    const { rerender } = render(page);
    const active = screen.getByRole('button', { name: /^Viajes Activos/ });
    fireEvent.click(active);
    centro.mockReturnValue({ data: { enTransito: activeData.enTransito.map(trip => ({ ...trip, numero: 'QA-VIAJE-REFRESCADO' })) }, refetch: refresh });
    rerender(<MemoryRouter><CentroControlPage /></MemoryRouter>);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(active);
    expect(active).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('QA-VIAJE-REFRESCADO')).toBeVisible();
  });
});

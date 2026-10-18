import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CentroControlPage } from '../../pages/centro-control/CentroControlPage';

const centro = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const mapProps = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/AuthContext', () => ({ useAuth: auth }));
vi.mock('../../hooks/useCentroControl', () => ({ useCentroControl: centro }));
vi.mock('../../hooks/useDashboard', () => ({ useDashboardStats: () => ({ refetch: refresh }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useAlertas', () => ({ useAlertas: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useInspectionOperations', () => ({ useInspectionOperations: () => ({ data: { total: 0, items: [] }, refetch: refresh, isError: false, isPending: false }) }));
vi.mock('../../pages/centro-control/components/ControlFilters', () => ({ ControlFilters: () => null }));
vi.mock('../../pages/centro-control/components/ControlMap', () => ({ ControlMap: (props: { layers: { transito: boolean }; onToggleLayer: (layer: 'transito') => void }) => {
  mapProps(props);
  return <button type="button" aria-label="Capa En Tránsito" aria-pressed={props.layers.transito} onClick={() => props.onToggleLayer('transito')}>Capa de tránsito</button>;
} }));
vi.mock('../../pages/centro-control/components/ControlStats', () => ({ ControlStats: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const activeData = { enTransito: [{ manifiestoId: 'qa-trip', numero: 'QA-VIAJE', transportista: 'QA Transporte', origen: 'QA Origen', destino: 'QA Destino', origenLatLng: null, destinoLatLng: null, ultimaPosicion: null, ruta: [] }] };
const page = <MemoryRouter><CentroControlPage /></MemoryRouter>;

describe('Centro de Control respects explicit panel choices across responses', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockReturnValue({ currentUser: { id: 'qa-admin', rol: 'ADMIN' }, isAdmin: true, isTransportista: false });
  });

  it('starts with exactly 30 calendar days including today, not 31', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    centro.mockReturnValue({ data: activeData, refetch: refresh });
    render(page);
    expect(centro).toHaveBeenCalledWith(expect.objectContaining({ fechaDesde: '2026-09-06', fechaHasta: '2026-10-05' }));
  });

  it('initializes both bounds to the Mendoza calendar when UTC is already the next day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T01:00:00Z'));
    centro.mockReturnValue({ data: activeData, refetch: refresh });
    render(page);
    expect(centro).toHaveBeenCalledWith(expect.objectContaining({ fechaDesde: '2026-12-02', fechaHasta: '2026-12-31' }));
  });

  it('shows global operational trips to a different transporter without offering private document access', () => {
    auth.mockReturnValue({ currentUser: { id: 'qa-other', rol: 'TRANSPORTISTA', sector: 'Otra empresa' }, isAdmin: false, isTransportista: true });
    centro.mockReturnValue({ data: activeData, refetch: refresh });
    render(page);
    expect(screen.getByText('QA-VIAJE')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar viaje QA-VIAJE' }));
    expect(screen.queryByRole('button', { name: 'Ver detalle del viaje' })).toBeNull();
    expect(screen.getByText('Vista operativa · expediente restringido')).toBeVisible();
  });

  it('hides map symbols without deleting agenda trips and permits selecting a hidden trip explicitly', () => {
    // Reproduce the actual API contract: an omitted transit layer returns no
    // transit rows. Presentation changes must not remove this operational data.
    centro.mockImplementation(({ capas }: { capas: string[] }) => ({
      data: { ...activeData, enTransito: capas.includes('transito') ? activeData.enTransito : [] }, refetch: refresh,
    }));
    render(page);
    const layer = screen.getByRole('button', { name: 'Capa En Tránsito' });
    const trip = screen.getByRole('button', { name: 'Seleccionar viaje QA-VIAJE' });
    fireEvent.click(layer);
    expect(layer).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Viajes Activos 1' })).toBeVisible();
    expect(trip).toBeVisible();
    expect(centro).toHaveBeenLastCalledWith(expect.objectContaining({ capas: ['generadores', 'transportistas', 'operadores', 'transito'] }));
    fireEvent.click(trip);
    expect(layer).toHaveAttribute('aria-pressed', 'true');
    expect(mapProps.mock.lastCall?.[0].selectedTripId).toBe('qa-trip');
    expect(mapProps.mock.lastCall?.[0].tripPanel).toBe('activos');
    // Deselecting must preserve the normal toggle, not force another selection.
    fireEvent.click(trip);
    expect(mapProps.mock.lastCall?.[0].selectedTripId).toBeNull();
  });

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

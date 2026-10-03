import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import MapaActoresTab from './MapaActoresTab';
import { ACTOR_COLORS } from '../../../utils/map-icons';
import type { CentroControlData } from '../../../hooks/useCentroControl';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'actor-1', rol: 'GENERADOR' } }) }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ flyTo: vi.fn() }),
}));

function reportMap() {
  const ccData = { generadores: [{ id: 'g-1', razonSocial: 'Generador del mapa', cuit: 'synthetic', categoria: 'Y1', latitud: -32.89, longitud: -68.82, cantManifiestos: 1 }], transportistas: [], operadores: [] } as unknown as CentroControlData;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><MapaActoresTab ccData={ccData} onSelectDep={vi.fn()} periodoLabel="Prueba" /></MemoryRouter></QueryClientProvider>);
}

describe('Report map single interactive category reference', () => {
  it('uses the canonical glyph and color, even for the in-situ operator modality', () => {
    reportMap();
    const group = screen.getByRole('group', { name: 'Capas del mapa' });
    for (const [label, glyph, color] of [
      ['Generadores', 'factory', ACTOR_COLORS.generador],
      ['Transportistas', 'truck', ACTOR_COLORS.transportista],
      ['Op. Fijos', 'flask-conical', ACTOR_COLORS.operador],
      ['Op. In Situ', 'flask-conical', ACTOR_COLORS.operador],
    ]) {
      const button = within(group).getByRole('button', { name: label, exact: true });
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
      expect(button.querySelector('[data-map-symbol]')).toHaveStyle({ backgroundColor: color });
    }
    expect(within(group).queryByRole('button', { name: 'Inspecciones', exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText('Generadores', { exact: true })).toHaveLength(1);
  });

  it('really removes and restores the selected category markers and list entries', () => {
    reportMap();
    const button = screen.getByRole('button', { name: 'Generadores', exact: true });
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Generador del mapa/ })).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Generador del mapa/ })).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });
});

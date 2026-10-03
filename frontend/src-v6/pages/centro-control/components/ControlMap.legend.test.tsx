import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ControlMap } from './ControlMap';
import { ACTOR_COLORS } from '../../../utils/map-icons';

// Units inspect presentation, not a simulated business API or browser journey.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Marker: () => null, Popup: () => null, Polyline: () => null,
  useMap: () => ({ on: vi.fn(), off: vi.fn(), flyTo: vi.fn(), setView: vi.fn(), flyToBounds: vi.fn() }),
}));

function renderMap(inspection?: boolean) {
  const props: React.ComponentProps<typeof ControlMap> = {
    cc: null, layers: { generadores: true, transportistas: true, operadores: true, transito: true, inspecciones: inspection }, onToggleLayer: vi.fn(),
    mapZoom: 10, onZoomChange: vi.fn(), enTransitoForMap: [], selectedTripId: null,
    onSelectTrip: vi.fn(), selectedRealizadoId: null, tripPanel: 'activos', inspections: [],
    selectedInspectionId: null, onSelectInspection: vi.fn(), viajesRealizados: [],
    activeTripFlyPoints: [], panelBoundsPoints: [], realizadoFlyPoints: [], mapColRef: React.createRef(),
  };
  return render(<MemoryRouter><ControlMap {...props} /></MemoryRouter>);
}

describe('Control map visual identity across desktop and mobile', () => {
  it('has one actionable legend, not another non-interactive reference', () => {
    renderMap(true);
    expect(screen.getAllByRole('group', { name: 'Capas del mapa' })).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Tipos de elementos en el mapa' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Operadores' })).toHaveLength(1);
  });

  it.each([true, false])('uses the same labelled glyphs even when the inspection layer is %s', enabled => {
    renderMap(enabled);
    const legend = screen.getByRole('group', { name: 'Capas del mapa' });
      expect(within(legend).getAllByRole('button')).toHaveLength(5);
      for (const [label, glyph, color] of [
        ['Generadores', 'factory', ACTOR_COLORS.generador],
        ['Transportistas', 'truck', ACTOR_COLORS.transportista],
        ['Operadores', 'flask-conical', ACTOR_COLORS.operador],
        ['Inspecciones', 'clipboard-check', ACTOR_COLORS.inspeccion],
      ]) {
        const item = within(legend).getByRole('button', { name: label });
        expect(item.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
        expect(item.querySelector('[data-map-symbol]')).toHaveStyle({ backgroundColor: color });
        expect(item.querySelector('polygon')).toBeNull();
      }
      expect(within(legend).getByRole('button', { name: 'En Tránsito' })).toBeInTheDocument();
  });

  it('does not advertise inspection operations where that layer is not offered', () => {
    renderMap();
    const legend = screen.getByRole('group', { name: 'Capas del mapa' });
      expect(within(legend).getAllByRole('button')).toHaveLength(4);
      expect(within(legend).queryByText('Inspecciones')).toBeNull();
  });
});

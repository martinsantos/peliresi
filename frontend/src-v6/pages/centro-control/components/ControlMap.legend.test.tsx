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
    cc: null, layers: { generadores: true, transportistas: true, operadores: true, transito: true, inspecciones: inspection },
    mapZoom: 10, onZoomChange: vi.fn(), enTransitoForMap: [], selectedTripId: null,
    onSelectTrip: vi.fn(), selectedRealizadoId: null, tripPanel: 'activos', inspections: [],
    selectedInspectionId: null, onSelectInspection: vi.fn(), viajesRealizados: [],
    activeTripFlyPoints: [], panelBoundsPoints: [], realizadoFlyPoints: [], mapColRef: React.createRef(),
  };
  return render(<MemoryRouter><ControlMap {...props} /></MemoryRouter>);
}

function show(inspection?: boolean) {
  renderMap(inspection);
  return screen.getAllByRole('list', { name: 'Tipos de elementos en el mapa' });
}

describe('Control map visual identity across desktop and mobile', () => {
  it('identifies operators by their flask instead of a hexagon in both legends', () => {
    const { container } = renderMap(true);
    const operatorLabels = Array.from(container.querySelectorAll('span'))
      .filter(element => ['Oper', 'Operadores'].includes(element.textContent?.trim() || ''));
    expect(operatorLabels).toHaveLength(2);
    for (const label of operatorLabels) {
      expect(label.querySelector('svg.lucide-flask-conical')).not.toBeNull();
      expect(label.querySelector('polygon')).toBeNull();
    }
  });

  it.each([true, false])('uses the same labelled glyphs even when the inspection layer is %s', enabled => {
    const legends = show(enabled);
    expect(legends).toHaveLength(2);
    for (const legend of legends) {
      expect(within(legend).getAllByRole('listitem')).toHaveLength(5);
      for (const [label, glyph, color] of [
        ['Generadores', 'factory', ACTOR_COLORS.generador],
        ['Transportistas', 'truck', ACTOR_COLORS.transportista],
        ['Operadores', 'flask-conical', ACTOR_COLORS.operador],
        ['Inspecciones', 'clipboard-check', ACTOR_COLORS.inspeccion],
      ]) {
        const item = within(legend).getByText(label).closest('[role="listitem"]')!;
        expect(item.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
        expect(item.querySelector('[aria-hidden="true"]')).toHaveStyle({ backgroundColor: color });
        expect(item.querySelector('polygon')).toBeNull();
      }
      expect(within(legend).getByText('En tránsito')).toBeInTheDocument();
    }
  });

  it('does not advertise inspection operations where that layer is not offered', () => {
    for (const legend of show()) {
      expect(within(legend).getAllByRole('listitem')).toHaveLength(4);
      expect(within(legend).queryByText('Inspecciones')).toBeNull();
    }
  });
});

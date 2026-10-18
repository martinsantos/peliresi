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
  TileLayer: () => null,
  Marker: ({ children, position }: { children: React.ReactNode; position: [number, number] }) => <div data-testid="marker" data-position={JSON.stringify(position)}>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Polyline: () => null,
  useMap: () => ({ on: vi.fn(), off: vi.fn(), flyTo: vi.fn(), setView: vi.fn(), flyToBounds: vi.fn() }),
}));

function renderMap(inspection?: boolean, cc: React.ComponentProps<typeof ControlMap>['cc'] = null, overrides: Partial<React.ComponentProps<typeof ControlMap>> = {}) {
  const props: React.ComponentProps<typeof ControlMap> = {
    cc, layers: { generadores: true, transportistas: true, operadores: true, transito: true, inspecciones: inspection }, onToggleLayer: vi.fn(),
    mapZoom: 10, onZoomChange: vi.fn(), enTransitoForMap: [], selectedTripId: null,
    onSelectTrip: vi.fn(), selectedRealizadoId: null, tripPanel: 'activos', inspections: [],
    selectedInspectionId: null, onSelectInspection: vi.fn(), viajesRealizados: [],
    activeTripFlyPoints: [], panelBoundsPoints: [], realizadoFlyPoints: [], mapColRef: React.createRef(),
    ...overrides,
  };
  return render(<MemoryRouter><ControlMap {...props} /></MemoryRouter>);
}

describe('Control map visual identity across desktop and mobile', () => {
  it('retains the selected trip data but hides all its map symbols when the transit layer is off', () => {
    renderMap(false, null, {
      layers: { generadores: true, transportistas: true, operadores: true, transito: false },
      selectedTripId: 'qa-hidden',
      enTransitoForMap: [{ manifiestoId: 'qa-hidden', numero: 'QA', origen: 'QA origen', destino: 'QA destino', transportista: 'QA transporte', origenLatLng: [-32.8, -68.8], destinoLatLng: [-32.9, -68.9], ultimaPosicion: { latitud: -32.85, longitud: -68.85, velocidad: null, direccion: null, timestamp: '2026-10-07T12:00:00Z' }, ruta: [] }],
    });
    expect(screen.getByRole('button', { name: 'En Tránsito' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('marker')).toBeNull();
    expect(screen.getByText('1 en tránsito')).toBeVisible();
  });
  it('uses the same explicitly approximate carrier reference as Reportes', () => {
    const cc = { generadores: [], operadores: [], transportistas: [{ id: 'qa-ref', razonSocial: 'Transporte de referencia', cuit: 'synthetic', latitud: null, longitud: null, domicilio: 'Ruta, Maipú', vehiculosActivos: 0, enviosEnTransito: 0 }] } as unknown as React.ComponentProps<typeof ControlMap>['cc'];
    renderMap(false, cc);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', JSON.stringify([-32.943, -68.755]));
    expect(screen.getByTestId('marker')).toHaveTextContent('Referencia departamental aproximada');
  });
  it('reports an unknown carrier rather than hiding the lack of location', () => {
    const cc = { generadores: [], operadores: [], transportistas: [{ id: 'qa-none', razonSocial: 'Transporte sin coordenadas', cuit: 'synthetic', latitud: null, longitud: null, vehiculosActivos: 0, enviosEnTransito: 0 }] } as unknown as React.ComponentProps<typeof ControlMap>['cc'];
    renderMap(false, cc);
    expect(screen.queryByTestId('marker')).toBeNull();
    expect(screen.getByText('1 transportista sin ubicación verificada')).toBeVisible();
  });
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
        expect(item.querySelector('[data-map-symbol-background]')).toHaveStyle({ backgroundColor: color });
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

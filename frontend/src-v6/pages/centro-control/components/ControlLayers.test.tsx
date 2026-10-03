import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControlFilters } from './ControlFilters';
import { ControlMap } from './ControlMap';
import { ACTOR_COLORS } from '../../../utils/map-icons';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Marker: () => null, Popup: () => null, Polyline: () => null,
  useMap: () => ({ on: vi.fn(), off: vi.fn(), flyTo: vi.fn(), setView: vi.fn(), flyToBounds: vi.fn() }),
}));

function map(inspecciones?: boolean) {
  const onToggleLayer = vi.fn();
  const props = {
    cc: null, layers: { generadores: true, transportistas: true, operadores: false, transito: true, inspecciones },
    onToggleLayer, mapZoom: 10, onZoomChange: vi.fn(), enTransitoForMap: [], selectedTripId: null,
    onSelectTrip: vi.fn(), selectedRealizadoId: null, tripPanel: 'activos' as const, inspections: [],
    selectedInspectionId: null, onSelectInspection: vi.fn(), viajesRealizados: [],
    activeTripFlyPoints: [], panelBoundsPoints: [], realizadoFlyPoints: [], mapColRef: React.createRef<HTMLDivElement>(),
  };
  render(<MemoryRouter><ControlMap {...props} /></MemoryRouter>);
  return onToggleLayer;
}

describe('Actionable map legend', () => {
  it.each([
    ['Generadores', 'factory', ACTOR_COLORS.generador, 'generadores'],
    ['Transportistas', 'truck', ACTOR_COLORS.transportista, 'transportistas'],
    ['Operadores', 'flask-conical', ACTOR_COLORS.operador, 'operadores'],
    ['Inspecciones', 'clipboard-check', ACTOR_COLORS.inspeccion, 'inspecciones'],
    ['En Tránsito', 'navigation', ACTOR_COLORS.enTransito, 'transito'],
  ])('identifies %s with the marker glyph and preserves the exact toggle action', (name, glyph, color, key) => {
    const toggle = map(true);
    const button = screen.getByRole('button', { name });
    expect(button.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
    expect(button.querySelector('[data-map-symbol]')).toHaveStyle({ backgroundColor: color });
    expect(button).toHaveAttribute('aria-pressed', String(key !== 'operadores'));
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledExactlyOnceWith(key);
  });

  it('offers no inspection control to accounts without the layer', () => {
    map();
    expect(screen.queryByRole('button', { name: 'Inspecciones' })).not.toBeInTheDocument();
  });

  it('keeps an offered-but-hidden inspection layer available to turn back on', () => {
    map(false);
    expect(screen.getByRole('button', { name: 'Inspecciones' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not repeat the map layers in the global date filter bar', () => {
    const props = { countdown: 30, datePreset: 30, fechaDesde: '2026-09-03', fechaHasta: '2026-10-03',
      layers: { generadores: true, transportistas: true, operadores: true, transito: true, inspecciones: true },
      onManualRefresh: vi.fn(), onDatePreset: vi.fn(), onFechaDesde: vi.fn(), onFechaHasta: vi.fn(), onToggleLayer: vi.fn() };
    render(<ControlFilters {...props} />);
    expect(screen.queryByRole('button', { name: 'Generadores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Capas del mapa' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeInTheDocument();
  });
});

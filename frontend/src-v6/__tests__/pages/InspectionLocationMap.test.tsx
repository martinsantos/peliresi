import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InspectionFieldLocation } from '../../types/inspection';

// Leaflet does not run in jsdom: the map is reduced to its center, the move handler and the drawn layers.
const leaflet = vi.hoisted(() => ({ move: undefined as undefined | (() => void), click: undefined as undefined | (() => void), center: { lat: -32.89, lng: -68.84 }, dragging: false }));
vi.mock('leaflet', () => ({ divIcon: (o: unknown) => o }));
vi.mock('../../utils/map-icons', () => ({ ACTOR_ICONS: { inspeccion: {} } }));
vi.mock('react-leaflet', () => {
  const container = document.createElement('div');
  const map = { getZoom: () => 17, getCenter: () => leaflet.center, setView: vi.fn(), invalidateSize: vi.fn(), getContainer: () => container, project: () => ({ x: 0, y: 0 }),
    dragging: { enable: () => { leaflet.dragging = true; }, disable: () => { leaflet.dragging = false; } }, touchZoom: { enable: vi.fn(), disable: vi.fn() } };
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
    TileLayer: () => null,
    Marker: ({ title }: { title: string }) => <span data-testid="marker">{title}</span>,
    Polygon: ({ positions }: { positions: unknown[] }) => <span data-testid="polygon">{positions.length}</span>,
    Polyline: () => <span data-testid="polyline" />,
    CircleMarker: () => <span data-testid="vertex" />,
    useMap: () => map,
    useMapEvents: (handlers: { move: typeof leaflet.move; click: typeof leaflet.click }) => { leaflet.move = handlers.move; leaflet.click = handlers.click; return map; },
  };
});
import InspectionLocationMap from '../../pages/inspecciones/InspectionLocationMap';

const base: InspectionFieldLocation = { latitud: -32.89, longitud: -68.84, origen: 'MANUAL', registradaAt: '2026-11-03T15:00:00.000Z', zoom: 17, mapaImagen: 'data:image/png;base64,AAAA', mapaZoom: 17 };
let last: InspectionFieldLocation | undefined;
function Harness({ initial, disabled = false }: { initial?: InspectionFieldLocation; disabled?: boolean }) {
  const [value, setValue] = useState(initial); last = value;
  return <InspectionLocationMap value={value} disabled={disabled} onChange={v => { last = v; setValue(v); }} />;
}
// Set per test: the suite config restores stubbed globals between tests.
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); leaflet.center = { lat: -32.89, lng: -68.84 }; });
/** The inspector drags the map: the cross (map center) moves, the finger places nothing. */
const pan = (lat: number, lng: number) => act(() => { leaflet.center = { lat, lng }; leaflet.move!(); });
const mark = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
afterEach(() => { cleanup(); last = undefined; });

describe('mapa de la inspección: cruz fija, sector y referencias', () => {
  it('registra el punto donde está la cruz, nunca donde se toca', () => {
    render(<Harness />);
    expect(screen.queryByRole('group', { name: 'Qué marcar en el mapa' })).toBeNull();
    pan(-32.9, -68.85);
    mark('Marcar el punto aquí');
    expect(last).toMatchObject({ latitud: -32.9, longitud: -68.85, origen: 'MAPA', zoom: 17 });
    expect(screen.getByText('Punto registrado · -32.900000, -68.850000 · marcado en el mapa')).toBeTruthy();
    expect(screen.getByTestId('map-crosshair')).toBeTruthy();
  });

  it('traza el sector vértice a vértice con la distancia a la vista y lo cierra con tres', () => {
    render(<Harness initial={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sector' }));
    pan(-32.8891, -68.84);
    expect(screen.getByText('La cruz está a 100 m del punto.')).toBeTruthy();
    mark('Agregar vértice aquí');
    pan(-32.89, -68.84); mark('Agregar vértice aquí');
    expect(screen.getByText(/2 vértices · falta 1 para cerrarlo/)).toBeTruthy();
    pan(-32.8891, -68.8389); mark('Agregar vértice aquí');
    expect(last?.perimetro).toHaveLength(3); expect(last?.mapaImagen).toBeUndefined();
    expect(screen.getByTestId('polygon').textContent).toBe('3');
    expect(screen.getByText(/3 vértices · superficie aprox\. .* · perímetro aprox\./)).toBeTruthy();
    expect(screen.queryByText(/Guardar vista/)).toBeNull();
    mark('Deshacer');
    expect(last?.perimetro).toHaveLength(2);
    mark('Borrar sector');
    expect(last?.perimetro).toBeUndefined();
  });

  it('marca referencias numeradas con tipo, descripción y distancia', () => {
    render(<Harness initial={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Referencias' }));
    pan(-32.8891, -68.84); mark('Agregar referencia aquí');
    expect(screen.getByText('Referencia 1 · a 100 m del punto')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'CURSO_AGUA' } });
    fireEvent.change(screen.getByLabelText('Descripción breve'), { target: { value: 'Acequia al norte' } });
    expect(last?.referencias?.[0]).toMatchObject({ tipo: 'CURSO_AGUA', etiqueta: 'Acequia al norte' });
    expect(screen.getAllByTestId('marker').map(m => m.textContent)).toContain('1. Acequia al norte');
    mark('Quitar referencia 1');
    expect(last?.referencias).toBeUndefined();
  });

  it('rechaza marcas a más de 10 km y conserva el trazado al mover el punto', () => {
    render(<Harness initial={{ ...base, perimetro: [{ latitud: -32.89, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.8389 }] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Referencias' }));
    pan(-33.1, -68.84); mark('Agregar referencia aquí');
    expect(last?.referencias).toBeUndefined();
    expect(screen.getByText(/más de 10 km/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Punto' }));
    pan(-32.8895, -68.8395); mark('Marcar el punto aquí');
    expect(last).toMatchObject({ latitud: -32.8895, longitud: -68.8395, origen: 'MAPA' });
    expect(last?.perimetro).toHaveLength(3); expect(last?.mapaImagen).toBeUndefined();
  });

  it('en un teléfono deja pasar el scroll hasta que se toca el mapa', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    try {
      render(<Harness initial={base} />);
      expect(leaflet.dragging).toBe(false);
      expect(screen.getByText('Tocá el mapa para moverlo')).toBeTruthy();
      act(() => leaflet.click!());
      expect(leaflet.dragging).toBe(true);
      expect(screen.queryByText('Tocá el mapa para moverlo')).toBeNull();
      act(() => { window.dispatchEvent(new Event('scroll')); });
      expect(leaflet.dragging).toBe(false);
    } finally { Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 }); }
  });

  it('en modo lectura muestra el trazado sin cruz ni controles de edición', () => {
    render(<Harness disabled initial={{ ...base, referencias: [{ id: 'r', tipo: 'VIVIENDA', etiqueta: 'Casa lindera', latitud: -32.8891, longitud: -68.84 }] }} />);
    expect(screen.queryByRole('button', { name: 'Sector' })).toBeNull();
    expect(screen.queryByTestId('map-crosshair')).toBeNull();
    expect(screen.getByText('Vivienda — Casa lindera')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quitar referencia/ })).toBeNull();
    expect(last?.latitud).toBe(-32.89);
  });
});

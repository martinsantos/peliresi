import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InspectionFieldLocation } from '../../types/inspection';

// Leaflet does not run in jsdom: the map is reduced to the click handler and the drawn layers.
const leaflet = vi.hoisted(() => ({ click: undefined as undefined | ((e: { latlng: { lat: number; lng: number } }) => void) }));
vi.mock('leaflet', () => ({ DomEvent: { disableClickPropagation: vi.fn() }, divIcon: (o: unknown) => o }));
vi.mock('../../utils/map-icons', () => ({ ACTOR_ICONS: { inspeccion: {} } }));
vi.mock('react-leaflet', () => {
  const map = { getZoom: () => 17, setView: vi.fn(), invalidateSize: vi.fn(), getContainer: () => document.createElement('div'), project: () => ({ x: 0, y: 0 }) };
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
    TileLayer: () => null,
    Marker: ({ title }: { title: string }) => <span data-testid="marker">{title}</span>,
    Polygon: ({ positions }: { positions: unknown[] }) => <span data-testid="polygon">{positions.length}</span>,
    Polyline: () => <span data-testid="polyline" />,
    CircleMarker: () => <span data-testid="vertex" />,
    useMap: () => map,
    useMapEvents: (handlers: { click: typeof leaflet.click }) => { leaflet.click = handlers.click; return map; },
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
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
const tap = (lat: number, lng: number) => act(() => leaflet.click!({ latlng: { lat, lng } }));
afterEach(() => { cleanup(); last = undefined; });

describe('mapa de la inspección: punto, sector y referencias', () => {
  it('pide primero el punto y lo registra al tocar el mapa', () => {
    render(<Harness />);
    expect((screen.getByRole('button', { name: 'Sector' }) as HTMLButtonElement).disabled).toBe(true);
    tap(-32.9, -68.85);
    expect(last).toMatchObject({ latitud: -32.9, longitud: -68.85, origen: 'MAPA' });
  });

  it('traza el sector, muestra superficie y obliga a guardar otra vista', () => {
    render(<Harness initial={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sector' }));
    tap(-32.89, -68.84); tap(-32.8891, -68.84);
    expect(screen.getByText('2 vértices · falta 1 para cerrar el sector.')).toBeTruthy();
    tap(-32.8891, -68.8389);
    expect(last?.perimetro).toHaveLength(3); expect(last?.mapaImagen).toBeUndefined();
    expect(screen.getByTestId('polygon').textContent).toBe('3');
    expect(screen.getByText(/3 vértices · superficie ≈ .* · perímetro ≈/)).toBeTruthy();
    expect(screen.getByText(/todavía no tiene la vista con el sector y las referencias actuales/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer último vértice' }));
    expect(last?.perimetro).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar sector' }));
    expect(last?.perimetro).toBeUndefined();
  });

  it('marca referencias numeradas con tipo, descripción y distancia', () => {
    render(<Harness initial={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Referencia' }));
    tap(-32.8891, -68.84);
    expect(screen.getByText('Referencia 1 · ≈ 100 m')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'CURSO_AGUA' } });
    fireEvent.change(screen.getByLabelText('Descripción breve'), { target: { value: 'Acequia al norte' } });
    expect(last?.referencias?.[0]).toMatchObject({ tipo: 'CURSO_AGUA', etiqueta: 'Acequia al norte' });
    expect(screen.getAllByTestId('marker').map(m => m.textContent)).toContain('1. Acequia al norte');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar referencia 1' }));
    expect(last?.referencias).toBeUndefined();
  });

  it('rechaza marcas a más de 10 km y conserva el trazado al mover el punto', () => {
    render(<Harness initial={{ ...base, perimetro: [{ latitud: -32.89, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.8389 }] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Referencia' }));
    tap(-33.1, -68.84);
    expect(last?.referencias).toBeUndefined();
    expect(screen.getByText(/más de 10 km/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Punto' }));
    tap(-32.8895, -68.8395);
    expect(last).toMatchObject({ latitud: -32.8895, longitud: -68.8395, origen: 'MAPA' });
    expect(last?.perimetro).toHaveLength(3); expect(last?.mapaImagen).toBeUndefined();
  });

  it('en modo lectura muestra el trazado sin controles de edición', () => {
    render(<Harness disabled initial={{ ...base, referencias: [{ id: 'r', tipo: 'VIVIENDA', etiqueta: 'Casa lindera', latitud: -32.8891, longitud: -68.84 }] }} />);
    expect(screen.queryByRole('button', { name: 'Sector' })).toBeNull();
    expect(screen.getByText('Vivienda — Casa lindera')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quitar referencia/ })).toBeNull();
    tap(-32.8, -68.8);
    expect(last?.latitud).toBe(-32.89);
  });
});

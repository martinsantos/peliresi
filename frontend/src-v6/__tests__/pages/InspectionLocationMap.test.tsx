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
    Circle: ({ radius }: { radius: number }) => <span data-testid="circle">{radius}</span>,
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
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
afterEach(() => { cleanup(); last = undefined; });

describe('mapa de la inspección: estoy acá, radio del predio y referencias', () => {
  it('«Estoy acá» toma el punto del GPS y con eso alcanza', () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -32.9, longitude: -68.85, accuracy: 8 } }) } });
    render(<Harness />);
    expect(screen.getByTestId('map-crosshair')).toBeTruthy();
    tap('Estoy acá');
    expect(last).toMatchObject({ latitud: -32.9, longitud: -68.85, origen: 'GPS', precisionMetros: 8 });
    expect(screen.queryByTestId('map-crosshair')).toBeNull();
    expect(screen.getByRole('group', { name: 'Radio del predio' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Es un punto' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sin GPS, la cruz marca el punto; «Mover el punto» vuelve a mostrarla', () => {
    render(<Harness />);
    pan(-32.9, -68.85);
    tap('Marcar el punto aquí');
    expect(last).toMatchObject({ latitud: -32.9, longitud: -68.85, origen: 'MAPA', zoom: 17 });
    expect(screen.getByText('Punto registrado · -32.900000, -68.850000 · marcado en el mapa')).toBeTruthy();
    expect(screen.queryByTestId('map-crosshair')).toBeNull();
    tap('Mover el punto');
    expect(screen.getByTestId('map-crosshair')).toBeTruthy();
    pan(-32.91, -68.86); tap('Marcar el punto aquí');
    expect(last).toMatchObject({ latitud: -32.91, longitud: -68.86 });
  });

  it('el punto crece a un predio con un radio y el círculo sigue al punto', () => {
    render(<Harness initial={base} />);
    tap('250 m');
    expect(last?.radioMetros).toBe(250); expect(last?.perimetro).toHaveLength(24); expect(last?.mapaImagen).toBeUndefined();
    expect(screen.getByTestId('circle').textContent).toBe('250');
    expect(screen.getByText(/Predio aproximado: radio de 250 m · superficie aprox\./)).toBeTruthy();
    tap('Mover el punto'); pan(-32.8895, -68.8395); tap('Marcar el punto aquí');
    expect(last?.radioMetros).toBe(250); expect(last?.perimetro?.[0]).toMatchObject({ latitud: expect.closeTo(-32.8895 + 250 / 111320, 6) });
    fireEvent.change(screen.getByLabelText('Radio en metros'), { target: { value: '800' } }); fireEvent.blur(screen.getByLabelText('Radio en metros'));
    expect(last?.radioMetros).toBe(800);
    tap('Es un punto');
    expect(last?.radioMetros).toBeUndefined(); expect(last?.perimetro).toBeUndefined();
  });

  it('las referencias se nombran pegadas al mapa apenas se marcan', () => {
    render(<Harness initial={base} />);
    tap('Agregar referencia');
    expect(screen.getByTestId('map-crosshair')).toBeTruthy();
    pan(-32.8891, -68.84);
    expect(screen.getByText('La cruz está a 100 m del punto.')).toBeTruthy();
    tap('Marcar la referencia aquí');
    expect(screen.queryByTestId('map-crosshair')).toBeNull();
    expect(screen.getByText('Referencia 1 · a 100 m del punto')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Qué es'), { target: { value: 'CURSO_AGUA' } });
    fireEvent.change(screen.getByLabelText('Descripción breve'), { target: { value: 'Acequia al norte' } });
    expect(last?.referencias?.[0]).toMatchObject({ tipo: 'CURSO_AGUA', etiqueta: 'Acequia al norte' });
    expect(screen.getAllByTestId('marker').map(m => m.textContent)).toContain('1. Acequia al norte');
    tap('Quitar referencia 1');
    expect(last?.referencias).toBeUndefined();
  });

  it('rechaza referencias a más de 10 km y conserva un trazado anterior hasta reemplazarlo', () => {
    render(<Harness initial={{ ...base, perimetro: [{ latitud: -32.89, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.84 }, { latitud: -32.8891, longitud: -68.8389 }] }} />);
    expect(screen.getByText(/Hay un trazado anterior de 3 vértices/)).toBeTruthy();
    expect(screen.getByTestId('polygon').textContent).toBe('3');
    tap('Agregar referencia'); pan(-33.1, -68.84); tap('Marcar la referencia aquí');
    expect(last?.referencias).toBeUndefined();
    expect(screen.getByText(/más de 10 km/)).toBeTruthy();
    tap('Cancelar');
    tap('100 m');
    expect(last?.radioMetros).toBe(100); expect(last?.perimetro).toHaveLength(24);
  });

  it('en un teléfono deja pasar el scroll hasta que se toca el mapa', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    try {
      render(<Harness initial={base} />);
      expect(leaflet.dragging).toBe(false);
      expect(screen.getByText('Tocá el mapa para moverlo')).toBeTruthy();
      act(() => leaflet.click!());
      expect(leaflet.dragging).toBe(true);
      act(() => { window.dispatchEvent(new Event('scroll')); });
      expect(leaflet.dragging).toBe(false);
    } finally { Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 }); }
  });

  it('en modo lectura muestra el predio y las referencias sin controles', () => {
    render(<Harness disabled initial={{ ...base, radioMetros: 250, perimetro: Array.from({ length: 24 }, () => ({ latitud: -32.89, longitud: -68.84 })), referencias: [{ id: 'r', tipo: 'VIVIENDA', etiqueta: 'Casa lindera', latitud: -32.8891, longitud: -68.84 }] }} />);
    expect(screen.queryByRole('button', { name: 'Estoy acá' })).toBeNull();
    expect(screen.queryByTestId('map-crosshair')).toBeNull();
    expect(screen.getByText('Predio aproximado: radio de 250 m alrededor del punto.')).toBeTruthy();
    expect(screen.getByText('Vivienda — Casa lindera')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quitar referencia/ })).toBeNull();
  });
});

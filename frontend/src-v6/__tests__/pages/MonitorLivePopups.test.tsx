import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WarRoomMap } from '../../pages/monitor/components/WarRoomMap';
import type { ActorPosition, EnTransitoItem } from '../../pages/monitor/api/monitor-api';

const runtime = vi.hoisted(() => ({ markers: vi.fn(), map: { on: vi.fn(), off: vi.fn(),
  getSize: () => ({ x: 360, y: 240 }), getContainer: vi.fn() } }));
vi.mock('leaflet', () => ({ default: { divIcon: (options: unknown) => ({ options }) } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Polyline: () => null,
  Marker: (props: { children: React.ReactNode; title?: string; alt?: string }) => { runtime.markers(props); return <div>{props.children}</div>; },
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => runtime.map,
}));
vi.mock('../../pages/inspecciones/InspectionMapLayer', () => ({ InspectionMapLayer: () => null }));
const address = 'QA domicilio largo y completo, acceso por portón del fondo, distrito industrial sin abreviatura';
const actor = (id: string, razonSocial: string): ActorPosition => ({ id, razonSocial, lat: -32.9, lng: -68.8, domicilio: address, cuit: '99-00000000-1' });
const trip: EnTransitoItem = { manifiestoId: 'qa-trip', numero: 'QA-TRIP-001', transportista: 'QA Transporte', origen: { razonSocial: 'QA Generador', lat: -32.9, lng: -68.8 }, destino: { razonSocial: 'QA Operador', lat: -32.9, lng: -68.8 }, fechaRetiro: null, ultimaPosicion: { latitud: -32.9, longitud: -68.8, velocidad: 0, timestamp: '2026-10-05T12:00:00Z' }, ruta: [], vehiculo: { patente: 'QA001', descripcion: 'Vehículo de prueba' } };
const View = () => <WarRoomMap cinemaMode={false} mode="LIVE" actores={{ generadores: [actor('qa-g', 'QA Generador')], transportistas: [actor('qa-t', 'QA Transporte')], operadores: [actor('qa-o', 'QA Operador')] }} enTransito={[trip]} />;
beforeEach(() => {
  vi.clearAllMocks();
  const container = document.createElement('div');
  container.getBoundingClientRect = () => ({ left: 0, right: 360, top: 100, bottom: 340, width: 360, height: 240, x: 0, y: 100, toJSON: () => ({}) });
  runtime.map.getContainer.mockReturnValue(container);
});
afterEach(cleanup);

it('names every live marker for keyboard and touch discovery', () => {
  render(<View />);
  const props = runtime.markers.mock.calls.map(([value]) => value);
  expect(props.map(value => value.title)).toEqual(['Generador: QA Generador', 'Transportista: QA Transporte', 'Operador: QA Operador', 'Viaje en tránsito: QA-TRIP-001']);
  for (const marker of props) expect(marker.alt).toBe(marker.title);
});

it('uses bounded shared popups and the same category glyphs, without negative header margins', () => {
  const { container } = render(<View />);
  const bodies = screen.getAllByTestId('monitor-live-popup');
  expect(bodies).toHaveLength(4);
  for (const body of bodies) {
    expect(body).toHaveStyle({ minWidth: '0', maxWidth: '100%', overflowWrap: 'anywhere' });
    expect(body.querySelector('header')).toBeInTheDocument();
    expect(body.querySelector('header')).not.toHaveStyle({ margin: '-12px -20px 8px' });
  }
  expect([...container.querySelectorAll('[data-map-symbol]')].map(el => el.getAttribute('data-map-symbol'))).toEqual(['generador', 'transportista', 'operador', 'enTransito']);
  expect(container.querySelectorAll('svg.lucide-flask-conical')).toHaveLength(1);
});

it('keeps full addresses and a measured zero speed rather than clipping or inventing missing data', () => {
  render(<View />);
  for (const line of screen.getAllByText(address)) {
    expect(line).toHaveStyle({ whiteSpace: 'normal', overflowWrap: 'anywhere' });
  }
  expect(screen.getByText('0 km/h')).toBeVisible();
  expect(screen.getByText('QA001')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('bounds the open popup to the actual short map and keeps keyboard scrolling away from map pan', () => {
  const { unmount } = render(<View />);
  const handlers = runtime.map.on.mock.calls.find(([events]) => events.popupopen)?.[0];
  expect(handlers, 'A fixed 220px content exceeds the 240px map after popup chrome and safe padding').toBeTruthy();
  const element = document.createElement('div'); element.style.marginBottom = '7px';
  const content = document.createElement('div'); content.className = 'leaflet-popup-content';
  Object.defineProperty(element, 'offsetHeight', { value: 270 });
  Object.defineProperty(content, 'offsetHeight', { value: 220 });
  element.append(content);
  const popup = { options: { maxHeight: 220 }, getElement: () => element, update: vi.fn() };
  act(() => handlers.popupopen({ popup }));
  expect(popup.options.maxHeight).toBeLessThan(160);
  expect(popup.options.maxHeight).toBeGreaterThanOrEqual(44);
  expect(popup.update).toHaveBeenCalled();
  expect(content.tabIndex).toBe(0);
  const pan = vi.fn(); element.addEventListener('keydown', pan);
  content.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  expect(pan).not.toHaveBeenCalled();
  // Do not suppress ordinary keyboard actions or close-button Enter.
  content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(pan).toHaveBeenCalledOnce();
  unmount(); expect(runtime.map.off).toHaveBeenCalledWith(handlers);
  pan.mockClear();
  content.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(pan).toHaveBeenCalledOnce();
});

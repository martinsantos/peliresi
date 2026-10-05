import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WarRoomMap } from '../../pages/monitor/components/WarRoomMap';
import type { ActorPosition, EnTransitoItem } from '../../pages/monitor/api/monitor-api';

const runtime = vi.hoisted(() => ({ markers: vi.fn() }));
vi.mock('leaflet', () => ({ default: { divIcon: (options: unknown) => ({ options }) } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Polyline: () => null,
  Marker: (props: { children: React.ReactNode; title?: string; alt?: string }) => { runtime.markers(props); return <div>{props.children}</div>; },
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../pages/inspecciones/InspectionMapLayer', () => ({ InspectionMapLayer: () => null }));
const address = 'QA domicilio largo y completo, acceso por portón del fondo, distrito industrial sin abreviatura';
const actor = (id: string, razonSocial: string): ActorPosition => ({ id, razonSocial, lat: -32.9, lng: -68.8, domicilio: address, cuit: '99-00000000-1' });
const trip: EnTransitoItem = { manifiestoId: 'qa-trip', numero: 'QA-TRIP-001', transportista: 'QA Transporte', origen: { razonSocial: 'QA Generador', lat: -32.9, lng: -68.8 }, destino: { razonSocial: 'QA Operador', lat: -32.9, lng: -68.8 }, fechaRetiro: null, ultimaPosicion: { latitud: -32.9, longitud: -68.8, velocidad: 0, timestamp: '2026-10-05T12:00:00Z' }, ruta: [], vehiculo: { patente: 'QA001', descripcion: 'Vehículo de prueba' } };
const View = () => <WarRoomMap cinemaMode={false} mode="LIVE" actores={{ generadores: [actor('qa-g', 'QA Generador')], transportistas: [actor('qa-t', 'QA Transporte')], operadores: [actor('qa-o', 'QA Operador')] }} enTransito={[trip]} />;
beforeEach(() => vi.clearAllMocks());
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

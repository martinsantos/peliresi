import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WarRoomMap } from '../../pages/monitor/components/WarRoomMap';

const runtime = vi.hoisted(() => {
  const layer = () => {
    const value = { addTo: vi.fn(), setLatLng: vi.fn(), setIcon: vi.fn(), setRadius: vi.fn(), setStyle: vi.fn(),
      bindPopup: vi.fn(), setPopupContent: vi.fn() };
    for (const fn of Object.values(value)) fn.mockReturnValue(value);
    return value;
  };
  return { marker: vi.fn(layer), polyline: vi.fn(layer), circleMarker: vi.fn(layer),
    map: { removeLayer: vi.fn(), getBounds: () => ({ contains: () => true }), panTo: vi.fn() } };
});
vi.mock('leaflet', () => ({ default: { divIcon: (options: unknown) => ({ options }),
  marker: runtime.marker, polyline: runtime.polyline, circleMarker: runtime.circleMarker, latLng: (...coordinates: number[]) => coordinates } }));
vi.mock('react-leaflet', () => ({ MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Marker: () => null, Popup: () => null, Polyline: () => null, useMap: () => runtime.map }));
vi.mock('../../pages/inspecciones/InspectionMapLayer', () => ({ InspectionMapLayer: () => null }));

const trips = new Map([['qa-trip', { lat: -32.9, lng: -68.8, trail: [[-32.9, -68.8]] as [number, number][] }]]);
const props = { cinemaMode: false, actores: null, enTransito: [], mode: 'PLAYBACK' as const, playbackTrips: trips };

describe('Monitor playback has one marker per trip and no persistent competing labels', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('retains an accessible selectable detail instead of a second noninteractive label marker', () => {
    const { rerender, unmount } = render(<WarRoomMap {...props} />);
    expect(runtime.marker).toHaveBeenCalledTimes(1);
    const marker = runtime.marker.mock.results[0].value;
    expect(marker.bindPopup).toHaveBeenCalled();
    const content = marker.bindPopup.mock.calls[0][0] as HTMLElement;
    expect(content.textContent).toContain('EN TRÁNSITO');
    expect(content.textContent).toContain('QA-TRIP');
    rerender(<WarRoomMap {...props} playbackTrips={new Map([['qa-trip', { lat: -32.8, lng: -68.7, trail: [[-32.9, -68.8], [-32.8, -68.7]] }]])} />);
    expect(runtime.marker).toHaveBeenCalledTimes(1);
    expect(marker.setLatLng).toHaveBeenCalledWith([-32.8, -68.7]);
    expect(marker.setPopupContent).toHaveBeenCalled();
    unmount();
    expect(runtime.map.removeLayer).toHaveBeenCalledWith(marker);
  });

  it('keeps event circles without competing text labels and cancels animation on leaving playback', () => {
    const frame = vi.fn(() => 42), cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', frame);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const { unmount } = render(<WarRoomMap {...props} playbackTrips={new Map()} playbackEvents={[{ id: 'event-qa', tipo: 'ENTREGA', lat: -32.9, lng: -68.8, numero: 'QA-1' }]} />);
    expect(runtime.circleMarker).toHaveBeenCalledTimes(1);
    expect(runtime.marker).not.toHaveBeenCalled();
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(runtime.map.removeLayer).toHaveBeenCalledWith(runtime.circleMarker.mock.results[0].value);
  });
});

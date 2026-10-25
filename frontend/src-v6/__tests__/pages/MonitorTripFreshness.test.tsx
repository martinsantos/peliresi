import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FloatingPanelLayer, useFloatingPanels, type FloatingPanel } from '../../pages/monitor/components/FloatingPanelLayer';
import { MonitorPosition, positionAge } from '../../pages/monitor/components/MonitorPosition';
import type { EnTransitoItem } from '../../pages/monitor/api/monitor-api';

const now = Date.parse('2026-10-25T15:00:00Z');
const trip: EnTransitoItem = { manifiestoId: 'qa-1', numero: 'QA-1', transportista: 'Transporte anterior', origen: { razonSocial: 'Origen', lat: null, lng: null }, destino: { razonSocial: 'Destino', lat: null, lng: null }, fechaRetiro: null,
  ultimaPosicion: { latitud: -32.9, longitud: -68.8, timestamp: '2026-10-25T14:50:00Z', velocidad: 20 }, ruta: [] };
const panel: FloatingPanel = { id: 'v-qa-1', type: 'viaje', data: trip, pos: { x: 8, y: 8 }, zIndex: 1100, minimized: false };
const callbacks = { onClose: vi.fn(), onMove: vi.fn(), onBringToFront: vi.fn(), onMinimize: vi.fn() };
afterEach(cleanup);

it('an open trip follows new readings without reopening or losing its position', () => {
  const view = render(<FloatingPanelLayer panels={[panel]} liveTrips={[trip]} now={now} {...callbacks} />);
  expect(screen.getByText('Última posición hace 10 min')).toBeVisible();
  view.rerender(<FloatingPanelLayer panels={[panel]} liveTrips={[{ ...trip, transportista: 'Relevo vigente', ultimaPosicion: { ...trip.ultimaPosicion!, timestamp: '2026-10-25T14:59:50Z', velocidad: 0 } }]} now={now} {...callbacks} />);
  expect(screen.getByText('Relevo vigente')).toBeVisible();
  expect(screen.queryByText('Transporte anterior')).not.toBeInTheDocument();
  expect(screen.getByText('Última posición hace menos de un minuto')).toBeVisible();
  expect(screen.getByText('Velocidad registrada: 0 km/h')).toBeVisible();
  expect(view.container.querySelector('.fp-window')).toHaveStyle({ left: '8px', top: '8px' });
});

it('a failed update identifies a retained reading without asserting delivery or live location', () => {
  render(<FloatingPanelLayer panels={[panel]} liveTrips={[trip]} liveCurrent={false} now={now} {...callbacks} />);
  expect(screen.getByRole('status')).toHaveTextContent('Sin actualizar');
  expect(screen.getByText('Última posición hace 10 min')).toBeVisible();
});

it('a missing trip in a successful response removes the old GPS without inventing a terminal state', () => {
  render(<FloatingPanelLayer panels={[panel]} liveTrips={[]} liveCurrent now={now} {...callbacks} />);
  expect(screen.getByRole('status')).toHaveTextContent('ya no figura en tránsito');
  expect(screen.getByRole('status')).toHaveTextContent('no confirma entrega ni finalización');
  expect(screen.queryByText(/Velocidad registrada/)).not.toBeInTheDocument();
  expect(screen.getByText('Viaje', { exact: true })).toBeVisible();
  expect(screen.queryByText('En Tránsito', { exact: true })).not.toBeInTheDocument();
});

it('opening the same panel again updates its data instead of freezing the first snapshot', () => {
  const { result } = renderHook(() => useFloatingPanels());
  act(() => result.current.openPanel('viaje', trip, panel.id));
  act(() => result.current.openPanel('viaje', { ...trip, transportista: 'Nuevo' }, panel.id));
  expect(result.current.panels).toHaveLength(1);
  expect((result.current.panels[0].data as EnTransitoItem).transportista).toBe('Nuevo');
});

it('a mode or authorization context never displays the previous context panels', () => {
  const { result, rerender } = renderHook(({ context }) => useFloatingPanels(context), { initialProps: { context: 'LIVE:admin-a' } });
  act(() => result.current.openPanel('viaje', trip, panel.id));
  rerender({ context: 'PLAYBACK:admin-a' }); expect(result.current.panels).toHaveLength(0);
  rerender({ context: 'LIVE:admin-b' }); expect(result.current.panels).toHaveLength(0);
});

it.each([
  [undefined, 'Sin posición recibida'], ['invalid', 'Fecha de posición no válida'],
  ['2026-10-25T15:01:00Z', 'Fecha de posición adelantada; revisar reloj'],
  ['2026-10-25T14:00:00Z', 'Última posición hace 1 h'], ['2026-10-23T15:00:00Z', 'Última posición hace 2 días'],
])('describes missing, invalid and old positions honestly: %s', (timestamp, expected) => {
  expect(positionAge(timestamp, now)).toBe(expected);
});

it('age advances without a new API reading and preserves the full Mendoza timestamp', () => {
  const view = render(<MonitorPosition position={trip.ultimaPosicion} now={now} />);
  view.rerender(<MonitorPosition position={trip.ultimaPosicion} now={now + 60000} />);
  expect(screen.getByText('Última posición hace 11 min')).toBeVisible();
  expect(view.container.querySelector('time')).toHaveAttribute('datetime', '2026-10-25T14:50:00Z');
  expect(view.container.querySelector('time')).toHaveTextContent('11:50:00');
});

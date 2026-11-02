import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DashboardPanels } from '../../pages/monitor/components/DashboardPanels';
import { TimelineControls } from '../../pages/monitor/components/TimelineControls';
import type { MonitorLiveResponse } from '../../pages/monitor/api/monitor-api';

const liveData: MonitorLiveResponse = {
  estadisticas: { porEstado: {}, total: 0, manifiestosHoy: 0, toneladas: 0, enTransitoActivos: 0 },
  enTransito: [], eventosRecientes: [],
  actores: { generadores: [], transportistas: [], operadores: [] },
  topGeneradores: [{ razonSocial: 'QA actor de hoy', cantidad: 3 }], topOperadores: [],
  porDia: [], topResiduos: [{ nombre: 'QA residuo de hoy', total: 3, categoria: null }],
  tratamientosActivos: [{ metodo: 'QA tratamiento de hoy', cantidad: 1 }],
};
function panel(state: 'ready' | 'stale' | 'loading' | 'error' | 'offline', mode: 'LIVE' | 'PLAYBACK' | 'FORECAST' = 'LIVE') {
  return render(<MemoryRouter><DashboardPanels mode={mode} dataState={state}
    liveData={liveData} forecastData={null} timelineData={null}
    inspections={mode === 'LIVE' ? [] : undefined} /></MemoryRouter>);
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('wr-widget-states-v2', JSON.stringify({ actores: 'visible', residuos: 'visible', tratamiento: 'visible' }));
});
afterEach(cleanup);

it.each([
  ['loading', 'Cargando los datos del Monitor'],
  ['error', 'No pudimos cargar los datos del Monitor'],
  ['offline', 'Sin conexión'],
] as const)('shows %s rather than claiming a successful empty result', (state, text) => {
  panel(state);
  expect(screen.getByText(new RegExp(text))).toBeVisible();
  expect(screen.queryByText('Sin viajes activos')).not.toBeInTheDocument();
  expect(screen.queryByText('Sin eventos recientes')).not.toBeInTheDocument();
  expect(screen.queryByText('Estados del manifiesto')).not.toBeInTheDocument();
  expect(screen.getByText('Sin inspecciones activas')).toBeVisible();
});

it('distinguishes a confirmed empty result from an empty retained snapshot', () => {
  const view = panel('ready');
  expect(screen.getByText('Sin viajes activos')).toBeVisible();
  view.unmount();
  panel('stale');
  expect(screen.getByText(/Consulta sin actualizar/)).toBeVisible();
  expect(screen.getByText(/La última consulta no tenía viajes/)).toBeVisible();
  expect(screen.getByText(/La última consulta no tenía eventos/)).toBeVisible();
  expect(screen.queryByText('Sin viajes activos')).not.toBeInTheDocument();
});

it('never substitutes live rankings into a history without data', () => {
  panel('ready', 'PLAYBACK');
  expect(screen.queryByText('QA actor de hoy')).not.toBeInTheDocument();
  expect(screen.queryByText('QA residuo de hoy')).not.toBeInTheDocument();
  expect(screen.queryByText('QA tratamiento de hoy')).not.toBeInTheDocument();
});

it('explains when history needs a shorter period', () => {
  render(<MemoryRouter><DashboardPanels mode="PLAYBACK" dataState="error"
    errorDetail="El historial es demasiado grande. Elegí un período más corto."
    liveData={null} forecastData={null} timelineData={null} /></MemoryRouter>);
  expect(screen.getByText(/Elegí un período más corto/)).toBeVisible();
  expect(screen.queryByText(/No pudimos cargar los datos/)).not.toBeInTheDocument();
});

it('keeps history labels and unknown values while history is unavailable', () => {
  render(<TimelineControls mode="PLAYBACK" liveData={liveData} playbackDate="2026-10-25"
    onDateChange={vi.fn()} onSwitchToPlayback={vi.fn()} timelineData={null} isLoading={false} playback={null} />);
  expect(screen.getByText('Creados')).toBeVisible();
  expect(screen.getByText('Tratados')).toBeVisible();
  expect(screen.queryByText('Creados hoy')).not.toBeInTheDocument();
  expect(screen.queryByText('Viajes con GPS')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reproducir historial' })).not.toBeInTheDocument();
});

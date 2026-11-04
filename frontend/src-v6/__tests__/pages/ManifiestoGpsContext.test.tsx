import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ManifiestoDetallePage from '../../pages/manifiestos/ManifiestoDetallePage';

type Point = { id: string; latitud: number; longitud: number; timestamp: string; tramoId: string | null };
const state = vi.hoisted(() => ({ points: [] as Point[], sites: false }));
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  const element = ({ children }: { children?: React.ReactNode }) => React.createElement('div', {}, children);
  return { MapContainer: element, Marker: element, Popup: element, Polyline: () => null, TileLayer: () => null };
});
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'admin', rol: 'ADMIN' }, isAdmin: true }) }));
vi.mock('../../hooks/useManifiestos', () => {
  const mutation = () => ({ isPending: false, mutateAsync: vi.fn() });
  return { useManifiesto: () => ({ data: { id: 'm-1', numero: 'QA-1', estado: 'EN_TRANSITO', modalidad: 'FIJO',
    createdAt: '2026-10-20T12:00:00Z', generadorId: 'g-1', transportistaId: 't-1', operadorId: 'o-1',
    generador: { razonSocial: 'QA Generador', cuit: '30123456789', ...(state.sites ? { latitud: -33, longitud: -69 } : {}) },
    transportista: { razonSocial: 'QA Transporte' }, operador: { razonSocial: 'QA Operador', ...(state.sites ? { latitud: -32, longitud: -68 } : {}) },
    residuos: [], eventos: [], tracking: state.points } }),
    useFirmarManifiesto: mutation, useConfirmarRetiro: mutation, useConfirmarEntrega: mutation,
    useConfirmarRecepcion: mutation, useConfirmarRecepcionInSitu: mutation, usePesaje: mutation,
    useRegistrarTratamiento: mutation, useCerrarManifiesto: mutation, useCancelarManifiesto: mutation,
    useRechazarManifiesto: mutation, useRegistrarIncidente: mutation, useRevertirEstado: mutation };
});
vi.mock('../../components/BlockchainPanel', () => ({ default: () => null }));
vi.mock('../../pages/manifiestos/components/ManifiestoTimeline', () => ({ default: () => null }));
vi.mock('../../pages/manifiestos/components/TrainingCertificates', () => ({ TrainingCertificates: () => null }));
vi.mock('../../pages/manifiestos/components/ManifiestoActions', () => ({ default: () => null }));
vi.mock('../../pages/manifiestos/components/TransportLegs', () => ({ TransportLegs: () => null }));
vi.mock('../../hooks/usePendingDeliveryIds', () => ({ usePendingDeliveryIds: () => ({ ids: new Set(), checking: false, error: false, retry: vi.fn() }) }));
vi.mock('../../services/manifiesto.service', () => ({ manifiestoService: {} }));

let client: QueryClient;
beforeEach(() => { state.points = []; state.sites = false; client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); });
const open = (prefix: string) => render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[prefix + '/manifiestos/m-1']}>
  <Routes><Route path={prefix + '/manifiestos/:id'} element={<ManifiestoDetallePage />} /></Routes>
</MemoryRouter></QueryClientProvider>);
const point = (id: string, timestamp: string): Point => ({ id, timestamp, latitud: -33, longitud: -69, tramoId: null });

for (const prefix of ['', '/app']) {
  test(`identifies reception time and the limited displayed positions on ${prefix || 'web'}`, () => {
    state.points = [point('b', '2026-10-20T12:01:00Z'), point('a', '2026-10-20T12:00:00Z')];
    open(prefix);
    const heading = screen.getByRole('heading', { name: 'Ubicaciones GPS recibidas' });
    const section = heading.closest('section') || heading.parentElement!.parentElement!.parentElement!;
    expect(within(section as HTMLElement).getByText(/La hora de captura no está disponible/)).toBeVisible();
    expect(within(section as HTMLElement).getByText(/Las líneas no confirman el recorrido/)).toBeVisible();
    const times = [...(section as HTMLElement).querySelectorAll('time')];
    expect(times.map(time => time.getAttribute('datetime'))).toEqual(['2026-10-20T12:00:00Z', '2026-10-20T12:01:00Z']);
    expect(times[0]).toHaveTextContent('09:00'); expect(times[1]).toHaveTextContent('09:01');
    expect(screen.getAllByText('Primera posición mostrada').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Última posición recibida').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Ruta realizada')).not.toBeInTheDocument();
    expect(screen.queryByText('Fin GPS')).not.toBeInTheDocument();
  });

  test(`does not claim a route start and end for a single position on ${prefix || 'web'}`, () => {
    state.points = [point('a', '2026-10-20T12:00:00Z')];
    open(prefix);
    expect(screen.getByRole('heading', { name: 'Ubicaciones GPS recibidas' })).toBeVisible();
    expect(screen.getAllByText('Única posición recibida').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Primera posición mostrada')).not.toBeInTheDocument();
    expect(screen.queryByText('Última posición recibida')).not.toBeInTheDocument();
  });

  test(`explains the 100-position window only when it is reached on ${prefix || 'web'}`, () => {
    state.points = Array.from({ length: 100 }, (_, index) => point(`p-${index}`, new Date(Date.parse('2026-10-20T12:00:00Z') + index * 1000).toISOString()));
    open(prefix);
    expect(screen.getByText('Últimos 100 puntos')).toBeVisible();
  });

  test(`keeps both dates when receptions cross midnight in Mendoza on ${prefix || 'web'}`, () => {
    state.points = [point('a', '2026-10-20T23:59:00Z'), point('b', '2026-10-21T03:01:00Z')];
    open(prefix);
    const heading = screen.getByRole('heading', { name: 'Ubicaciones GPS recibidas' });
    const section = heading.closest('section') || heading.parentElement!.parentElement!.parentElement!;
    const times = [...(section as HTMLElement).querySelectorAll('time')];
    expect(times[0]).toHaveTextContent('20/10/2026'); expect(times[1]).toHaveTextContent('21/10/2026');
    expect(times[1]).toHaveTextContent('00:01:00');
  });

  test(`distinguishes current establishment locations when no GPS exists on ${prefix || 'web'}`, () => {
    state.sites = true; open(prefix);
    expect(screen.getByRole('heading', { name: 'Ubicaciones de establecimientos' })).toBeVisible();
    expect(screen.getByText(/Datos actuales de los establecimientos/)).toBeVisible();
    expect(screen.getByText(/La referencia no es una ruta confirmada/)).toBeVisible();
  });
}

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn(), deliver: vi.fn(), pending: new Set<string>(), user: { id: 'qa-carrier', rol: 'TRANSPORTISTA', training: false, actorId: 'qa-actor' } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../services/fleet-gps.service', () => ({ fleetGpsService: { list: mocks.list, send: mocks.send } }));
vi.mock('../../hooks/useManifiestoWorkflow', () => ({ useConfirmarEntrega: () => ({ mutateAsync: ({id,...data}: {id:string}) => mocks.deliver(id, data) }) }));
vi.mock('../../hooks/usePendingDeliveryIds', () => ({ usePendingDeliveryIds: () => ({ ids: mocks.pending, checking: false, error: false, retry: vi.fn() }) }));
import CargasEnCursoPage from '../../pages/transporte/CargasEnCursoPage';
const loads = ['A', 'B'].map(id => ({ key: 'MANIFIESTO:' + id, kind: 'MANIFIESTO', id, numero: 'QA-' + id,
  origen: 'Origen artificial', destino: 'Planta QA', fechaInicio: new Date().toISOString(), referenciaTiempo: 'Desde el retiro', patente: null, puedeEntregar: true, gpsDisponible: true }));
let locate: PositionCallback;
let fail: PositionErrorCallback;
const clearWatch = vi.fn();
beforeEach(() => {
  vi.stubEnv('VITE_TRANSPORT_MULTI_GPS_ENABLED', 'true'); mocks.user.id = 'qa-carrier'; clearWatch.mockClear();
  mocks.list.mockReset().mockImplementation(async search => ({ targets: search ? [] : loads, total: search ? 0 : 2, limit: 100 }));
  mocks.pending.clear(); mocks.send.mockReset().mockResolvedValue({}); mocks.deliver.mockReset().mockResolvedValue({status:'confirmed'});
  vi.stubGlobal('navigator', { geolocation: { watchPosition: vi.fn((ok: PositionCallback, error: PositionErrorCallback) => { locate = ok; fail = error; return 12; }), clearWatch } });
});
it('keeps an uncertain delivery marked and excludes that load from GPS while the other remains selected', async () => {
  mocks.deliver.mockImplementationOnce(async () => { mocks.pending.add('A'); return {status:'pending',message:'No recibimos confirmación.'}; });
  const view=setup(); await chooseAndStart();
  fireEvent.click(screen.getByRole('button',{name:'Entregar QA-A',exact:true}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'Confirmar entrega'})).getByRole('button',{name:'Confirmar entrega de esta carga'}));
  await waitFor(()=>expect(screen.getByText('Entrega pendiente en este dispositivo. Revisá la sincronización.')).toBeVisible());
  expect(screen.getByRole('button',{name:'Entregar QA-A',exact:true})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Entregar QA-B',exact:true})).toBeEnabled();
  expect(screen.getByRole('region',{name:'Cargas marcadas'})).toHaveTextContent('QA-B');
  act(()=>window.dispatchEvent(new CustomEvent('sitrep:gps-delivery-confirmed',{detail:{id:'A',owner:'qa-carrier'}})));
  await waitFor(()=>expect(within(screen.getByRole('region',{name:'Cargas marcadas'})).queryByText('QA-A')).toBeNull());
  expect(screen.getByRole('region',{name:'Cargas marcadas'})).toHaveTextContent('QA-B');
  view.unmount();
});
it('stops tracking a load confirmed by another account in this browser and keeps the other load', async () => {
  const view=setup(); await chooseAndStart();
  act(()=>window.dispatchEvent(new CustomEvent('sitrep:gps-delivery-confirmed',{detail:{id:'A',owner:'other-account'}})));
  const selected=screen.getByRole('region',{name:'Cargas marcadas'});
  await waitFor(()=>expect(within(selected).queryByText('QA-A')).toBeNull());
  expect(selected).toHaveTextContent('QA-B');
  view.unmount();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><CargasEnCursoPage/></MemoryRouter></QueryClientProvider>;
  const view = render(tree()); return { ...view, rerenderSession: () => view.rerender(tree()) };
}
async function chooseAndStart() {
  for (const load of loads) fireEvent.click(await screen.findByRole('checkbox', { name: `Llevo ${load.numero} en este móvil` }));
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Iniciar GPS' }));
  await act(async () => { locate({ coords: { latitude: -33, longitude: -69, accuracy: 10, speed: null, heading: null }, timestamp: Date.now() } as GeolocationPosition); });
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
}
it('retains explicit GPS selections through a search with no matches and keeps one watcher', async () => {
  const view = setup(); await chooseAndStart(); fireEvent.click(screen.getByRole('button', { name: 'Elegir otras cargas' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Número de manifiesto' }), { target: { value: 'no-match' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('No hay cargas en tránsito con ese número.');
  const selected = screen.getByRole('region', { name: 'Cargas marcadas' });
  expect(selected).toHaveTextContent('QA-A'); expect(selected).toHaveTextContent('QA-B');
  expect(navigator.geolocation.watchPosition).toHaveBeenCalledOnce(); view.unmount();
});
it('delivers one explicit load and clears an old GPS session on account change', async () => {
  const view = setup(); await chooseAndStart(); fireEvent.click(screen.getByRole('button', { name: 'Entregar QA-A', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Confirmar entrega' })).getByRole('button', { name: 'Confirmar entrega de esta carga' }));
  await waitFor(() => expect(mocks.deliver).toHaveBeenCalledWith('A', expect.any(Object)));
  const selected = screen.getByRole('region', { name: 'Cargas marcadas' });
  await waitFor(() => expect(within(selected).queryByText('QA-A')).toBeNull()); expect(selected).toHaveTextContent('QA-B');
  mocks.user.id = 'another-account'; view.rerenderSession();
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Cargas marcadas' })).toBeNull()); expect(clearWatch).toHaveBeenCalledWith(12);
  view.unmount();
});
it('keeps the delivery dialog and selected loads when a delivery cannot be completed', async () => {
  mocks.deliver.mockRejectedValueOnce(new Error('Ubicaciones pendientes. Revisá la conexión.'));
  const view = setup(); await chooseAndStart();
  fireEvent.click(screen.getByRole('button', { name: 'Entregar QA-A', exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Confirmar entrega' });
  expect(within(dialog).getByText(/Las otras cargas conservan su seguimiento actual/)).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar entrega de esta carga' }));
  const error = await within(dialog).findByRole('alert');
  expect(error).toHaveTextContent('Ubicaciones pendientes');
  await waitFor(() => expect(error).toHaveFocus());
  const selected = screen.getByRole('region', { name: 'Cargas marcadas' });
  expect(selected).toHaveTextContent('QA-A'); expect(selected).toHaveTextContent('QA-B');
  view.unmount();
});
it('does not query loads or acquire location when the operational feature is disabled', () => {
  vi.stubEnv('VITE_TRANSPORT_MULTI_GPS_ENABLED', 'false'); const view = setup();
  expect(screen.getByText('El GPS de varias cargas no está habilitado para esta sesión.')).toBeVisible();
  expect(mocks.list).not.toHaveBeenCalled(); expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled(); view.unmount();
});

it('offers one location retry after denial without confusing a failed load upload', async () => {
  mocks.send.mockRejectedValueOnce(new Error('No se pudo enviar la carga A'));
  const view = setup();
  await chooseAndStart();
  await act(async () => { fail({ code: 1 } as GeolocationPositionError); });
  expect(screen.getByText('Permití la ubicación del teléfono y tocá Reintentar GPS.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Detener GPS', exact: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'Reintentar envío GPS de QA-A', exact: true })).toHaveTextContent('Reintentar envío');
  expect(mocks.send).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar GPS', exact: true }));
  expect(clearWatch).toHaveBeenCalledOnce(); expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(2);
  const selected = screen.getByRole('region', { name: 'Cargas marcadas' });
  expect(selected).toHaveTextContent('QA-A'); expect(selected).toHaveTextContent('QA-B');
  await act(async () => { locate({ coords: { latitude: -33, longitude: -69, accuracy: 10, speed: null, heading: null }, timestamp: Date.now() } as GeolocationPosition); });
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(4));
  expect(screen.getByRole('button', { name: 'Detener GPS', exact: true })).toBeVisible();
  expect(mocks.deliver).not.toHaveBeenCalled(); view.unmount();
});

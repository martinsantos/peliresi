import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BajaIntensidadPage from '../../pages/manifiestos/BajaIntensidadPage';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { emptyEventualDraft, eventualDraftScope, eventualSubmissionKey } from '../../services/eventualDraft';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), user: { id: 'qa-operator', rol: 'OPERADOR' } }));
vi.mock('../../services/api', () => ({ api: mock, getAccessToken: () => 'qa.' + btoa(JSON.stringify({ id: mock.user.id })) + '.qa' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
const id = '00000000-0000-4000-8000-000000000001';
const entry = { id, referencia: 'BI-' + id, version: 0, etapa: 'RECIBIDO', puedeRegistrar: true, puedeResolver: false,
  datos: { generador: { nombre: 'QA externo', identificacion: 'Declarada', domicilio: 'QA' },
    transportista: { nombre: 'QA externo transporte', identificacion: 'Declarada', domicilio: 'QA' },
    patente: 'QA-1', motivo: 'Sin alta', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
  revisiones: [{ objetivo: id, estado: 'PENDIENTE', solicitada: false }], eventos: [] };
function view(detail = false, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/manifiestos/baja-intensidad' + (detail ? '?registro=' + id : '')]}><BajaIntensidadPage /></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable:true, value:{ request: async (name:string, _options:unknown, callback:(lock:unknown)=>Promise<void>) => callback({ name }) } });
  vi.clearAllMocks(); mock.user = { id: 'qa-operator', rol: 'OPERADOR' }; vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'true');
  mock.get.mockResolvedValue({ data: { data: { registro: entry, registros: [], total: 0 } } });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('restores a creation draft after leaving and isolates it from a different role', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 const view1 = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Transportista · Nombre o razón social'), { target:{ value:'Transporte propio del borrador' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Motivo de Generador' } });
 view1.unmount();
 mock.user = { id:'qa-person', rol:'OPERADOR', actorId:'op-1' } as typeof mock.user;
 const view2 = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 expect(screen.getByLabelText('Motivo del registro excepcional')).toHaveValue('');
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Motivo de Operador' } }); view2.unmount();
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByLabelText('Motivo del registro excepcional')).toHaveValue('Motivo de Generador');
 expect(screen.getByLabelText('Transportista · Nombre o razón social')).toHaveValue('Transporte propio del borrador');
});
it('persists the submitted identity before dispatch and reuses it after a lost response and reopen', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.post.mockRejectedValueOnce(new Error('offline'));
 const first = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } });
 fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA no duplicar' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'}));
 await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1)); const original = mock.post.mock.calls[0];
 await screen.findByText(/podría haberse guardado/i); first.unmount();
 mock.post.mockResolvedValueOnce({ data:{ data:{ registro:{ ...entry, id:original[1].id } } } });
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByLabelText('Motivo del registro excepcional')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[1]).toEqual(original);
});
it.each([400, 403, 422])('keeps an uncertain request after a later %i rejection', async status => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.post.mockRejectedValueOnce(new Error('response lost')).mockRejectedValueOnce({ response:{ status, data:{ message:'No se pudo verificar' } } });
 const first = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA envío incierto' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'})); await screen.findByText(/podría haberse guardado/i);
 const original = mock.post.mock.calls[0]; fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 await screen.findByText('No se pudo verificar'); expect(mock.post.mock.calls[1]).toEqual(original); first.unmount();
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByText(/podría haberse guardado/i)).toBeVisible();
 expect(screen.getByLabelText('Motivo del registro excepcional')).toBeDisabled();
 expect(screen.getByRole('button',{name:'Comprobar envío'})).toBeEnabled();
});
it('allows correction after an initial validation rejection', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.post.mockRejectedValueOnce({ response:{ status:400, data:{ message:'Revisá la corriente' } } });
 view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA corregir' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'})); await screen.findByText('Revisá la corriente');
 expect(screen.getByLabelText('Motivo del registro excepcional')).toBeEnabled();
 expect(screen.getByRole('button',{name:'Guardar operación'})).toBeVisible();
});
it('recovers the exact send when a competing tab replaces the editable draft', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.post.mockRejectedValueOnce(new Error('response lost'));
 const first = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA referencia protegida' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'})); await screen.findByText(/podría haberse guardado/i);
 const original = mock.post.mock.calls[0]; first.unmount();
 const key = 'sitrep:eventual-form:v1:' + eventualDraftScope(inspectionWorkspaceOwner(mock.user as never), mock.user.id, 'qa.' + btoa(JSON.stringify({ id:mock.user.id })) + '.qa');
 localStorage.setItem(key, JSON.stringify({ version:1, revision:'stale-tab', savedAt:Date.now(), value:emptyEventualDraft() }));
 mock.post.mockResolvedValueOnce({ data:{ data:{ registro:{ ...entry, id:original[1].id } } } });
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByText('Motivo del envío a comprobar: QA referencia protegida')).toBeVisible();
 expect(screen.queryByRole('button',{name:'Guardar operación'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[1]).toEqual(original);
 await screen.findByRole('button',{name:'Ver registros'});
 expect(localStorage.getItem(eventualSubmissionKey(key))).toBeNull();
 expect(JSON.parse(localStorage.getItem(key)!).value.motivo).toBe('');
});
it.each(['{invalid', '', '{"version":1}'])('blocks a new send when the separate pending reference is unreadable: %s', async raw => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 const key = 'sitrep:eventual-form:v1:' + eventualDraftScope(inspectionWorkspaceOwner(mock.user as never), mock.user.id, 'qa.' + btoa(JSON.stringify({ id:mock.user.id })) + '.qa');
 localStorage.setItem(eventualSubmissionKey(key), raw);
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByText(/No pudimos leer o guardar el borrador o la referencia/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Guardar operación'})).toBeDisabled(); expect(mock.post).not.toHaveBeenCalled();
});
it('keeps the declared alternative when switching to a registered participant and reopening', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.get.mockImplementation(async (url:string) => url.endsWith('/participantes')
  ? { data:{ data:{ participantes:[{ padronId:'t-1', nombre:'Transporte registrado', identificacion:'QA', domicilio:'QA' }] } } }
  : { data:{ data:{ registro:entry, registros:[], total:0 } } });
 const first = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Transportista · Nombre o razón social'), { target:{ value:'Transporte declarado' } });
 fireEvent.click(screen.getByRole('button',{name:'Transportista · Buscar en padrón'}));
 fireEvent.click(screen.getByLabelText('Transportista del padrón'));
 fireEvent.click(await screen.findByRole('option',{name:'Transporte registrado · QA'})); first.unmount();
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByLabelText('Transportista · Nombre o razón social')).toHaveValue('Transporte registrado');
 fireEvent.click(screen.getByRole('button',{name:'Transportista · Usar datos declarados'}));
 expect(screen.getByLabelText('Transportista · Nombre o razón social')).toHaveValue('Transporte declarado');
});
it('does not copy creation quantities into a later finding', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.get.mockImplementation(async (url:string) => url.endsWith('/' + id) ? { data:{ data:{ registro:entry } } } : { data:{ data:{ registros:[], total:0 } } });
 mock.post.mockResolvedValueOnce({ data:{ data:{ registro:entry } } }); view();
 fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA creación' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'}));
 await screen.findByText('Operación: Recibido'); fireEvent.click(screen.getByRole('button',{name:'Registrar diferencia'}));
 expect(screen.getByLabelText('Corriente')).toHaveValue(''); expect(screen.getByLabelText('Cantidad')).toHaveValue(null);
});
it('does not dispatch a creation if the reference cannot be stored', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 const broken = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA conservado' } });
 expect(await screen.findByText(/No pudimos leer o guardar el borrador/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Guardar operación'})).toBeDisabled(); expect(mock.post).not.toHaveBeenCalled();
 broken.mockRestore();
});
it('does not dispatch if another tab holds the send lock or the browser cannot provide it', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 const first = view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'QA bloqueo' } });
 Object.defineProperty(navigator, 'locks', { configurable:true, value:{ request: async (_name:string, _options:unknown, callback:(lock:unknown)=>Promise<void>) => callback(null) } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'}));
 expect(await screen.findByText(/Otra pestaña está enviando/)).toBeVisible(); expect(mock.post).not.toHaveBeenCalled();
 first.unmount(); Object.defineProperty(navigator, 'locks', { configurable:true, value:undefined });
 view(); fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'}));
 expect(await screen.findByText(/navegador no puede proteger el envío/)).toBeVisible(); expect(mock.post).not.toHaveBeenCalled();
});
it('does not navigate or mix a pending creation when its response arrives after changing role', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.get.mockResolvedValue({ data:{ data:{ registros:[], total:0 } } });
 let finish:(value:unknown)=>void = () => {}; mock.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
 const client = new QueryClient({ defaultOptions:{ queries:{ retry:false } } });
 const element = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/manifiestos/baja-intensidad']}><BajaIntensidadPage /></MemoryRouter></QueryClientProvider>;
 const rendered = render(element()); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Envío en Generador' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'})); await waitFor(() => expect(mock.post).toHaveBeenCalledOnce());
 mock.user = { id:'qa-person', rol:'OPERADOR', actorId:'op-1' } as typeof mock.user; rendered.rerender(element());
 await act(async () => { finish({ data:{ data:{ registro:entry } } }); await Promise.resolve(); });
 expect(screen.queryByText('Operación: Recibido')).toBeNull();
 fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 expect(screen.getByLabelText('Motivo del registro excepcional')).toHaveValue('');
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user; rendered.rerender(element());
 fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByText(/podría haberse guardado/i)).toBeVisible();
});
it('never overwrites an unconfirmed send from another tab with an older form', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Mi edición' } });
 const key = 'sitrep:eventual-form:v1:' + eventualDraftScope(inspectionWorkspaceOwner(mock.user as never), mock.user.id, 'qa.' + btoa(JSON.stringify({ id: mock.user.id })) + '.qa');
 const other = { ...emptyEventualDraft(), pendingCreate:{ id:'00000000-0000-4000-8000-000000000002',
  body:{ patente:'', motivo:'Otro envío', residuos:[{ corriente:'Y1', cantidad:1, unidad:'kg' }] } } };
 localStorage.setItem(key, JSON.stringify({ version:1, revision:'other', savedAt:Date.now(), value:other }));
 act(() => window.dispatchEvent(new StorageEvent('storage',{ key, storageArea:localStorage })));
 expect(await screen.findByText(/Hay un envío sin confirmar/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Conservar mi versión'})).toBeNull();
 expect(screen.getByRole('button',{name:'Cargar la otra versión'})).toBeVisible();
 expect(mock.post).not.toHaveBeenCalled();
});
it('does not discard its own unconfirmed send when another tab changes the draft', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 mock.post.mockRejectedValueOnce(new Error('offline')); view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Mi envío' } });
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'})); await screen.findByText(/podría haberse guardado/i);
 const key = 'sitrep:eventual-form:v1:' + eventualDraftScope(inspectionWorkspaceOwner(mock.user as never), mock.user.id, 'qa.' + btoa(JSON.stringify({ id: mock.user.id })) + '.qa');
 const other = { ...emptyEventualDraft(), pendingCreate:{ id:'00000000-0000-4000-8000-000000000002',
  body:{ patente:'', motivo:'Otro envío', residuos:[{ corriente:'Y1', cantidad:1, unidad:'kg' }] } } };
 localStorage.setItem(key, JSON.stringify({ version:1, revision:'other', savedAt:Date.now(), value:other }));
 act(() => window.dispatchEvent(new StorageEvent('storage',{ key, storageArea:localStorage })));
 expect(await screen.findByText(/Esta versión tiene un envío sin confirmar/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Cargar la otra versión'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Conservar mi versión'})).toBeNull();
 const firstRequest = mock.post.mock.calls[0]; mock.post.mockRejectedValueOnce(new Error('offline'));
 fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[1]).toEqual(firstRequest);
 expect(JSON.parse(localStorage.getItem(key)!).value.pendingCreate.id).toBe(other.pendingCreate.id);
 await screen.findByText(/No se pudo confirmar/);
 mock.post.mockResolvedValueOnce({ data:{ data:{ registro:{ ...entry, id:firstRequest[1].id } } } });
 fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 fireEvent.click(await screen.findByRole('button',{name:'Ver registros'}));
 fireEvent.click(await screen.findByRole('button',{name:'Continuar borrador'}));
 expect(screen.getByText(/operación ya fue confirmada/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Cargar la otra versión'}));
 mock.post.mockRejectedValueOnce(new Error('offline'));
 fireEvent.click(screen.getByRole('button',{name:'Comprobar envío'}));
 await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(4)); expect(mock.post.mock.calls[3][1].id).toBe(other.pendingCreate.id);
});
it('does not turn an unsent conflicting candidate into a second send', async () => {
 mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'gen-1' } as typeof mock.user;
 view(); fireEvent.click(await screen.findByRole('button',{name:'Registrar operación'}));
 fireEvent.change(screen.getByLabelText('Corriente'), { target:{ value:'Y1' } }); fireEvent.change(screen.getByLabelText('Cantidad'), { target:{ value:'3' } });
 fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target:{ value:'Mi edición' } });
 const key = 'sitrep:eventual-form:v1:' + eventualDraftScope(inspectionWorkspaceOwner(mock.user as never), mock.user.id, 'qa.' + btoa(JSON.stringify({ id:mock.user.id })) + '.qa');
 const other = { ...emptyEventualDraft(), pendingCreate:{ id:'00000000-0000-4000-8000-000000000002',
  body:{ patente:'', motivo:'Otro envío', residuos:[{ corriente:'Y1', cantidad:1, unidad:'kg' }] } } };
 // Simulate the other tab writing just before the storage event is delivered.
 localStorage.setItem(key, JSON.stringify({ version:1, revision:'other', savedAt:Date.now(), value:other }));
 fireEvent.click(screen.getByRole('button',{name:'Guardar operación'}));
 expect(await screen.findByText(/Hay un envío sin confirmar/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Comprobar envío'})).toBeNull();
 expect(screen.getByRole('button',{name:'Cargar la otra versión'})).toBeVisible(); expect(mock.post).not.toHaveBeenCalled();
});
it('disabled feature never fetches or shows write controls', () => {
  vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED', 'false'); view();
  expect(screen.getByText('Circuito no habilitado.')).toBeVisible();
  expect(mock.get).not.toHaveBeenCalled(); expect(mock.post).not.toHaveBeenCalled();
});
it('explains site-limited company access before showing eventual records or a form', () => {
  mock.user = { id:'qa-generator', rol:'GENERADOR', empresaContexto:{ todasSedes:false, establecimientoId:'site-north' } } as typeof mock.user;
  view();
  expect(screen.getByRole('alert')).toHaveTextContent(/todos los establecimientos/i);
  expect(screen.getByRole('link',{name:'Volver a Manifiestos'})).toHaveAttribute('href','/manifiestos');
  expect(screen.queryByRole('button',{name:'Registrar operación'})).toBeNull();
  expect(mock.get).not.toHaveBeenCalled();
});
it('pending conformity does not disable recording treatment, nor grant reviewer buttons', async () => {
  view(true); await screen.findByText('Operación: Recibido');
  expect(screen.getByText(/Pendiente de conformidad/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Hecho registrado con evidencia' } });
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Aprobar post facto' })).not.toBeInTheDocument();
});
it('failed write retains note, same request id on retry, no false confirmation', async () => {
  mock.post.mockRejectedValue(new Error('offline')); view(true); await screen.findByText('Operación: Recibido');
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Evidencia conservada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Evidencia conservada');
  expect(screen.getByText('Operación: Recibido')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2));
  expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('an HTTP error is not presented as zero records', async () => {
  mock.get.mockRejectedValue(new Error('unavailable')); view();
  await screen.findByRole('alert');
  expect(screen.queryByText(/^0 registros/)).not.toBeInTheDocument();
});
it('invalidates a fresh list after a write without discarding the returned detail', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const owner = inspectionWorkspaceOwner(mock.user as never);
  const listKey = ['baja-intensidad', mock.user.id, owner, null, 1];
  client.setQueryData(listKey, { registros: [entry], total: 1 });
  const updated = { ...entry, version: 1, etapa: 'TRATADO' };
  mock.post.mockResolvedValue({ data: { data: { registro: updated } } });
  view(true, client); await screen.findByText('Operación: Recibido');
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await screen.findByText('Operación: Tratado');
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  expect(client.getQueryData(['baja-intensidad', mock.user.id, owner, id])).toEqual({ registro: updated });
});
it('hides a previously loaded eventual when the server revokes access', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  view(true, client); await screen.findByText('Operación: Recibido');
  mock.get.mockRejectedValue({ response: { status: 403 } });
  await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Revisá tus permisos/);
  expect(screen.queryByText('Operación: Recibido')).toBeNull();
  expect(screen.queryByText('QA externo')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Registrar tratado' })).toBeNull();
});
it('explains an unavailable detail without retaining its previously loaded data', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  view(true, client); await screen.findByText('Operación: Recibido');
  mock.get.mockRejectedValue({ response: { status: 404 } });
  await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
  expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible para esta actividad');
  expect(screen.queryByText('Operación: Recibido')).toBeNull();
  expect(screen.queryByText('QA externo')).toBeNull();
  expect(screen.getByRole('button', { name: 'Volver a Eventuales' })).toBeEnabled();
});
it('does not show an earlier company record while a new context is loading', async () => {
  mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'actor-a', empresaContexto:{ empresaId:'company-a', actividadId:'activity-a', todasSedes:true } } as typeof mock.user;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/manifiestos/baja-intensidad?registro='+id]}><BajaIntensidadPage /></MemoryRouter></QueryClientProvider>;
  const rendered = render(element()); await screen.findByText('Operación: Recibido');
  mock.get.mockImplementation(() => new Promise(() => {}));
  mock.user = { id:'qa-person', rol:'GENERADOR', actorId:'actor-b', empresaContexto:{ empresaId:'company-b', actividadId:'activity-b', todasSedes:true } } as typeof mock.user;
  rendered.rerender(element());
  expect(screen.queryByText('Operación: Recibido')).toBeNull();
  expect(screen.queryByText('QA externo')).toBeNull();
});

// Especificación aprobada 17/10/2026 (docs/ESPEC-EVENTUALES-20261017.md v2).
it('a generator starts an eventual: its own slot comes from the session, it declares carrier and operator', async () => {
  mock.user = { id: 'qa-generator', rol: 'GENERADOR' };
  mock.post.mockResolvedValue({ data: { data: { registro: entry } } });
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Registrar operación' }));
  expect(screen.queryByLabelText('Generador · Nombre o razón social')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Transportista · Nombre o razón social'), { target: { value: 'QA flete externo' } });
  fireEvent.change(screen.getByLabelText('Operador · Nombre o razón social'), { target: { value: 'QA planta externa' } });
  fireEvent.change(screen.getByLabelText('Corriente'), { target: { value: 'y1' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Motivo del registro excepcional'), { target: { value: 'Planta sin alta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar operación' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1));
  const [path, body] = mock.post.mock.calls[0];
  expect(path).toBe('/manifiestos/baja-intensidad');
  expect(body).not.toHaveProperty('generador');
  expect(body.transportista.nombre).toBe('QA flete externo');
  expect(body.operador.nombre).toBe('QA planta externa');
});
it('an administrator declares the three participants; sector administrators cannot start one', async () => {
  mock.user = { id: 'qa-admin', rol: 'ADMIN' };
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Registrar operación' }));
  for (const role of ['Generador', 'Transportista', 'Operador']) expect(screen.getByLabelText(role + ' · Nombre o razón social')).toBeVisible();
  cleanup(); mock.user = { id: 'qa-sector', rol: 'ADMIN_GENERADOR' }; view();
  await waitFor(() => expect(mock.get).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Registrar operación' })).not.toBeInTheDocument();
});
const pending = { ...entry, etapa: 'REGISTRADO', puedeAprobar: ['operador'],
  datos: { ...entry.datos, operador: { nombre: 'QA planta con alta', identificacion: '30-1', domicilio: 'QA', padronId: 'qa-op' } },
  aprobacion: { estado: 'PENDIENTE', partes: [{ parte: 'creador', rol: 'GENERADOR', estado: 'APROBADA' }, { parte: 'operador', rol: 'OPERADOR', estado: 'PENDIENTE' }] } };
it('facts wait for every approval; the party approves only its own slot', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: pending } } });
  mock.post.mockResolvedValue({ data: { data: { registro: pending } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  expect(screen.getByRole('listitem', { name: 'Operador · Pendiente · Te toca' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
  expect(screen.getByText('Faltan aprobaciones de las partes para avanzar.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Solicitar revisión' })).not.toBeInTheDocument();
  expect(screen.getByText('QA planta con alta')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Aprobar como creador' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar como operador' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1));
  expect(mock.post.mock.calls[0][0]).toBe('/manifiestos/baja-intensidad/' + id + '/eventos');
  expect(mock.post.mock.calls[0][1]).toMatchObject({ tipo: 'APROBAR_PARTE', parte: 'operador', version: 0 });
});
it('rejecting needs a reason; without a pending slot of its own a party sees no decision buttons', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: pending } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  const reject = screen.getByRole('button', { name: 'Rechazar como operador' });
  expect(reject).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'La carga no es nuestra' } });
  expect(reject).toBeEnabled();
  cleanup(); mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, puedeAprobar: [] } } } });
  view(true); await screen.findByText('Aprobación de las partes: pendiente');
  expect(screen.queryByRole('button', { name: /Aprobar como|Rechazar como/ })).not.toBeInTheDocument();
});
it('a rejected eventual is kept as a record and cannot advance', async () => {
  const rejected = { ...pending, puedeAprobar: [], aprobacion: { estado: 'RECHAZADO', partes: [{ ...pending.aprobacion.partes[0] }, { parte: 'operador', rol: 'OPERADOR', estado: 'RECHAZADA' }] } };
  mock.get.mockResolvedValue({ data: { data: { registro: rejected } } });
  view(true); await screen.findByText('Aprobación de las partes: rechazado');
  expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
  expect(screen.getByText('Rechazado por una parte: se conserva como antecedente y no avanza.')).toBeVisible();
});
it('legacy records without required approvals keep advancing as before', async () => {
  mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, aprobacion: { estado: 'NO_REQUIERE', partes: [] }, puedeAprobar: [] } } } });
  view(true); await screen.findByText('Operación: Recibido');
  expect(screen.queryByText(/Aprobación de las partes/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeEnabled();
});

it.each([
  ['OPERADOR', ['operador'], 'PENDIENTE', 'Te toca aprobar', true],
  ['TRANSPORTISTA', [], 'PENDIENTE', 'Esperando aprobaciones', true],
  ['OPERADOR', [], 'APROBADO', 'Listo para registrar el retiro', false],
  ['OPERADOR', [], 'RECHAZADO', 'Operación detenida', true],
])('shows the current task for %s with %s / %s without changing action permissions', async (rol, puedeAprobar, estado, message, blocked) => {
  mock.user = { id: 'qa-current', rol: rol as string };
  const partes = pending.aprobacion.partes.map(part => ({ ...part, estado: estado === 'APROBADO' ? 'APROBADA' : part.estado }));
  mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, puedeAprobar, aprobacion: { estado, partes } } } } });
  view(true);
  expect(await screen.findByText(message as string, { exact: true })).toBeVisible();
  const approvals = screen.getByRole('list', { name: 'Participantes que deben aprobar' });
  expect(approvals.children).toHaveLength(2); // No fictitious approval for an external participant.
  expect(screen.getByText('Generador · creador')).toBeVisible();
  const action = screen.getByRole('button', { name: 'Registrar retirado' });
  if (blocked) expect(action).toBeDisabled(); else expect(action).toBeEnabled();
});


it('filters eventuals on the server and retains search when returning from a record', async () => {
  mock.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('/' + id) ? { registro: entry } : { registros: [entry], total: 1, page: 1, pageSize: 20 } } }));
  view();
  fireEvent.change(await screen.findByLabelText('Buscar eventual'), { target: { value: 'QA externo' } });
  fireEvent.change(screen.getByLabelText('Etapa del eventual'), { target: { value: 'RECIBIDO' } });
  await waitFor(() => expect(mock.get.mock.calls.some(([url, config]) => url === '/manifiestos/baja-intensidad' && config?.params?.search === 'QA externo' && config?.params?.etapa === 'RECIBIDO')).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: /Abrir eventual/ }));
  await screen.findByText('Operación: Recibido');
  fireEvent.click(screen.getByRole('button', { name: 'Ver registros' }));
  expect(await screen.findByLabelText('Buscar eventual')).toHaveValue('QA externo');
  expect(screen.getByLabelText('Etapa del eventual')).toHaveValue('RECIBIDO');
});
it('shows a compact approval task in the list without claiming external parties approved', async () => {
  mock.get.mockResolvedValue({ data: { data: { registros: [pending], total: 1, page: 1 } } });
  view();
  expect(await screen.findByText('Te toca aprobar', { exact: true })).toBeVisible();
  expect(screen.getByRole('group', { name: 'Aprobaciones del eventual' }).children).toHaveLength(2);
});
it('refreshes an open eventual and protects a note against a concurrent revision until explicitly acknowledged', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mock.get.mockResolvedValue({ data: { data: { registro: entry } } });
  view(true, client); fireEvent.change(await screen.findByLabelText('Nota de la acción'), { target: { value: 'Mi evidencia sigue aquí' } });
  mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, version: 1 } } } });
  await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
  expect(await screen.findByText(/El registro cambió mientras escribías/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar tratado' })).toBeDisabled();
  expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Mi evidencia sigue aquí');
  fireEvent.click(screen.getByRole('button', { name: 'Usar versión actual' }));
  mock.post.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ version: 1, nota: 'Mi evidencia sigue aquí' })));
  expect(client.getQueryCache().getAll().find(q => q.queryKey[0] === 'baja-intensidad')?.observers[0].options.refetchInterval).toBe(5000);
});

it('a rejected eventual never offers another pending party an impossible approval', async () => {
 mock.get.mockResolvedValue({ data: { data: { registro: { ...pending, aprobacion: { ...pending.aprobacion, estado: 'RECHAZADO' } } } } });
 view(true); await screen.findByText('Operación detenida', { exact: true });
 expect(screen.queryByRole('button', { name: /Aprobar como/ })).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Registrar retirado' })).toBeDisabled();
});

it('recovers a committed command after a lost response without resubmitting or erasing newer edits', async () => {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 mock.post.mockRejectedValue(new Error('response lost')); view(true, client);
 fireEvent.change(await screen.findByLabelText('Nota de la acción'), { target: { value: 'Nota enviada' } });
 fireEvent.click(screen.getByRole('button', { name: 'Registrar tratado' })); await screen.findByRole('alert');
 const commandId = mock.post.mock.calls[0][1].id;
 fireEvent.change(screen.getByLabelText('Nota de la acción'), { target: { value: 'Otra nota todavía sin enviar' } });
 mock.get.mockResolvedValue({ data: { data: { registro: { ...entry, version: 1, etapa: 'TRATADO', eventos: [{ id: commandId, tipo: 'AVANCE', etapa: 'TRATADO', fecha: '2026-10-22T15:00:00Z', nota: 'Nota enviada' }] } } } });
 await client.invalidateQueries({ queryKey: ['baja-intensidad'] });
 expect(await screen.findByText('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.')).toBeVisible();
 expect(screen.getByLabelText('Nota de la acción')).toHaveValue('Otra nota todavía sin enviar');
 expect(mock.post).toHaveBeenCalledTimes(1);
});

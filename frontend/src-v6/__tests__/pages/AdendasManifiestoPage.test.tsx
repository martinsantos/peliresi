import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdendasManifiestoPage from '../../pages/manifiestos/AdendasManifiestoPage';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), training: false,role:'OPERADOR' }));
vi.mock('../../services/api', () => ({ api: mock }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-user',rol:mock.role, training: mock.training } }) }));
const record = { id: 'qa-adenda', motivo: 'Diferencia de carga', rectificaId: null, version: 0, estadoRevision: 'PENDIENTE', puedeResolver: false,
  creadoPorId: 'qa-carrier', createdAt: '2026-10-15T00:00:00Z', residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }],
  declaracion: { numero: 'QA-1', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] }, revisiones: [] };
const data = { adendas: [record], total: 1, puedeRegistrar: false, manifiesto: { numero: 'QA-1', estado: 'TRATADO' } };
function view() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } })}>
    <MemoryRouter initialEntries={['/manifiestos/qa-id/adendas']}><Routes><Route path="/manifiestos/:id/adendas" element={<AdendasManifiestoPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => { localStorage.clear();mock.role='OPERADOR';mock.training = false; vi.clearAllMocks(); vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED', 'true'); mock.get.mockResolvedValue({ data: { data } }); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('flag off makes no request', () => { vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED', 'false'); view(); expect(mock.get).not.toHaveBeenCalled(); });
it('keeps original and observed loads separate; read-only participant has no write controls', async () => {
  view(); await screen.findByText('Y1 · 10 kg'); expect(screen.getByText('Y2 · 12 kg')).toBeVisible();
  expect(screen.getByText(/Operación: Tratado/)).toBeVisible();
  expect(screen.getByText('Pendiente de revisión')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Aprobar post facto' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Registrar diferencia' })).not.toBeInTheDocument();
});
it('failed resolution retains the reason and idempotency key, never shows false approval', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, adendas: [{ ...record, puedeResolver: true }] } } });
  mock.post.mockRejectedValue(new Error('offline')); view();
  const note = await screen.findByLabelText('Motivo de resolución');
  fireEvent.change(note, { target: { value: 'Revisión con evidencia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' })); await screen.findByRole('alert');
  expect(note).toHaveValue('Revisión con evidencia'); expect(screen.getByText('Pendiente de revisión')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('successful write invalidates even a fresh list and shows the server resolution', async () => {
  const reviewable = { ...record, puedeResolver: true };
  mock.get.mockResolvedValueOnce({ data: { data: { ...data, adendas: [reviewable] } } })
    .mockResolvedValue({ data: { data: { ...data, adendas: [{ ...reviewable, estadoRevision: 'OBSERVADA', version: 1 }] } } });
  mock.post.mockResolvedValue({ data: {} }); view();
  fireEvent.change(await screen.findByLabelText('Motivo de resolución'), { target: { value: 'Revisar evidencia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Observar' })); await screen.findByText('Observada');
  expect(mock.get).toHaveBeenCalledTimes(2); expect(screen.getByText('Y1 · 10 kg')).toBeVisible();
});
it('read errors are not an empty-list success', async () => {
  mock.get.mockRejectedValue(new Error('offline')); view(); await screen.findByRole('alert');
  expect(screen.queryByText('Todavía no hay adendas.')).not.toBeInTheDocument();
});
it('shows global documentary counts, not a false closure inferred from the visible page', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, total: 25, documental: { pendientes: 23, observadas: 1, rechazadas: 1, estado: 'RECHAZADA', cierreAcreditado: false } } } });
  view(); await screen.findByText('23 pendientes · 1 observada · 1 rechazada');
  expect(screen.getByText('Hay revisiones por atender. El cierre operativo no las aprueba.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
});
it('all reviewed does not assert documentary closure', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, documental: { pendientes: 0, observadas: 0, rechazadas: 0, estado: 'ADENDAS_REVISADAS', cierreAcreditado: false } } } });
  view(); await screen.findByText('Adendas revisadas. No acredita el cierre documental del expediente.');
});
it('downloads current and explicit previous version without posting any changes', async () => {
  const current = { ...data, adendas: [{ ...record, version: 2 }] };
  mock.get.mockImplementation((_url, config) => Promise.resolve(config?.responseType === 'blob' ? { data: new Blob(['%PDF-']) } : { data: { data: current } }));
  const create = vi.fn(() => 'blob:qa'); vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    view(); fireEvent.click(await screen.findByRole('button', { name: 'Descargar anexo v2' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Trazabilidad de la adenda'));
    fireEvent.change(screen.getByLabelText('Versión anterior'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar versión anterior' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(mock.get).toHaveBeenCalledWith('/manifiestos/qa-id/adendas/qa-adenda/anexo', { params: { version: 1 }, responseType: 'blob' });
    expect(mock.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Versión anterior'), { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Descargar versión anterior' })).toBeDisabled();
  } finally { await new Promise(resolve => setTimeout(resolve, 1100)); vi.unstubAllGlobals(); }
});
it('download failure keeps existing facts and offers retry without false success', async () => {
  mock.get.mockResolvedValueOnce({ data: { data } }).mockRejectedValue(new Error('offline'));
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Descargar anexo v0' }));
  await screen.findByText('No se pudo descargar el anexo. Tus datos y revisiones no cambiaron.');
  expect(screen.getByText('Y1 · 10 kg')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Descargar anexo v0' })).toBeEnabled();
  expect(mock.post).not.toHaveBeenCalled();
});

it('school session can practice with operational flag off, while both annex downloads stay disabled', async () => {
  vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED', 'false'); mock.training = true;
  mock.get.mockResolvedValue({ data: { data: { ...data, adendas: [{ ...record, version: 2 }] } } });
  view(); await screen.findByText('Y1 · 10 kg');
  expect(screen.getByText('Y2 · 12 kg')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Descargar anexo v2' })).toBeDisabled();
  fireEvent.click(screen.getByText('Trazabilidad de la adenda'));
  expect(screen.getByRole('button', { name: 'Descargar versión anterior' })).toBeDisabled();
  expect(screen.getByText('Capacitación: sin anexos ni documentos oficiales.')).toBeVisible();
  expect(mock.post).not.toHaveBeenCalled();
});
it('allows letters in the current code and free text in the reason, preserving Y-code validation', async () => {
 mock.get.mockResolvedValue({data:{data:{...data,puedeRegistrar:true}}});view();
 fireEvent.click(await screen.findByRole('button',{name:'Registrar diferencia'}));
 const current=screen.getByLabelText('Corriente observada 1');
 expect(current).toHaveAttribute('type','text');expect(current).toHaveAttribute('inputmode','text');
 fireEvent.change(current,{target:{value:'y21'}});expect(current).toHaveValue('Y21');expect(current).toBeValid();
 fireEvent.change(current,{target:{value:'21'}});expect(current).toBeInvalid();
 const reason=screen.getByLabelText('Motivo de la adenda');expect(reason).toHaveAttribute('inputmode','text');
 fireEvent.change(reason,{target:{value:'Se observó una diferencia de carga'}});expect(reason).toHaveValue('Se observó una diferencia de carga');
});
it('starts a destination finding with the declared load, without editing the original or asking to retype it', async () => {
 mock.get.mockResolvedValue({ data: { data: { ...data, puedeRegistrar: true, puedeInformarHallazgo: true, manifiesto: { ...data.manifiesto, residuos: record.declaracion.residuos } } } });
 view(); fireEvent.click(await screen.findByRole('button', { name: 'Informar hallazgo' }));
 expect(screen.getByRole('heading', { name: 'Informe de hallazgo dentro de la adenda' })).toBeVisible();
 expect(screen.getByLabelText('Corriente observada 1')).toHaveValue('Y1');
 expect(screen.getByLabelText('Cantidad observada 1')).toHaveValue(10);
 fireEvent.change(screen.getByLabelText('Cantidad observada 1'), { target: { value: '12' } });
 expect(record.declaracion.residuos[0].cantidad).toBe(10);
 expect(screen.getByText('Y1 · 10 kg')).toBeVisible();
});
it.each(['kg', 'lt', 'tn', 'un', 'l', 't', 'm3'])('prefills and submits %s as declared, never showing another unit', async unidad => {
 const residues = [{ corriente: 'Y1', cantidad: 12.5, unidad }];
 mock.get.mockResolvedValue({ data: { data: { ...data, puedeRegistrar: true, manifiesto: { ...data.manifiesto, residuos: residues } } } });
 mock.post.mockRejectedValue(new Error('offline')); view();
 fireEvent.click(await screen.findByRole('button', { name: 'Registrar diferencia' }));
 expect(screen.getByLabelText('Unidad observada 1')).toHaveValue(unidad);
 fireEvent.change(screen.getByLabelText('Motivo de la adenda'), { target: { value: 'Carga verificada' } });
 fireEvent.click(screen.getByRole('button', { name: 'Guardar y solicitar revisión' }));
 await waitFor(() => expect(mock.post).toHaveBeenCalledWith('/manifiestos/qa-id/adendas', expect.objectContaining({ residuos: residues })));
 expect(screen.getByLabelText('Unidad observada 1')).toHaveValue(unidad);
});
it('requires explicit correction of an unsupported historical unit instead of silently displaying kilograms', async () => {
 mock.get.mockResolvedValue({ data: { data: { ...data, puedeRegistrar: true, manifiesto: { ...data.manifiesto, residuos: [{ corriente: 'Y1', cantidad: 2, unidad: 'desconocida' }] } } } });
 view(); fireEvent.click(await screen.findByRole('button', { name: 'Registrar diferencia' }));
 const unit = screen.getByLabelText('Unidad observada 1');
 expect(unit).toHaveValue(''); expect(unit).toBeRequired(); expect(unit).toBeInvalid();
 expect(screen.getByRole('option', { name: 'Revisar unidad declarada: desconocida' })).toBeVisible();
 expect(mock.post).not.toHaveBeenCalled();
});

it('explicitly discarding a rectification then starting an independent report does not reuse its reference', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, puedeRegistrar: true, manifiesto: { ...data.manifiesto, residuos: record.declaracion.residuos } } } });
  mock.post.mockResolvedValue({ data: {} }); view();
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar rectificación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
  expect(screen.getByRole('button',{name:'Retomar informe'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Descartar borrador'}));fireEvent.click(screen.getByRole('button',{name:'Sí, descartar'}));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar diferencia' }));
  fireEvent.change(screen.getByLabelText('Motivo de la adenda'), { target: { value: 'Otro hallazgo independiente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y solicitar revisión' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(1));
  expect(mock.post.mock.calls[0][1]).not.toHaveProperty('rectificaId');
  expect(mock.post.mock.calls[0][1].residuos).toEqual(record.declaracion.residuos);
});
it('shows the author and latest individual review without claiming agreement by everyone', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, adendas: [{ ...record, autor: { nombre: 'QA Operador', rol: 'OPERADOR' }, estadoRevision: 'OBSERVADA', revisiones: [{ id: 'review', autorId: 'generator', autor: { nombre: 'QA Generador', rol: 'GENERADOR' }, decision: 'OBSERVADA', nota: 'Verificar pesaje recibido', fecha: '2026-10-21' }] }] } } });
  view(); expect(await screen.findByText('Operador · QA Operador')).toBeVisible();
  expect(screen.getByLabelText('Última revisión')).toHaveTextContent('Generador · QA Generador');
  expect(screen.getByLabelText('Última revisión')).toHaveTextContent('Verificar pesaje recibido');
  fireEvent.click(screen.getByText('Cómo se revisa una adenda'));
  expect(screen.getByText(/no representa unanimidad ni cierre documental/)).toBeVisible();
});

it('a remote revision cannot silently rebase a decision already being written', async () => {
  const reviewable = { ...record, puedeResolver: true };
  mock.get.mockResolvedValueOnce({ data: { data: { ...data, adendas: [reviewable] } } })
    .mockResolvedValue({ data: { data: { ...data, adendas: [{ ...reviewable, version: 1, estadoRevision: 'OBSERVADA' }] } } });
  mock.post.mockRejectedValueOnce({ response: { data: { message: 'La revisión cambió; recargá antes de resolver' } } }).mockResolvedValue({ data: {} });
  view(); fireEvent.change(await screen.findByLabelText('Motivo de resolución'), { target: { value: 'Mi decisión escrita sobre versión cero' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' })); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar revisiones' })); await screen.findByText('Observada');
  expect(screen.getByRole('button', { name: 'Aprobar post facto' })).toBeDisabled();
  expect(screen.getByLabelText('Motivo de resolución')).toHaveValue('Mi decisión escrita sobre versión cero');
  fireEvent.click(screen.getByRole('button', { name: 'Usar revisión actual' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2));
  expect(mock.post.mock.calls[0][1].version).toBe(0); expect(mock.post.mock.calls[1][1].version).toBe(1);
});

it('operational final certificate never labels the closed record as CAP', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, finalLiberado: true } } }); view();
  expect(await screen.findByText(/El operador ya liberó la disposición final\./)).toBeVisible();
  expect(screen.queryByText(/disposición final CAP/)).not.toBeInTheDocument();
});

it('recovers an unsent finding after reopening without mixing another role',async()=>{
 mock.get.mockResolvedValue({data:{data:{...data,puedeRegistrar:true}}});let page=view();
 fireEvent.click(await screen.findByRole('button',{name:'Registrar diferencia'}));
 fireEvent.change(screen.getByLabelText('Corriente observada 1'),{target:{value:'Y21'}});
 fireEvent.change(screen.getByLabelText('Cantidad observada 1'),{target:{value:'12'}});
 fireEvent.change(screen.getByLabelText('Motivo de la adenda'),{target:{value:'Hallazgo que debo conservar'}});page.unmount();
 mock.role='GENERADOR';page=view();await screen.findByText('Y1 · 10 kg');expect(screen.queryByLabelText('Motivo de la adenda')).toBeNull();page.unmount();
 mock.role='OPERADOR';page=view();await screen.findByLabelText('Motivo de la adenda');
 expect(screen.getByLabelText('Motivo de la adenda')).toHaveValue('Hallazgo que debo conservar');expect(screen.getByLabelText('Cantidad observada 1')).toHaveValue(12);
 expect(mock.post).not.toHaveBeenCalled();
});

it('keeps the same request id after a failed decision and app reopen',async()=>{
 mock.get.mockResolvedValue({data:{data:{...data,adendas:[{...record,puedeResolver:true}]}}});mock.post.mockRejectedValue(new Error('Offline'));
 const page=view();fireEvent.change(await screen.findByLabelText('Motivo de resolución'),{target:{value:'Mi decisión conservada'}});
 fireEvent.click(screen.getByRole('button',{name:'Observar'}));await screen.findByRole('alert');const first=mock.post.mock.calls[0][1];page.unmount();
 view();expect(await screen.findByLabelText('Motivo de resolución')).toHaveValue('Mi decisión conservada');
 fireEvent.click(screen.getByRole('button',{name:'Observar'}));await waitFor(()=>expect(mock.post).toHaveBeenCalledTimes(2));expect(mock.post.mock.calls[1][1]).toEqual(first);
});

it('requires a deliberate choice before replacing another tab’s draft',async()=>{
 mock.get.mockResolvedValue({data:{data:{...data,adendas:[{...record,puedeResolver:true}]}}});const page=view();
 fireEvent.change(await screen.findByLabelText('Motivo de resolución'),{target:{value:'Texto local'}});
 const key=Object.keys(localStorage).find(k=>k.startsWith('sitrep:adenda-form:'))!;
 const other=JSON.parse(localStorage.getItem(key)!);other.revision='other-tab';other.value.notes[record.id]='Texto de la otra pestaña';
 localStorage.setItem(key,JSON.stringify(other));fireEvent(window,new StorageEvent('storage',{key}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Guardamos ambas versiones en este dispositivo');
 expect(screen.getByLabelText('Motivo de resolución')).toHaveValue('Texto local');expect(screen.getByRole('button',{name:'Observar'})).toBeDisabled();expect(mock.post).not.toHaveBeenCalled();
 page.unmount();view();expect(await screen.findByLabelText('Motivo de resolución')).toHaveValue('Texto local');expect(screen.getByRole('button',{name:'Observar'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Cargar la otra versión'}));expect(screen.getByLabelText('Motivo de resolución')).toHaveValue('Texto de la otra pestaña');
 expect(screen.getByRole('button',{name:'Observar'})).toBeEnabled();
});

it('reuses the other tab’s attempted request after deliberately loading that draft',async()=>{
 mock.get.mockResolvedValue({data:{data:{...data,adendas:[{...record,puedeResolver:true}]}}});mock.post.mockRejectedValue(new Error('Offline'));view();
 fireEvent.change(await screen.findByLabelText('Motivo de resolución'),{target:{value:'Texto local'}});
 const key=Object.keys(localStorage).find(k=>k.startsWith('sitrep:adenda-form:'))!;
 const other=JSON.parse(localStorage.getItem(key)!);other.revision='other-request';other.value.notes[record.id]='Texto externo';
 other.value.pending={id:'qa-stable-request',signature:JSON.stringify({path:'/manifiestos/qa-id/adendas/qa-adenda/revisiones',body:{version:0,decision:'OBSERVADA',nota:'Texto externo'}})};
 localStorage.setItem(key,JSON.stringify(other));fireEvent(window,new StorageEvent('storage',{key}));
 fireEvent.click(await screen.findByRole('button',{name:'Cargar la otra versión'}));fireEvent.click(screen.getByRole('button',{name:'Observar'}));
 await waitFor(()=>expect(mock.post).toHaveBeenCalledTimes(1));expect(mock.post.mock.calls[0][1].id).toBe('qa-stable-request');
});

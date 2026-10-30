import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdendasManifiestoPage from '../../pages/manifiestos/AdendasManifiestoPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mocks, getAccessToken: () => 'qa.' + btoa(JSON.stringify({ id:'qa-user', rol:'OPERADOR' })) + '.qa' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id:'qa-user', rol:'OPERADOR', actorId:'qa-operator', training:false } }) }));
const manifestId = 'manifest-qa';
const data = { adendas:[], total:0, puedeRegistrar:true, puedeInformarHallazgo:true,
  manifiesto:{ numero:'QA-1', estado:'RECIBIDO', residuos:[{ corriente:'Y1', cantidad:10, unidad:'kg' }] } };
function view() {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <MemoryRouter initialEntries={[`/manifiestos/${manifestId}/adendas`]}><Routes><Route path="/manifiestos/:id/adendas" element={<AdendasManifiestoPage/>}/></Routes></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED','true');
  Object.defineProperty(navigator,'locks',{ configurable:true, value:{ request:async (name:string,_options:unknown,callback:(lock:unknown)=>Promise<void>)=>callback({name}) } });
  mocks.get.mockResolvedValue({data:{data}});
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('does not send an addendum if its request reference cannot be stored', async () => {
  view(); const start=await screen.findByRole('button',{name:'Informar hallazgo'});await waitFor(()=>expect(start).toBeEnabled());fireEvent.click(start);
  fireEvent.change(screen.getByLabelText('Motivo de la adenda'),{target:{value:'Hallazgo a conservar'}});
  const original=Storage.prototype.setItem;
  const denied=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value) {
    if (key.startsWith('sitrep:adenda-submission:') || (key.startsWith('sitrep:adenda-form:') && JSON.parse(value).value?.pending)) throw new Error('storage denied');
    return original.call(this,key,value);
  });
  fireEvent.click(screen.getByRole('button',{name:'Guardar y solicitar revisión'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Todavía no se envió'));
  expect(mocks.post).not.toHaveBeenCalled(); denied.mockRestore();
});

it('does not allow changing or replacing an addendum when its response was lost', async () => {
  mocks.post.mockRejectedValueOnce(new Error('response lost'));
  view(); const start=await screen.findByRole('button',{name:'Informar hallazgo'});await waitFor(()=>expect(start).toBeEnabled());fireEvent.click(start);
  fireEvent.change(screen.getByLabelText('Motivo de la adenda'),{target:{value:'Hallazgo original'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar y solicitar revisión'}));
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole('button',{name:'Comprobar envío'})).toBeEnabled();
  expect(screen.getByLabelText('Motivo de la adenda')).toBeDisabled();
});

it('can retry a failed reference read without treating it as an empty queue', async () => {
  const original = Storage.prototype.getItem; let denied = true;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
    if (denied && key.startsWith('sitrep:adenda-submission:')) throw new Error('temporary read failure');
    return original.call(this, key);
  });
  view();
  expect(await screen.findByText(/No pudimos leer la referencia/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Informar hallazgo' })).toBeDisabled();
  denied = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar lectura' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Informar hallazgo' })).toBeEnabled());
  expect(mocks.post).not.toHaveBeenCalled();
});

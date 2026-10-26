import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  owner: 'admin:one', role: 'ADMIN', detail: {} as any, messages: {} as any,
  send: vi.fn(), review: vi.fn(), observe: vi.fn(), approve: vi.fn(), reject: vi.fn(), document: vi.fn(), read: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: state.owner, rol: state.role } }) }));
vi.mock('../../hooks/useAdmissionContext', () => ({ useAdmissionContext: () => ({ owner: state.owner, role: state.role, ready: true }) }));
vi.mock('../../hooks/useSolicitudes', () => ({
 useSolicitud: () => state.detail, useMensajesSolicitud: () => state.messages,
 useEnviarMensaje: () => ({ mutateAsync: state.send }), useRevisarSolicitud: () => ({ mutateAsync: state.review }),
 useObservarSolicitud: () => ({ mutateAsync: state.observe }), useAprobarSolicitud: () => ({ mutateAsync: state.approve }),
 useRechazarSolicitud: () => ({ mutateAsync: state.reject }), useRevisarDocumento: () => ({ mutateAsync: state.document }),
}));
vi.mock('../../components/AdministrativeTEF', () => ({ AdministrativeTEF: () => null }));
vi.mock('../../components/registration/RegistrationFleetSummary', () => ({ RegistrationFleetSummary: () => null }));
vi.mock('../../components/registration/RegistrationReviewEditor', () => ({ RegistrationReviewEditor: ({ onClose, onConfirmed, onSaved }: any) => <button onClick={async () => { onClose(); onConfirmed(); await onSaved().catch(() => {}); }}>Simular corrección confirmada</button> }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { analizarDocumento: state.read } }));
vi.mock('../../components/PaymentIdentityReview', () => ({ PaymentIdentityReview: () => <input aria-label="Identidad del pago" defaultValue="" /> }));
import SolicitudDetallePage from '../../pages/admin/SolicitudDetallePage';
const query = (data: unknown) => ({ data, isPending: false, isError: false, isFetching: false, refetch: vi.fn().mockResolvedValue({}) });
function tree(prefix = '') { return <MemoryRouter basename={prefix || '/'} initialEntries={[prefix + '/admin/solicitudes/s1']}><Routes><Route path="/admin/solicitudes/:id" element={<SolicitudDetallePage />} /></Routes></MemoryRouter>; }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); state.owner = 'admin:one'; state.role = 'ADMIN';
  state.detail = query({ id: 's1', estado: 'EN_REVISION', tipoActor: 'GENERADOR', datosActor: '{"razonSocial":"Empresa QA"}', usuario: { nombre: 'Persona QA', email: 'qa@night-qa.invalid' }, documentos: [], createdAt: '2026-10-25', updatedAt: '2026-10-25T15:00:00.000Z' });
  state.messages = query([]);
  for (const fn of [state.send,state.review,state.observe,state.approve,state.reject,state.document,state.read]) fn.mockResolvedValue({});
});
afterEach(cleanup);
it.each(['','/app'])('keeps the reading action and progress visible while the original is being analysed (%s)', async prefix => {
 state.detail.data.documentos=[{id:'invoice',tipo:'FACTURA_ELECTRICA',estado:'PENDIENTE',nombre:'Factura artificial',size:100,sha256:'qa'}];
 let finish!:()=>void; state.read.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
 render(tree(prefix));
 fireEvent.click(screen.getByRole('button',{name:'Leer documento',exact:true}));
 const pending=screen.getByRole('button',{name:'Leyendo documento…',exact:true});
 expect(pending).toBeDisabled(); fireEvent.click(pending);
 expect(state.read).toHaveBeenCalledOnce(); expect(state.read).toHaveBeenCalledWith('s1','invoice');
 expect(screen.getByRole('button',{name:'Aprobar',exact:true})).toBeDisabled();
 await act(async()=>{finish();});
 expect(screen.getByText('Lectura actualizada. Revisá el resultado del documento.')).toBeVisible();
});
it.each(['', '/app'])('keeps a confirmed correction visible and focused when its subsequent read fails (%s)', async prefix => {
 const view = render(tree(prefix));
 fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
 state.detail.refetch.mockImplementation(async () => { state.detail.isError = true; return { isError: true, error: new Error('offline') }; });
 await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Simular corrección confirmada' })); });
 view.rerender(tree(prefix));
 expect(screen.getByRole('status')).toHaveTextContent('Corrección guardada');
 expect(screen.getByRole('status')).toHaveFocus();
 expect(screen.queryByText('Empresa QA')).toBeNull();
 expect(screen.getByRole('button', { name: 'Actualizar solicitud' })).toBeEnabled();
});
it.each(['','/app'])('opening ENVIADA does not mutate; explicit review begins the work (%s)', async prefix => {
 state.detail.data.estado = 'ENVIADA'; render(tree(prefix));
 expect(state.review).not.toHaveBeenCalled(); expect(screen.queryByRole('button',{name:'Aprobar',exact:true})).toBeNull();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Iniciar revisión'}));});
 expect(state.review).toHaveBeenCalledOnce(); expect(state.detail.refetch).toHaveBeenCalled();
});
it.each(['ENVIADA','OBSERVADA','APROBADA','RECHAZADA','BORRADOR'])('does not offer a decision in %s', status => {
 state.detail.data.estado=status; render(tree());
 for(const name of ['Aprobar','Observar','Rechazar']) expect(screen.queryByRole('button',{name,exact:true})).toBeNull();
});
it.each(['pending','cached-error'])('read %s hides details and decisions', mode => {
 if(mode==='pending')state.detail.isPending=true;else state.detail.isError=true;
 render(tree()); expect(screen.queryByText('Empresa QA')).toBeNull(); expect(screen.queryByRole('button',{name:'Aprobar',exact:true})).toBeNull();
 if(mode==='cached-error'){fireEvent.click(screen.getByRole('button',{name:'Actualizar solicitud'}));expect(state.detail.refetch).toHaveBeenCalled();}
});
it.each(['RECHAZADA','OBSERVADA'])('keeps the decision reason visible after reopening %s', status => {
 state.detail.data.estado=status;
 state.detail.data.motivoRechazo='Falta documentación obligatoria de práctica';
 state.detail.data.observaciones='Adjuntar constancia legible de práctica';
 render(tree('/app'));
 const label=status==='RECHAZADA'?'Motivo de rechazo':'Correcciones solicitadas';
 expect(screen.getByRole('region',{name:label})).toHaveTextContent(status==='RECHAZADA'?state.detail.data.motivoRechazo:state.detail.data.observaciones);
});
it('keeps text after failed refresh and exposes it only after the query recovers', () => {
 const view=render(tree());fireEvent.change(screen.getByLabelText('Mensaje sobre la solicitud'),{target:{value:'Texto que no se debe perder'}});
 state.detail.isError=true;view.rerender(tree());expect(screen.queryByLabelText('Mensaje sobre la solicitud')).toBeNull();
 state.detail.isError=false;view.rerender(tree());expect(screen.getByLabelText('Mensaje sobre la solicitud')).toHaveValue('Texto que no se debe perder');
});
it.each(['pending','error'])('messages %s is not an empty conversation', mode => {
 if(mode==='pending')state.messages.isPending=true;else state.messages.isError=true;
 render(tree());expect(screen.queryByText('No hay mensajes')).toBeNull();
 expect(screen.getByRole('button',{name:'Enviar mensaje sobre la solicitud'})).toBeDisabled();
 if(mode==='error'){fireEvent.click(screen.getByRole('button',{name:'Reintentar mensajes'}));expect(state.messages.refetch).toHaveBeenCalled();}
});
it.each(['message','observation','rejection'])('%s draft survives close/reopen and stays isolated by account', kind => {
 let view=render(tree());
 const open=()=>{if(kind!=='message')fireEvent.click(screen.getByRole('button',{name:kind==='observation'?'Observar':'Rechazar',exact:true}));};
 const label=kind==='message'?'Mensaje sobre la solicitud':kind==='observation'?'Observaciones *':'Motivo de rechazo *';
 open();fireEvent.change(screen.getByLabelText(label),{target:{value:'Trabajo pendiente de práctica'}});
 view.unmount();state.owner='admin:other';view=render(tree());open();expect(screen.getByLabelText(label)).toHaveValue('');
 view.unmount();state.owner='admin:one';render(tree());open();expect(screen.getByLabelText(label)).toHaveValue('Trabajo pendiente de práctica');
 expect(state.send).not.toHaveBeenCalled();expect(state.observe).not.toHaveBeenCalled();expect(state.reject).not.toHaveBeenCalled();
});
it('retains observation on failure and reports the server reason inside the dialog',async()=>{
 state.observe.mockRejectedValue({response:{data:{message:'La solicitud cambió durante la revisión'}}});
 render(tree());fireEvent.click(screen.getByRole('button',{name:'Observar',exact:true}));
 fireEvent.change(screen.getByLabelText('Observaciones *'),{target:{value:'Adjuntar constancia legible'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Enviar observaciones'}));});
 expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('La solicitud cambió');
 expect(screen.getByLabelText('Observaciones *')).toHaveValue('Adjuntar constancia legible');
});
it('successful message clears only its own draft and prevents concurrent sends',async()=>{
 let finish!:()=>void;state.send.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
 let view=render(tree());fireEvent.change(screen.getByLabelText('Mensaje sobre la solicitud'),{target:{value:'Consulta de práctica'}});
 const send=screen.getByRole('button',{name:'Enviar mensaje sobre la solicitud'});
 fireEvent.click(send);fireEvent.click(send);expect(state.send).toHaveBeenCalledOnce();
 expect(screen.getByLabelText('Mensaje sobre la solicitud')).toBeDisabled();
 await act(async()=>{finish();});expect(screen.getByLabelText('Mensaje sobre la solicitud')).toHaveValue('');
 view.unmount();render(tree());expect(screen.getByLabelText('Mensaje sobre la solicitud')).toHaveValue('');
});
it('reuses the message reference after an unconfirmed send and a complete reopening',async()=>{
 state.send.mockRejectedValue(new Error('Respuesta de red perdida'));
 const view=render(tree());fireEvent.change(screen.getByLabelText('Mensaje sobre la solicitud'),{target:{value:'Consulta que no debe duplicarse'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Enviar mensaje sobre la solicitud'}));});
 const first=state.send.mock.calls[0][0];view.unmount();render(tree());
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Enviar mensaje sobre la solicitud'}));});
 expect(state.send.mock.calls[1][0]).toEqual(first);expect(first.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
});
it('requires explicit approval and protects repeated confirmation and all other actions',async()=>{
 let finish!:()=>void;state.approve.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));
 render(tree());fireEvent.click(screen.getByRole('button',{name:'Aprobar',exact:true}));expect(state.approve).not.toHaveBeenCalled();
 const confirm=within(screen.getByRole('dialog')).getByRole('button',{name:'Confirmar aprobación',exact:true});
 fireEvent.click(confirm);fireEvent.click(confirm);expect(state.approve).toHaveBeenCalledOnce();expect(confirm).toBeDisabled();
 expect(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancelar',exact:true})).toBeDisabled();
 expect(state.approve).toHaveBeenCalledWith({id:'s1',expectedUpdatedAt:'2026-10-25T15:00:00.000Z'});
 await act(async()=>{finish();});expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByText('Solicitud aprobada. El alta quedó habilitada.')).toBeVisible();
});
it.each(['refreshing','wrong-sector'])('decision disabled or absent while %s', mode=>{
 if(mode==='refreshing')state.detail.isFetching=true;else state.role='ADMIN_OPERADOR';
 render(tree());const approve=screen.queryByRole('button',{name:'Aprobar',exact:true});
 if(approve)expect(approve).toBeDisabled();expect(state.approve).not.toHaveBeenCalled();
});
it('does not discard pending ATM fields while refreshing the application',()=>{
 state.detail.data.documentos=[{id:'payment',tipo:'COMPROBANTE_PAGO',estado:'PENDIENTE',nombre:'Comprobante artificial',size:100,sha256:'qa'}];
 const view=render(tree());fireEvent.change(screen.getByLabelText('Identidad del pago'),{target:{value:'QA-123'}});
 state.detail.isFetching=true;view.rerender(tree());
 expect(screen.getByLabelText('Identidad del pago')).toHaveValue('QA-123');expect(screen.getByLabelText('Identidad del pago')).toBeDisabled();
 state.detail.isFetching=false;view.rerender(tree());expect(screen.getByLabelText('Identidad del pago')).toBeEnabled();
});

it.each(['', '/app'])('presents declared power, zone and operator mode without technical keys (%s)', prefix => {
 const raw = JSON.stringify({ razonSocial: 'Empresa QA', cuit: '30900000011', tefPotencia: '120', tefSuperficie: '1250', tefPersonal: '0', tefZona: 'zona_industrial', tipoOperador: 'IN_SITU', campoAnterior: 'VALOR_PREVIO' });
 state.detail.data.datosActor = raw;
 render(tree(prefix));
 expect(screen.getByText('Potencia instalada (HP)')).toBeVisible();
 expect(screen.getByText('120')).toBeVisible();
 expect(screen.getByText('Superficie cubierta (m²)')).toBeVisible();
 expect(screen.getByText('Personal en planta')).toBeVisible();
 expect(within(screen.getByText('Personal en planta').parentElement!).getByText('0')).toBeVisible();
 expect(screen.getByText('CUIT')).toBeVisible();
 expect(screen.getByText('Zona Industrial Exclusiva')).toBeVisible();
 expect(screen.getByText('Operador in situ')).toBeVisible();
 expect(screen.getByText('VALOR_PREVIO')).toBeVisible();
 expect(screen.queryByText('Tef Potencia')).toBeNull();
 expect(screen.queryByText('IN_SITU')).toBeNull();
 expect(state.detail.data.datosActor).toBe(raw);
});

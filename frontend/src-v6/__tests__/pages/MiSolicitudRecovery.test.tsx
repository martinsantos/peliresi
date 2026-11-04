import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ message: vi.fn(), resend: vi.fn(), user: { id:'applicant',rol:'GENERADOR' }, rows: [{id:'g',tipoActor:'GENERADOR',estado:'OBSERVADA',updatedAt:'2026-10-26T12:00:00.000Z',observaciones:'Corregí domicilio'}] as any[], messages:[] as any[] }));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:m.user,isRestricted:true,logout:vi.fn()})}));
vi.mock('../../components/ActorActivities',()=>({default:()=>null}));
vi.mock('../../hooks/useSolicitudes',()=>({useMisSolicitudes:()=>({data:m.rows}),useMensajesSolicitud:()=>({data:m.messages}),useEnviarMensaje:()=>({mutateAsync:m.message,isPending:false}),useEnviarSolicitud:()=>({mutateAsync:m.resend,isPending:false})}));
import MiSolicitudPage from '../../pages/solicitud/MiSolicitudPage';
const open=(base='')=>render(<MemoryRouter initialEntries={[base+'/mi-solicitud']}><MiSolicitudPage/></MemoryRouter>);
const field=(kind:string)=>kind==='reply'?screen.getByLabelText('Tu respuesta'):screen.getByLabelText('Mensaje a administración');
const send=(kind:string)=>screen.getByRole('button',{name:kind==='reply'?'Responder y Re-enviar':'Enviar mensaje',exact:true});
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();m.user={id:'applicant',rol:'GENERADOR'};m.rows=[{id:'g',tipoActor:'GENERADOR',estado:'OBSERVADA',updatedAt:'2026-10-26T12:00:00.000Z',observaciones:'Corregí domicilio'}];m.messages=[];m.message.mockResolvedValue({id:'accepted'});m.resend.mockResolvedValue({estado:'ENVIADA'});});
afterEach(cleanup);
it.each(['message','reply'])('%s survives closing web and reopening app without sending',kind=>{const page=open();fireEvent.change(field(kind),{target:{value:'Propuesta conservada'}});page.unmount();open('/app');expect(field(kind)).toHaveValue('Propuesta conservada');expect(m.message).not.toHaveBeenCalled();expect(m.resend).not.toHaveBeenCalled();});
it('reuses the same message command after the response is lost and app reopens',async()=>{m.message.mockRejectedValueOnce(new Error('lost'));const page=open();fireEvent.change(field('message'),{target:{value:'Consulta única'}});fireEvent.click(send('message'));await waitFor(()=>expect(m.message).toHaveBeenCalledOnce());const first=m.message.mock.calls[0][0];await act(async()=>{});page.unmount();open('/app');fireEvent.click(screen.getByRole('button',{name:/Reintentar.*mensaje|Enviar mensaje/}));await waitFor(()=>expect(m.message).toHaveBeenCalledTimes(2));expect(m.message.mock.calls[1][0]).toEqual(first);expect(first.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);});

it('keeps a confirmed reply for resend after reopening without posting the reply twice',async()=>{
 m.resend.mockRejectedValueOnce(new Error('lost resend'));const page=open();fireEvent.change(field('reply'),{target:{value:'Corregí los datos'}});fireEvent.click(send('reply'));
 await waitFor(()=>expect(m.resend).toHaveBeenCalledOnce());await act(async()=>{});page.unmount();open('/app');fireEvent.click(screen.getByRole('button',{name:'Reintentar respuesta y reenvío'}));
 await waitFor(()=>expect(m.resend).toHaveBeenCalledTimes(2));expect(m.message).toHaveBeenCalledOnce();expect(m.resend.mock.calls[1][0]).toEqual({id:'g',expectedUpdatedAt:'2026-10-26T12:00:00.000Z'});
});
it('double click sends one response and one resend',async()=>{
 let resolve!:()=>void;m.message.mockReturnValue(new Promise<void>(r=>resolve=r));open();fireEvent.change(field('reply'),{target:{value:'Mi respuesta'}});fireEvent.click(send('reply'));fireEvent.click(screen.getByRole('button',{name:/Reintentar respuesta/}));expect(m.message).toHaveBeenCalledOnce();await act(async()=>resolve());expect(m.resend).toHaveBeenCalledOnce();
});
it('account change cannot recover another person’s text',()=>{
 const page=open();fireEvent.change(field('message'),{target:{value:'Privado del primero'}});page.unmount();m.user={id:'second',rol:'GENERADOR'};open();expect(field('message')).toHaveValue('');
});
it('an already recorded reply and advanced application reconcile on reopen without posting',async()=>{
 m.resend.mockRejectedValueOnce(new Error('lost'));const page=open();fireEvent.change(field('reply'),{target:{value:'Respuesta guardada'}});fireEvent.click(send('reply'));await waitFor(()=>expect(m.resend).toHaveBeenCalledOnce());await act(async()=>{});
 const c=m.message.mock.calls[0][0];page.unmount();m.rows[0].estado='EN_REVISION';m.messages=[{id:'ui-'+c.clientMessageId,contenido:c.contenido,autorRol:'CANDIDATO',createdAt:new Date().toISOString()}];open('/app');expect(await screen.findByText(/Tu respuesta está registrada/)).toBeVisible();expect(m.message).toHaveBeenCalledOnce();expect(m.resend).toHaveBeenCalledOnce();
});
it('new observations require an explicit review before preparing a new response',async()=>{
 m.resend.mockRejectedValueOnce(new Error('stale'));const page=open();fireEvent.change(field('reply'),{target:{value:'Respuesta previa'}});fireEvent.click(send('reply'));await waitFor(()=>expect(m.resend).toHaveBeenCalledOnce());await act(async()=>{});page.unmount();m.rows[0].updatedAt='2026-10-26T13:00:00.000Z';open('/app');expect(screen.getByRole('button',{name:'Preparar respuesta con los datos actuales'})).toBeVisible();expect(m.resend).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Preparar respuesta con los datos actuales'}));expect(field('reply')).toHaveValue('Respuesta previa');expect(send('reply')).toBeEnabled();
});
it('failed durable storage prevents either submission',()=>{
 const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});open();fireEvent.change(field('reply'),{target:{value:'No perder'}});expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar');expect(send('reply')).toBeDisabled();expect(m.message).not.toHaveBeenCalled();spy.mockRestore();
});

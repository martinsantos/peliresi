import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: {id:'owner',rol:'GENERADOR',actorId:'gen'} as any, get:vi.fn(), create:vi.fn(), own:vi.fn() }));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:m.user,isGenerador:m.user?.rol==='GENERADOR',isOperador:m.user?.rol==='OPERADOR'})}));
vi.mock('../../services/api',()=>({default:{get:m.get}}));
vi.mock('../../services/renovacion.service',()=>({renovacionService:{create:m.create,getOwn:m.own}}));
vi.mock('../../components/ui/Toast',()=>({toast:{error:vi.fn(),success:vi.fn(),warning:vi.fn()}}));
import SolicitarCambiosPage from '../../pages/perfil/SolicitarCambiosPage';
const actor=(id='gen')=>({id,razonSocial:'QA '+id,domicilio:'Original '+id,telefono:'2610000000',email:'test@qa.invalid'});
const receipt=(estado='PENDIENTE')=>({id:'receipt',anio:2026,estado,motivoRechazo:estado==='RECHAZADA'?'Falta documentación':undefined});
function view(prefix=''){return <MemoryRouter initialEntries={[prefix+'/mi-perfil/solicitar-cambios']}><SolicitarCambiosPage/></MemoryRouter>;}
async function open(prefix=''){const result=render(view(prefix));await screen.findByLabelText('Domicilio');return result;}
const edit=(value:string)=>fireEvent.change(screen.getByLabelText('Domicilio'),{target:{value}});
const send=()=>screen.getByRole('button',{name:/Enviar solicitud/});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();m.user={id:'owner',rol:'GENERADOR',actorId:'gen'};m.get.mockImplementation(async()=>({data:{data:{[m.user.rol.toLowerCase()]:actor(m.user.actorId)}}}));m.create.mockResolvedValue(receipt());m.own.mockResolvedValue(null);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it.each(['','/app'])('recovers unsent generator and operator changes after reopening on %s',async prefix=>{
 for(const role of ['GENERADOR','OPERADOR']){m.user={id:'owner',rol:role,actorId:role==='GENERADOR'?'gen':'op'};const first=await open(prefix);edit('Propuesta '+role);expect(screen.getByText(/Borrador guardado en este dispositivo/)).toBeVisible();first.unmount();await open(prefix);expect(screen.getByLabelText('Domicilio')).toHaveValue('Propuesta '+role);expect(screen.getByText(/Recuperamos tu propuesta/)).toBeVisible();expect(m.create).not.toHaveBeenCalled();cleanup();}
});
it('switches roles inside the same account without carrying values and restores each context',async()=>{
 const result=await open();edit('Sólo generador');m.user={id:'owner',rol:'OPERADOR',actorId:'op'};result.rerender(view());await waitFor(()=>expect(screen.getByLabelText('Domicilio')).toHaveValue('Original op'));edit('Sólo operador');m.user={id:'owner',rol:'GENERADOR',actorId:'gen'};result.rerender(view());await waitFor(()=>expect(screen.getByLabelText('Domicilio')).toHaveValue('Sólo generador'));expect(m.create).not.toHaveBeenCalled();
});
it('isolates another person even for the same role and actor',async()=>{const result=await open();edit('Privado owner');m.user={...m.user,id:'other'};result.rerender(view());await waitFor(()=>expect(screen.getByLabelText('Domicilio')).toHaveValue('Original gen'));});
it('does not show an earlier account response after its context was removed',async()=>{let resolve!:(v:unknown)=>void;m.get.mockImplementationOnce(()=>new Promise(r=>resolve=r));const result=render(view());m.user={...m.user,id:'other',actorId:'other-gen'};result.rerender(view());await screen.findByDisplayValue('Original other-gen');await act(async()=>resolve({data:{data:{generador:actor('gen')}}}));expect(screen.getByLabelText('Domicilio')).toHaveValue('Original other-gen');});
it('blocks stale registry proposals until keeping the edited fields on current data',async()=>{const first=await open();edit('Mi propuesta');first.unmount();m.get.mockResolvedValue({data:{data:{generador:{...actor(),domicilio:'Cambio servidor',telefono:'2611111111'}}}});await open();expect(screen.getByText(/La ficha cambió/)).toBeVisible();expect(send()).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Conservar mis cambios'}));expect(screen.getByLabelText('Domicilio')).toHaveValue('Mi propuesta');expect(screen.getByLabelText('Teléfono')).toHaveValue('2611111111');fireEvent.click(send());await screen.findByText('Solicitud registrada');expect(m.create.mock.calls[0][0].datosNuevos).toEqual({domicilio:'Mi propuesta'});});
it('can choose current registry data without submitting or leaving hidden changes',async()=>{const first=await open();edit('Mi propuesta');first.unmount();m.get.mockResolvedValue({data:{data:{generador:{...actor(),domicilio:'Cambio servidor'}}}});await open();fireEvent.click(screen.getByRole('button',{name:'Usar datos actuales'}));expect(screen.getByLabelText('Domicilio')).toHaveValue('Cambio servidor');expect(send()).toBeDisabled();expect(m.create).not.toHaveBeenCalled();});
it('keeps the draft through failed precarga and its retry',async()=>{const first=await open();edit('No perder');first.unmount();m.get.mockRejectedValueOnce(new Error('offline'));render(view());await screen.findByRole('button',{name:'Reintentar precarga'});expect(screen.queryByRole('textbox')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Reintentar precarga'}));await waitFor(()=>expect(screen.getByLabelText('Domicilio')).toHaveValue('No perder'));});
it('explains storage failure and blocks sending until the draft is saved',async()=>{await open();const failure=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});edit('Conservar');expect(screen.getByText(/No pudimos guardar el borrador/)).toBeVisible();expect(send()).toBeDisabled();failure.mockRestore();fireEvent.click(screen.getByRole('button',{name:'Reintentar guardado'}));expect(send()).toBeEnabled();expect(screen.getByLabelText('Domicilio')).toHaveValue('Conservar');});
it('detects another tab without overwriting it and requires an explicit choice',async()=>{await open();edit('Local');const key=Object.keys(localStorage).find(k=>k.startsWith('sitrep:profile-change:v1:'))!;const record=JSON.parse(localStorage.getItem(key)!);record.revision='other';record.value.values.domicilio='Otra pestaña';localStorage.setItem(key,JSON.stringify(record));fireEvent(window,new StorageEvent('storage',{key}));expect(screen.getByText('Este borrador cambió en otra pestaña')).toBeVisible();expect(send()).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Cargar la otra versión'}));expect(screen.getByLabelText('Domicilio')).toHaveValue('Otra pestaña');expect(send()).toBeEnabled();});
it('preserves the same year and payload after an unconfirmed response and reopening',async()=>{m.create.mockRejectedValueOnce(new Error('lost'));const first=await open('/app');edit('Solicitud original');fireEvent.click(send());await screen.findByText(/No pudimos confirmar el envío/);expect(screen.queryByText(/Todavía no enviado/)).not.toBeInTheDocument();const payload=m.create.mock.calls[0][0];first.unmount();await open('/app');fireEvent.click(send());await screen.findByText('Solicitud registrada');expect(m.create.mock.calls[1][0]).toEqual(payload);expect(screen.getByText(/todavía no cambiaron/)).toBeVisible();cleanup();await open();expect(screen.getByLabelText('Domicilio')).toHaveValue('Original gen');expect(send()).toBeDisabled();});
it.each(['APROBADA','RECHAZADA'])('recovered %s request describes its real state',async state=>{m.create.mockResolvedValue(receipt(state));await open();edit('Cambio');fireEvent.click(send());await screen.findByText('Solicitud registrada');expect(screen.getByText(state==='APROBADA'?/ya fue aprobada/:/ya fue rechazada/)).toBeVisible();expect(screen.queryByText(/todavía no cambiaron/)).toBeNull();});
it('does not fetch a registry for an unsupported actor role',()=>{m.user.rol='TRANSPORTISTA';render(view());expect(screen.getByText(/No hay una ficha disponible/)).toBeVisible();expect(m.get).not.toHaveBeenCalled();});
it('does not show success or clear the old context draft after switching while sending',async()=>{let finish!:(v:unknown)=>void;m.create.mockImplementationOnce(()=>new Promise(r=>finish=r));const result=await open();edit('Local');fireEvent.click(send());m.user={id:'owner',rol:'OPERADOR',actorId:'op'};result.rerender(view());await screen.findByDisplayValue('Original op');await act(async()=>finish(receipt()));expect(screen.queryByText('Solicitud registrada')).toBeNull();m.user={id:'owner',rol:'GENERADOR',actorId:'gen'};result.rerender(view());await screen.findByDisplayValue('Local');});
it('double activation sends one request and disables editing while pending',async()=>{let finish!:(v:unknown)=>void;m.create.mockImplementationOnce(()=>new Promise(r=>finish=r));await open();edit('Local');const button=send();fireEvent.click(button);fireEvent.click(button);expect(m.create).toHaveBeenCalledOnce();expect(screen.getByLabelText('Domicilio')).toBeDisabled();await act(async()=>finish(receipt()));});

it.each(['PENDIENTE','APROBADA','RECHAZADA'])('reads a %s decision after reopening without sending the old draft again',async state=>{
 const first=await open();edit('Propuesta enviada');first.unmount();
 m.own.mockResolvedValue({...receipt(state),anio:new Date().getFullYear(),tipoActor:'GENERADOR',modalidad:'CON_CAMBIOS',datosNuevos:JSON.stringify({domicilio:'Propuesta enviada'})});
 if(state==='APROBADA')m.get.mockResolvedValue({data:{data:{generador:{...actor(),domicilio:'Propuesta enviada'}}}});
 render(view('/app'));
 await screen.findByRole('heading',{name:state==='APROBADA'?'Solicitud aprobada':state==='RECHAZADA'?'Solicitud rechazada':'Solicitud en revisión'});
 expect(screen.getByText(/Tu borrador coincide con la solicitud registrada/)).toBeVisible();
 expect(m.create).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Enviar solicitud/})).toBeNull();
 expect(Object.keys(localStorage).filter(k=>k.startsWith('sitrep:profile-change:v1:')).some(k=>localStorage.getItem(k)?.includes('Propuesta enviada'))).toBe(true);
});
it('keeps and distinguishes a different local proposal when the annual request already exists',async()=>{
 const first=await open();edit('Edición posterior privada');first.unmount();
 m.own.mockResolvedValue({...receipt(),anio:new Date().getFullYear(),tipoActor:'GENERADOR',modalidad:'CON_CAMBIOS',datosNuevos:JSON.stringify({domicilio:'Propuesta anterior'})});
 render(view());await screen.findByRole('heading',{name:'Solicitud en revisión'});
 expect(screen.getByText(/Tu borrador local es diferente/)).toBeVisible();expect(screen.getByText('Edición posterior privada')).toBeVisible();expect(m.create).not.toHaveBeenCalled();
});
it('cannot submit while the previous request lookup is unavailable and can retry it',async()=>{
 m.own.mockRejectedValueOnce(new Error('offline'));render(view());
 await screen.findByRole('button',{name:'Reintentar consulta'});expect(screen.queryByRole('button',{name:/Enviar solicitud/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar consulta'}));await screen.findByLabelText('Domicilio');expect(m.own).toHaveBeenCalledTimes(2);expect(m.create).not.toHaveBeenCalled();
});
it('ignores an earlier activity receipt that finishes after a role change',async()=>{
 let finish!:(v:unknown)=>void;m.own.mockImplementationOnce(()=>new Promise(r=>finish=r));
 const result=render(view());await waitFor(()=>expect(m.own).toHaveBeenCalledOnce());
 m.user={id:'owner',rol:'OPERADOR',actorId:'op'};result.rerender(view());await screen.findByDisplayValue('Original op');
 await act(async()=>finish({...receipt('APROBADA'),anio:new Date().getFullYear(),tipoActor:'GENERADOR',modalidad:'CON_CAMBIOS'}));
 expect(screen.queryByRole('heading',{name:'Solicitud aprobada'})).toBeNull();expect(screen.getByLabelText('Domicilio')).toHaveValue('Original op');
});
it('rejects an incoherent receipt instead of showing another period or role',async()=>{
 m.own.mockResolvedValue({...receipt(),anio:2020,tipoActor:'OPERADOR',modalidad:'CON_CAMBIOS'});render(view());await screen.findByRole('button',{name:'Reintentar consulta'});expect(screen.queryByText('Solicitud en revisión')).toBeNull();
});

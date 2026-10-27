import { PREPARED_INVITATION_PREFIX, readPreparedInvitations, clearPreparedInvitations } from '../../services/preparedCompanyInvitations';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { notificationInboxReturnState } from '../../utils/notificationNavigation';
import { beforeEach,afterEach,expect,test,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup,act,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EmpresasPage from './EmpresasPage';
const mocks=vi.hoisted(()=>({request:vi.fn(),get:vi.fn(),generators:vi.fn(),carriers:vi.fn(),operators:vi.fn(),user:{id:'person-qa',rol:'GENERADOR',actorId:'generator-qa'} as {id:string;rol:string;actorId:string;empresaContexto?:any}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:mocks.user})}));
vi.mock('../../services/catalogo.service',()=>({catalogoService:{generadores:mocks.generators,transportistas:mocks.carriers,operadores:mocks.operators}}));
vi.mock('../../services/api',()=>({api:{request:mocks.request,get:mocks.get}}));
beforeEach(()=>{localStorage.clear();sessionStorage.clear();mocks.generators.mockReset().mockResolvedValue([]);mocks.carriers.mockReset().mockResolvedValue([]);mocks.operators.mockReset().mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllEnvs();mocks.request.mockReset();mocks.get.mockReset();mocks.user={id:'person-qa',rol:'GENERADOR',actorId:'generator-qa'};});
const company=(id:string,razonSocial:string)=>({id,cuit:'30712345671',razonSocial,revision:0,domicilioLegal:{calle:'Legal '+id,localidad:'Mendoza',departamento:'Capital'}});
function setup(extra:Record<string,unknown>={}, listOptions:{single?:boolean;admin?:boolean;entry?:any;base?:string}={}){
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const first=company('first','Alfa'),other=company('other','Beta');let changed=false,failSearch=false,detailFailure=0;
 mocks.request.mockImplementation(async({url,method,data})=>{
  if(method==='PUT'){changed=true;return {data:{data:{empresa:{...first,...data,revision:1}}}};}
  if(url.startsWith('/empresas?')){
   const params=new URLSearchParams(url.split('?')[1]);
   if(failSearch&&params.get('search'))throw new Error('QA network unavailable');
   const companies=params.get('search')||params.get('page')==='2'?[]:changed?[other,{...first,razonSocial:'Zeta',revision:1}]:listOptions.single?[first]:[first,other];
   return {data:{data:{empresas:companies,pagination:{page:Number(params.get('page')),limit:25,total:companies.length,totalPages:1},puedeValidar:!!listOptions.admin}}};
  }
  if(detailFailure)throw {response:{status:detailFailure}};
  const c=url.endsWith('/first')?{...first,...(changed?{razonSocial:'Zeta',revision:1}:{})}:other;
  return {data:{data:{empresa:c,contextos:[],actividades:[],establecimientos:[],autorizaciones:[],responsables:[],eventos:[],invitaciones:[],personas:[],puedeGestionar:true,puedeValidar:false,...extra}}};
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 const view=()=> <QueryClientProvider client={client}><MemoryRouter basename={listOptions.base} initialEntries={[listOptions.entry||'/empresas']}><EmpresasPage/></MemoryRouter></QueryClientProvider>;
 const ui=render(view());
 return {client,externalChange:()=>{changed=true;},failSearch:()=>{failSearch=true;},failDetail:(status=503)=>{detailFailure=status;},recover:()=>{detailFailure=0;},rerender:()=>ui.rerender(view()),unmount:()=>ui.unmount()};
}
test.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('%s recovers its legal draft after a fresh mount, and discarding never writes to the server',async rol=>{
 mocks.user={...mocks.user,rol,actorId:rol};
 const first=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Calle sin aplicar '+rol}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Revisar evidencia'}});
 first.unmount();sessionStorage.clear();
 setup();await screen.findByText('Borrador recuperado en este dispositivo · cambios sin aplicar');
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Calle sin aplicar '+rol);
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('Revisar evidencia');
 fireEvent.click(screen.getByRole('button',{name:'Descartar borrador de domicilio legal'}));
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('reopening recovers independent establishment and people drafts without submitting either',async()=>{
 const first=setup({actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Establecimientos'}));
 fireEvent.change(screen.getByLabelText('Código de establecimiento'),{target:{value:'QA-SEDE'}});
 fireEvent.change(screen.getByLabelText('Domicilio productivo'),{target:{value:'Pendiente de verificar'}});
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'draft@qa.invalid'}});
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'o'}});
 fireEvent.change(screen.getByLabelText('Motivo de revocación'),{target:{value:'Sólo borrador'}});
 first.unmount();sessionStorage.clear();
 setup({actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('draft@qa.invalid');
 expect(screen.getByLabelText('Rol en esta empresa')).toHaveValue('o');
 expect(screen.getByLabelText('Motivo de revocación')).toHaveValue('Sólo borrador');
 fireEvent.click(screen.getByRole('button',{name:'Establecimientos'}));
 expect(screen.getByLabelText('Código de establecimiento')).toHaveValue('QA-SEDE');
 expect(screen.getByLabelText('Domicilio productivo')).toHaveValue('Pendiente de verificar');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('account and role changes isolate persisted drafts and restore them only on return',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');const owner={...mocks.user};
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Privado generador'}});
 mocks.user={...owner,rol:'OPERADOR',actorId:'operator-qa'};state.rerender();
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Privado operador'}});
 mocks.user={...owner,id:'second-person'};state.rerender();
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 mocks.user=owner;state.rerender();
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Privado generador'));
 mocks.user={...owner,rol:'OPERADOR',actorId:'operator-qa'};state.rerender();
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Privado operador'));
});
test('fresh permission denial does not render a previously saved private draft',async()=>{
 const first=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Privado pendiente'}});first.unmount();
 setup({puedeGestionar:false});await screen.findByText(/^Legal first ·/);
 expect(screen.queryByDisplayValue('Privado pendiente')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Calle legal')).not.toBeInTheDocument();
 expect(screen.queryByText(/Borrador recuperado/)).not.toBeInTheDocument();
});
test('a confirmed write with failed follow-up read cannot resurrect on reopen',async()=>{
 const first=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Zeta'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Confirmado'}});
 first.failDetail();fireEvent.click(screen.getByRole('button',{name:'Guardar datos legales'}));
 await screen.findByText(/El cambio fue registrado/);first.unmount();
 setup();await screen.findByLabelText('Calle legal');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('');
 expect(screen.queryByText(/Borrador recuperado/)).not.toBeInTheDocument();
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='PUT')).toHaveLength(1);
});
test('blocked device storage retains input and explains that recovery is unavailable',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'No perder este texto'}});
 expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar este borrador');
 expect(screen.getByLabelText('Calle legal')).toHaveValue('No perder este texto');
 expect(screen.queryByText('Borrador en este dispositivo · cambios sin aplicar')).not.toBeInTheDocument();
});
test('a recovered person draft retains its role when the server reorders activities',async()=>{
 const first=setup({actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'scope@qa.invalid'}});first.unmount();
 setup({actividades:[{id:'o',rol:'OPERADOR'},{id:'g',rol:'GENERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByLabelText('Rol en esta empresa')).toHaveValue('g');
});
test('a removed role in a recovered draft never falls back to a different authorization',async()=>{
 const first=setup({actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'scope@qa.invalid'}});first.unmount();
 setup({actividades:[{id:'o',rol:'OPERADOR'}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByRole('alert')).toHaveTextContent('El rol guardado en el borrador ya no está disponible');
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'o'}});
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('scope@qa.invalid');
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeEnabled();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('an inactive recovered establishment must be removed explicitly before authorization',async()=>{
 const extra={actividades:[{id:'g',rol:'GENERADOR'}],establecimientos:[{id:'s',nombre:'Sede QA',codigo:'QA',activo:true}]};
 const first=setup(extra);await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'scope@qa.invalid'}});
 fireEvent.click(screen.getByLabelText('Todos los establecimientos'));
 fireEvent.click(screen.getByLabelText('Sede QA'));first.unmount();
 extra.establecimientos[0].activo=false;
 setup(extra);await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByRole('alert')).toHaveTextContent('Un establecimiento del borrador ya no está activo');
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Quitar establecimientos no disponibles'}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 fireEvent.click(screen.getByLabelText('Todos los establecimientos'));
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeEnabled();
});
test('a successful write followed by a failed read preserves its form and retry never submits twice',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Zeta'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Cambio artificial QA'}});
 state.failDetail();fireEvent.click(screen.getByRole('button',{name:'Guardar datos legales'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('El cambio fue registrado');
 expect(screen.getByRole('alert')).toHaveFocus();
 expect(screen.getByLabelText('Razón social')).toHaveValue('Zeta');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('Cambio artificial QA');
 expect(screen.getByRole('button',{name:'Guardar datos legales'})).toBeDisabled();
 expect(screen.queryByText('Cambios guardados')).not.toBeInTheDocument();
 state.recover();fireEvent.click(screen.getByRole('button',{name:'Reintentar empresa'}));
 await screen.findByText('Cambios guardados');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('');
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='PUT')).toHaveLength(1);
});
test('stale details disable edits until a fresh read while preserving unsaved input',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Pendiente QA'}});
 state.failDetail();await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(await screen.findByRole('alert')).toHaveTextContent('Conservamos lo escrito');
 expect(screen.getByLabelText('Calle legal')).toBeDisabled();
 state.recover();fireEvent.click(screen.getByRole('button',{name:'Reintentar empresa'}));
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).not.toBeDisabled());
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Pendiente QA');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('a revoked company access never exposes cached management controls',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 state.failDetail(403);await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(await screen.findByRole('alert')).toHaveTextContent('Ya no está disponible el acceso');
 expect(screen.queryByLabelText('Calle legal')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Personas autorizadas'})).not.toBeInTheDocument();
});
test('changing the active role does not inherit the previous role draft or cached permissions',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Borrador generador'}});
 const previousReads=mocks.request.mock.calls.filter(([r])=>r.url==='/empresas/first').length;
 mocks.user={...mocks.user,rol:'OPERADOR',actorId:'operator-qa'};state.rerender();
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 expect(mocks.request.mock.calls.filter(([r])=>r.url==='/empresas/first').length).toBeGreaterThan(previousReads);
});
test.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('the company selector reflects the active %s context and establishment instead of the first result',async role=>{
 mocks.user={...mocks.user,rol:role,empresaContexto:{empresaId:'first',actividadId:role,establecimientoId:'site-b',autorizacionId:'qa-grant',revision:1}};
 setup({contextos:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({empresaId:'first',actividadId:rol,rol,autorizacionId:'qa-grant',revision:1,todosEstablecimientos:true,establecimientos:[{id:'site-a',nombre:'Sede A',codigo:'A'},{id:'site-b',nombre:'Sede B',codigo:'B'}]}))});
 await screen.findByLabelText('Actividad autorizada');
 expect(screen.getByLabelText('Actividad autorizada')).toHaveValue(role);
 expect(screen.getByLabelText('Establecimiento para operar')).toHaveValue('site-b');
});
test('a background company notice preserves dirty values and requires reconciliation before saving the current revision',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Mi domicilio pendiente'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Evidencia local'}});
 state.externalChange();await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(await screen.findByText('Los datos de SITREP cambiaron')).toBeVisible();
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Mi domicilio pendiente');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('Evidencia local');
 expect(screen.getByRole('button',{name:'Guardar datos legales'})).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('Zeta');
 fireEvent.click(screen.getByRole('button',{name:'Conservar mis cambios'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar datos legales'}));
 await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({method:'PUT',data:expect.objectContaining({revision:1,razonSocial:'Zeta',motivo:'Evidencia local',domicilioLegal:expect.objectContaining({calle:'Mi domicilio pendiente'})})})));
});
test('choosing the server version explicitly replaces the draft and clears its reason',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Borrador propio'}});
 state.externalChange();await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 fireEvent.click(await screen.findByRole('button',{name:'Usar datos de SITREP'}));
 expect(screen.getByLabelText('Razón social')).toHaveValue('Zeta');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('');
 expect(screen.queryByText('Los datos de SITREP cambiaron')).not.toBeInTheDocument();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('an establishment changed remotely preserves its draft independently from the legal form',async()=>{
 const site={id:'site-qa',codigo:'QA',nombre:'Sede QA',domicilio:'Calle inicial',revision:0,activo:true};
 const state=setup({establecimientos:[site]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:/^Establecimientos$/}));
 fireEvent.click(screen.getByText('Editar establecimiento'));
 const form=screen.getByRole('button',{name:'Guardar establecimiento'}).closest('form')!;
 fireEvent.change(within(form).getByLabelText('Domicilio productivo'),{target:{value:'Calle por guardar'}});
 site.revision=1;site.domicilio='Calle nueva de SITREP';state.externalChange();
 await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(within(form).getByLabelText('Domicilio productivo')).toHaveValue('Calle por guardar');
 expect(await screen.findByRole('alert')).toHaveTextContent('Calle nueva de SITREP');
 expect(screen.getByRole('button',{name:'Guardar establecimiento'})).toBeDisabled();
 fireEvent.click(await screen.findByRole('button',{name:'Usar datos de SITREP'}));
 expect(within(form).getByLabelText('Domicilio productivo')).toHaveValue('Calle nueva de SITREP');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('renaming the first company never switches to the new first result after the server reorders its page',async()=>{
 setup();await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Zeta'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'QA cambio de nombre'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar datos legales'}));
 await waitFor(()=>expect(screen.getByLabelText('Razón social')).toHaveValue('Zeta'));
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first');
 expect(screen.getByLabelText('Empresa',{exact:true})).toHaveValue('first');
});
test('a failed search preserves the selected company and the unsaved form; retry does not erase its draft',async()=>{
 const state=setup();await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Domicilio sin guardar'}});state.failSearch();
 fireEvent.change(screen.getByLabelText('Buscar empresa'),{target:{value:'Sin red'}});
 fireEvent.click(screen.getByRole('button',{name:'Buscar'}));
 await screen.findByText('No pudimos consultar las empresas.');
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Domicilio sin guardar');
 fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
 await waitFor(()=>expect(mocks.request.mock.calls.filter(([r])=>r.url.includes('search=Sin+red')).length).toBeGreaterThanOrEqual(2));
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Domicilio sin guardar');
});
test('switching sections preserves legal drafts without exposing the hidden save action',async()=>{
 setup();await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first'));
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Domicilio por conciliar'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Revisar evidencia antes de guardar'}});
 expect(screen.queryByLabelText('Correo de la persona')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/^Establecimientos$/}));
 expect(screen.queryByRole('button',{name:'Guardar datos legales'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/^Empresa$/}));
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Domicilio por conciliar');
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveValue('Revisar evidencia antes de guardar');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('a new establishment draft survives navigation between company sections',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:/^Establecimientos$/}));
 fireEvent.change(screen.getByLabelText('Código de establecimiento'),{target:{value:'QA-PENDIENTE'}});
 fireEvent.change(screen.getByLabelText('Domicilio productivo'),{target:{value:'Sede por verificar'}});
 fireEvent.click(screen.getByRole('button',{name:/^Personas autorizadas$/}));
 expect(screen.queryByRole('button',{name:'Agregar establecimiento'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/^Establecimientos$/}));
 expect(screen.getByLabelText('Código de establecimiento')).toHaveValue('QA-PENDIENTE');
 expect(screen.getByLabelText('Domicilio productivo')).toHaveValue('Sede por verificar');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('a person draft survives section changes but never leaks to another company',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:/^Personas autorizadas$/}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'delegado@night-qa.invalid'}});
 fireEvent.change(screen.getByLabelText('Motivo de revocación'),{target:{value:'Borrador no enviado'}});
 fireEvent.click(screen.getByRole('button',{name:/^Empresa$/}));
 expect(screen.queryByRole('button',{name:'Autorizar cuenta verificada'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/^Personas autorizadas$/}));
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('delegado@night-qa.invalid');
 expect(screen.getByLabelText('Motivo de revocación')).toHaveValue('Borrador no enviado');
 fireEvent.change(screen.getByLabelText('Empresa',{exact:true}),{target:{value:'other'}});
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal other'));
 fireEvent.click(screen.getByRole('button',{name:/^Personas autorizadas$/}));
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('');
 expect(screen.getByLabelText('Motivo de revocación')).toHaveValue('');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});

test('two people share all roles: a third is blocked while an existing person can gain another activity',async()=>{
 setup({actividades:[{id:'activity',rol:'GENERADOR'}],cupoPersonas:{maximo:2,ocupados:2,personas:[{id:'one',nombre:'Titular QA',email:'one@qa.invalid',activo:true,responsable:true,roles:['GENERADOR','OPERADOR']},{id:'two',nombre:'Representante QA',email:'two@qa.invalid',activo:true,responsable:false,roles:['GENERADOR']}],reservas:[]}});
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByText('2 de 2')).toBeVisible();expect(screen.getAllByText('Titular QA')).toHaveLength(1);
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'third@qa.invalid'}});
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:' TWO@qa.invalid '}});
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeEnabled();expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});

for(const active of [true,false])test(`an existing ${active?'active':'revoked'} role guides explicit authorization instead of an unusable invitation`,async()=>{
 setup({actividades:[{id:'activity',rol:'GENERADOR'}],personas:[{id:'two',email:'two@qa.invalid',nombre:'Representante QA'}],autorizaciones:[{id:'grant',usuarioId:'two',actividadId:'activity',activa:active,revision:4,todosEstablecimientos:true}]});
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'TWO@qa.invalid'}});
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 expect(within(screen.getByRole('button',{name:'Autorizar cuenta verificada'}).closest('form')!).getByRole('status')).toHaveTextContent(active?'ya está autorizada':'fue revocado');
 fireEvent.click(screen.getByRole('button',{name:'Autorizar cuenta verificada'}));
 await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({method:'POST',url:'/empresas/first/personas',data:expect.objectContaining({email:'two@qa.invalid',revision:4})})));
});
test('a live invitation blocks duplicates only for its own role and expiration releases the action',async()=>{
 const invitation={id:'invite',email:'two@qa.invalid',actividadId:'g',venceAt:new Date(Date.now()+86400000).toISOString()};
 const details={actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}],invitaciones:[invitation]};
 const state=setup(details);
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'two@qa.invalid'}});
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();expect(within(screen.getByRole('button',{name:'Autorizar cuenta verificada'}).closest('form')!).getByRole('status')).toHaveTextContent('Ya hay una invitación vigente');
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'o'}});
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'g'}});
 details.invitaciones=[{...invitation,venceAt:new Date(Date.now()-1000).toISOString()}];await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled());
});

test('a prepared link identifies its recipient and role independently of the next form and disappears on revocation',async()=>{
 const details={actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}],invitaciones:[] as Array<{id:string;email:string;actividadId:string;venceAt:string;revocadaAt?:string}>};
 setup(details);const original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{
  if(request.method==='POST'&&request.url.endsWith('/invitaciones')){
   details.invitaciones=[{id:'new',email:request.data.email,actividadId:request.data.actividadId,venceAt:new Date(Date.now()+86400000).toISOString()}];
   return {data:{data:{invitacion:{id:'new',venceAt:details.invitaciones[0].venceAt},ruta:'/empresa-invitacion/'+'a'.repeat(64)}}};
  }
  if(request.method==='POST'&&request.url.endsWith('/invitaciones/new/revocar')){
   details.invitaciones=details.invitaciones.map(i=>({...i,revocadaAt:new Date().toISOString()}));return {data:{data:{revocada:true}}};
  }
  return original(request);
 });
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'two@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));
 expect(await screen.findByLabelText('Enlace de invitación')).toHaveValue(window.location.origin+'/empresa-invitacion/'+'a'.repeat(64));
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'o'}});expect(screen.getByLabelText('Enlace de invitación')).toBeVisible();expect(screen.getByText('Generador · Invitación pendiente')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'g'}});expect(screen.getByLabelText('Enlace de invitación')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'another@qa.invalid'}});expect(screen.getByLabelText('Enlace de invitación')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'two@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Revocar invitación'}));
 await waitFor(()=>expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument());
});

test('initial query failure never renders an empty picker or pagination',async()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');mocks.request.mockRejectedValue(new Error('QA offline'));
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><EmpresasPage/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar las empresas.');
 expect(screen.queryByText('Sin coincidencias')).toBeNull();
 expect(screen.queryByRole('navigation',{name:'Páginas de empresas'})).toBeNull();
 expect(screen.queryByLabelText('Buscar empresa')).toBeNull();
});
test('empty account explains where its actor information is without a useless search',async()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 mocks.request.mockResolvedValue({data:{data:{empresas:[],pagination:{page:1,limit:25,total:0,totalPages:1},puedeValidar:false}}});
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><EmpresasPage/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText('No hay empresas vinculadas a esta cuenta')).toBeVisible();
 expect(screen.getByRole('link',{name:'Volver a Mi perfil'})).toHaveAttribute('href','/mi-perfil');
 expect(screen.queryByLabelText('Buscar empresa')).toBeNull();
});

test('one unfiltered company skips search while current role and changes remain accessible',async()=>{
 mocks.user={...mocks.user,empresaContexto:{empresaId:'first',actividadId:'o',rol:'OPERADOR'}};
 const choices=[{empresaId:'first',actividadId:'g',rol:'GENERADOR',establecimientos:[],todosEstablecimientos:true},{empresaId:'first',actividadId:'o',rol:'OPERADOR',establecimientos:[],todosEstablecimientos:true}];
 setup({contextos:choices},{single:true});await screen.findByLabelText('Calle legal');
 expect(screen.queryByRole('region',{name:'Buscar y seleccionar empresa'})).toBeNull();
 const details=screen.getByLabelText('Cambiar contexto de trabajo');expect(details).not.toHaveAttribute('open');
 expect(screen.getByText('Cambiar actividad o sede')).toBeVisible();
 expect(screen.getByLabelText('Actividad autorizada')).toHaveValue('o');
 fireEvent.click(screen.getByText('Cambiar actividad o sede'));
 expect(screen.getByLabelText('Actividad autorizada')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Pendiente sin cerrar'}});
 fireEvent.click(screen.getByText('Cambiar actividad o sede'));
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Pendiente sin cerrar');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('public administrators keep directory search even with a single matching company',async()=>{
 setup({}, {single:true,admin:true});await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('region',{name:'Buscar y seleccionar empresa'})).toBeVisible();
});
test('a filtered directory never collapses into a single-company context',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Buscar empresa'),{target:{value:'Sin coincidencias QA'}});
 fireEvent.click(screen.getByRole('button',{name:'Buscar'}));
 await screen.findByText('Sin coincidencias');
 expect(screen.getByRole('button',{name:'Limpiar búsqueda'})).toBeVisible();
 expect(screen.getByLabelText('Empresa',{exact:true})).toHaveValue('first');
});

test('a company notice offers an explicit inbox return and avoids a one-company picker',async()=>{
 setup({}, {single:true,entry:'/empresas?empresa=first&origen=avisos'});
 await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('link',{name:'Volver a Avisos'})).toHaveAttribute('href','/notificaciones');
 expect(screen.queryByRole('link',{name:'Volver a Mi perfil'})).not.toBeInTheDocument();
 expect(screen.queryByRole('searchbox',{name:'Buscar empresa'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Legal first');
});
test('ordinary profile access keeps its profile return',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('link',{name:'Volver a Mi perfil'})).toHaveAttribute('href','/mi-perfil');
});

test.each(['','/app'])('explicit return preserves inbox filters in %s and drops them after a context change',async base=>{
 const entry={pathname:base+'/empresas',search:'?empresa=first&origen=avisos',state:notificationInboxReturnState('?avisos=sin-leer&pagina=2',inspectionWorkspaceOwner(mocks.user))};
 const view=setup({}, {single:true,entry,base});await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('link',{name:'Volver a Avisos'})).toHaveAttribute('href',base+'/notificaciones?avisos=sin-leer&pagina=2');
 mocks.user={...mocks.user,rol:'OPERADOR',actorId:'operator'};view.rerender();await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('link',{name:'Volver a Avisos'})).toHaveAttribute('href',base+'/notificaciones');
});

const savedInvitationPath='/empresa-invitacion/'+'b'.repeat(64);
async function prepareRecoverableInvitation(){
 const details={actividades:[{id:'g',rol:'GENERADOR'}],invitaciones:[] as any[]};
 const state=setup(details),original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{
  if(request.method==='POST'){
   const invitation={id:'saved',email:request.data.email,actividadId:'g',venceAt:new Date(Date.now()+86400000).toISOString()};
   details.invitaciones=[invitation];return {data:{data:{invitacion:invitation,ruta:savedInvitationPath}}};
  }return original(request);
 });
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'recover@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));await screen.findByLabelText('Enlace de invitación');
 state.unmount();sessionStorage.clear();return details;
}
test.each(['','/app'])('reopening %s recovers a prepared link only after a fresh server read, without sending again',async base=>{
 const details=await prepareRecoverableInvitation();mocks.request.mockClear();
 setup(details,{base,entry:base+'/empresas'});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'Ver enlace de recover@qa.invalid'}));
 expect(screen.getByLabelText('Enlace de invitación')).toHaveValue(window.location.origin+savedInvitationPath);
 expect(mocks.request.mock.calls.every(([request])=>request.method==='GET')).toBe(true);
});
test.each(['account','role','company','permission','revoked','expired','accepted'])('recovery cannot reveal the link under a different or invalid %s',async kind=>{
 const details=await prepareRecoverableInvitation();
 if(kind==='account')mocks.user={...mocks.user,id:'someone-else'};
 if(kind==='role')mocks.user={...mocks.user,rol:'OPERADOR',actorId:'operator-qa'};
 if(kind==='revoked')details.invitaciones[0].revocadaAt=new Date().toISOString();
 if(kind==='accepted')details.invitaciones[0].aceptadaAt=new Date().toISOString();
 if(kind==='expired')details.invitaciones[0].venceAt=new Date(Date.now()-1000).toISOString();
 setup({...details,...(kind==='permission'?{puedeGestionar:false}:{})},{entry:kind==='company'?'/empresas?empresa=other':'/empresas'});
 if(kind==='permission'){await screen.findByText(/^Legal first ·/);}else{
  await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 }
 expect(screen.queryByRole('button',{name:'Ver enlace de recover@qa.invalid'})).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument();
});
test('failed refresh hides a recovered link until authority is checked again',async()=>{
 const details=await prepareRecoverableInvitation(),state=setup(details);
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.click(screen.getByRole('button',{name:'Ver enlace de recover@qa.invalid'}));
 state.failDetail();await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 await waitFor(()=>expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument());
 state.recover();fireEvent.click(screen.getByRole('button',{name:'Reintentar empresa'}));
 expect(await screen.findByLabelText('Enlace de invitación')).toBeVisible();
});
test('invalid local links are never restored, and signing out clears only prepared links',()=>{
 const entry={id:'saved',path:savedInvitationPath,expiresAt:Date.now()+60000};
 localStorage.setItem(PREPARED_INVITATION_PREFIX+'scope',JSON.stringify([entry,{...entry,path:'https://outside.invalid/token'},{...entry,expiresAt:Date.now()-1}]));
 expect(readPreparedInvitations('scope')).toEqual([entry]);
 localStorage.setItem('other-project','keep');clearPreparedInvitations();
 expect(readPreparedInvitations('scope')).toEqual([]);expect(localStorage.getItem('other-project')).toBe('keep');
});

test('another tab signing out removes a displayed link without modifying the company',async()=>{
 const details=await prepareRecoverableInvitation();mocks.request.mockClear();setup(details);
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.click(screen.getByRole('button',{name:'Ver enlace de recover@qa.invalid'}));
 clearPreparedInvitations();fireEvent(window,new StorageEvent('storage',{key:null}));
 expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument();
 expect(mocks.request.mock.calls.every(([request])=>request.method==='GET')).toBe(true);
});
test('a recovered invitation disappears when its server expiry passes while the page stays open',async()=>{
 const details=await prepareRecoverableInvitation();details.invitaciones[0].venceAt=new Date(Date.now()+500).toISOString();setup(details);
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.click(screen.getByRole('button',{name:'Ver enlace de recover@qa.invalid'}));
 await waitFor(()=>expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument(),{timeout:2000});
 expect(screen.getByText('Generador · Vencida')).toBeVisible();
});

async function uncertainPreparation(options:{committed?:boolean;status?:number;incomplete?:boolean}={}){
 const details={actividades:[{id:'g',rol:'GENERADOR'}],invitaciones:[] as any[]};
 const state=setup(details),original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{
  if(request.method==='POST'&&request.url.endsWith('/invitaciones')){
   if(options.committed)details.invitaciones=[{id:'uncertain-created',email:request.data.email,actividadId:'g',venceAt:new Date(Date.now()+86400000).toISOString()}];
   if(options.incomplete)return {data:{data:{invitacion:{id:'missing-link'}}}};
   throw options.status?{response:{status:options.status,data:{message:'QA error'}}}:new Error('Response lost');
  }
  return original(request);
 });
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'uncertain@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));
 return {state,details};
}
test.each([undefined,503,408,409])('lost preparation (%s) requires a read before another write, without consuming another place',async status=>{
 await uncertainPreparation({committed:true,status});
 expect(await screen.findByRole('heading',{name:'Comprobar preparación de invitación'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 await waitFor(()=>expect(screen.getByText(/No recibimos una confirmación completa/).closest('[role="status"]')).toHaveFocus());
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('uncertain@qa.invalid');
 const writes=()=>mocks.request.mock.calls.filter(([r])=>r.method==='POST');
 expect(writes()).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 expect(await screen.findByRole('heading',{name:'Preparación comprobada'})).toBeVisible();
 expect(screen.getByText(/Hay una invitación vigente para esta persona y rol/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Revocar invitación'})).toBeVisible();
 expect(screen.queryByLabelText('Enlace de invitación')).toBeNull();
 expect(writes()).toHaveLength(1);
});
test('an incomplete success is uncertain and never clears the invitation form',async()=>{
 await uncertainPreparation({committed:true,incomplete:true});
 expect(await screen.findByRole('heading',{name:'Comprobar preparación de invitación'})).toBeVisible();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('uncertain@qa.invalid');
 expect(screen.queryByLabelText('Enlace de invitación')).toBeNull();
});
test('when no invitation exists, checking is read-only and permits a separate explicit action',async()=>{
 await uncertainPreparation();await screen.findByRole('button',{name:'Comprobar preparación'});
 fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 expect(await screen.findByText(/No figura una invitación vigente/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
});
test('a failed check keeps the uncertain receipt, values and write block until a fresh read succeeds',async()=>{
 const {state}=await uncertainPreparation({committed:true});await screen.findByRole('button',{name:'Comprobar preparación'});
 state.failDetail();fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 expect(await screen.findByRole('button',{name:'Reintentar empresa'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 state.recover();fireEvent.click(screen.getByRole('button',{name:'Reintentar empresa'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Comprobar preparación'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 expect(await screen.findByText(/Hay una invitación vigente/)).toBeVisible();
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
});
test.each(['','/app'])('reopening %s recovers an unconfirmed preparation without automatically posting',async base=>{
 const {state,details}=await uncertainPreparation({committed:true});await screen.findByRole('button',{name:'Comprobar preparación'});state.unmount();sessionStorage.clear();mocks.request.mockClear();
 setup(details,{base,entry:base+'/empresas'});await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(await screen.findByRole('button',{name:'Comprobar preparación'})).toBeVisible();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('uncertain@qa.invalid');
 expect(mocks.request.mock.calls.every(([r])=>r.method==='GET')).toBe(true);
});
test.each(['account','role'])('an uncertain preparation is not shown after changing %s',async kind=>{
 const {state,details}=await uncertainPreparation();await screen.findByRole('button',{name:'Comprobar preparación'});state.unmount();
 mocks.user={...mocks.user,...(kind==='account'?{id:'different-person'}:{rol:'OPERADOR',actorId:'different-actor'})};
 setup(details);await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.queryByRole('button',{name:'Comprobar preparación'})).toBeNull();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('');
});
test('definitive validation errors do not trap the form in an uncertain result',async()=>{
 await uncertainPreparation({status:422});expect(await screen.findByRole('alert')).toHaveTextContent('QA error');
 expect(screen.queryByRole('button',{name:'Comprobar preparación'})).toBeNull();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('uncertain@qa.invalid');
});
test('a preparation interrupted before any response remains recoverable after closing',async()=>{
 const details={actividades:[{id:'g',rol:'GENERADOR'}]};
 const state=setup(details),original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(request=>request.method==='POST'?new Promise(()=>{}):original(request));
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'in-flight@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));state.unmount();mocks.request.mockClear();
 setup(details);await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(await screen.findByRole('button',{name:'Comprobar preparación'})).toBeVisible();
 expect(screen.getByText(/in-flight@qa.invalid/)).toBeVisible();
 expect(mocks.request.mock.calls.every(([r])=>r.method==='GET')).toBe(true);
});
test('signing out clears an uncertain preparation without clearing another project',async()=>{
 await uncertainPreparation();await screen.findByRole('button',{name:'Comprobar preparación'});
 localStorage.setItem('another-project','keep');
 clearPreparedInvitations();fireEvent(window,new StorageEvent('storage',{key:null}));
 expect(screen.queryByRole('button',{name:'Comprobar preparación'})).toBeNull();
 expect(localStorage.getItem('another-project')).toBe('keep');
});
test('checking an earlier attempt identifies its recipient even if the next form has changed',async()=>{
 await uncertainPreparation({committed:true});await screen.findByRole('button',{name:'Comprobar preparación'});
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'next-person@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 const title=await screen.findByRole('heading',{name:'Preparación comprobada'});
 expect(within(title.closest('[role="status"]')!).getByText('uncertain@qa.invalid · Generador')).toBeVisible();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('next-person@qa.invalid');
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
});
test('failure to clear the local copy does not trap a result already checked with the server',async()=>{
 await uncertainPreparation();await screen.findByRole('button',{name:'Comprobar preparación'});
 vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('QA storage unavailable');});
 fireEvent.click(screen.getByRole('button',{name:'Comprobar preparación'}));
 expect(await screen.findByText(/No figura una invitación vigente/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 expect(screen.getByText(/No pudimos actualizar la copia/)).toBeVisible();
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));
 await screen.findByRole('button',{name:'Comprobar preparación'});
 expect(mocks.request.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(2);
});
test.each([false,true])('a late successful response cannot restore a secret after leaving the view (logout=%s)',async logout=>{
 const details={actividades:[{id:'g',rol:'GENERADOR'}]};
 const state=setup(details),original=mocks.request.getMockImplementation()!;
 let complete!:(value:unknown)=>void;
 mocks.request.mockImplementation(request=>request.method==='POST'?new Promise(resolve=>{complete=resolve;}):original(request));
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'late@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));state.unmount();
 if(logout)clearPreparedInvitations();
 await act(async()=>{complete({data:{data:{invitacion:{id:'late',venceAt:new Date(Date.now()+86400000).toISOString()},ruta:savedInvitationPath}}});});
 expect(Object.keys(localStorage).filter(key=>key.startsWith(PREPARED_INVITATION_PREFIX))).toHaveLength(0);
 const pending=Object.keys(localStorage).filter(key=>key.startsWith('sitrep:invitation-preparation:v1:'));
 expect(pending).toHaveLength(logout?0:1);
});

for (const base of ['', '/app']) test(`expired invitations refresh the shared capacity without authorizing anyone (${base})`, async () => {
 const expires=Date.now()+600;
 const details={actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}],invitaciones:[{id:'expiring',email:'pending@qa.invalid',actividadId:'g',venceAt:new Date(expires).toISOString()}],cupoPersonas:{maximo:2,ocupados:2,personas:[{id:'owner',nombre:'Titular QA',email:'owner@qa.invalid',activo:true,responsable:true,roles:['GENERADOR','OPERADOR']}],reservas:['pending@qa.invalid']}};
 setup(details,{base,entry:base+'/empresas'});const original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{if(request.url==='/empresas/first'&&Date.now()>=expires)details.cupoPersonas={...details.cupoPersonas,ocupados:1,reservas:[]};return original(request);});
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'third@qa.invalid'}});
 expect(screen.getByText('2 de 2')).toBeVisible();expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeDisabled();
 await waitFor(()=>expect(screen.getByText('1 de 2')).toBeVisible(),{timeout:2000});
 expect(screen.getByText('Generador · Vencida')).toBeVisible();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('third@qa.invalid');
 expect(screen.getByRole('button',{name:'Preparar invitación'})).toBeEnabled();
 expect(mocks.request.mock.calls.filter(([request])=>request.method!=='GET')).toHaveLength(0);
});

for (const base of ['', '/app']) test(`expiry read failure blocks actions and retries the read, not the invitation (${base})`, async () => {
 const expires=Date.now()+600;
 const details={actividades:[{id:'g',rol:'GENERADOR'}],invitaciones:[{id:'expiring',email:'pending@qa.invalid',actividadId:'g',venceAt:new Date(expires).toISOString()}],cupoPersonas:{maximo:2,ocupados:2,personas:[{id:'owner',nombre:'Titular QA',email:'owner@qa.invalid',activo:true,responsable:true,roles:['GENERADOR']}],reservas:['pending@qa.invalid']}};
 const state=setup(details,{base,entry:base+'/empresas'});
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'owner@qa.invalid'}});
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeEnabled();state.failDetail();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Reintentar empresa'})).toBeVisible(),{timeout:2000});
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 state.recover();details.cupoPersonas={...details.cupoPersonas,ocupados:1,reservas:[]};
 fireEvent.click(screen.getByRole('button',{name:'Reintentar empresa'}));
 await waitFor(()=>expect(screen.getByText('1 de 2')).toBeVisible());
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('owner@qa.invalid');
 expect(mocks.request.mock.calls.filter(([request])=>request.method!=='GET')).toHaveLength(0);
});

for (const base of ['', '/app']) test(`expiry updates capacity while another company section is open (${base})`, async () => {
 const expires=Date.now()+600;
 const details={actividades:[{id:'g',rol:'GENERADOR'}],invitaciones:[{id:'expiring',email:'pending@qa.invalid',actividadId:'g',venceAt:new Date(expires).toISOString()}],cupoPersonas:{maximo:2,ocupados:2,personas:[{id:'owner',nombre:'Titular QA',email:'owner@qa.invalid',activo:true,responsable:true,roles:['GENERADOR']}],reservas:['pending@qa.invalid']}};
 setup(details,{base,entry:base+'/empresas'});const original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{if(request.url==='/empresas/first'&&Date.now()>=expires)details.cupoPersonas={...details.cupoPersonas,ocupados:1,reservas:[]};return original(request);});
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'third@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Empresa'}));
 await waitFor(()=>expect(details.cupoPersonas.ocupados).toBe(1),{timeout:2000});
 fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 expect(screen.getByText('1 de 2')).toBeVisible();
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('third@qa.invalid');
 expect(mocks.request.mock.calls.filter(([request])=>request.method!=='GET')).toHaveLength(0);
});

test('an invitation expiring during a slow initial read is rechecked before trusting its capacity', async () => {
 const expires=Date.now()+300;
 const details={actividades:[{id:'g',rol:'GENERADOR'}],invitaciones:[{id:'expiring',email:'pending@qa.invalid',actividadId:'g',venceAt:new Date(expires).toISOString()}],cupoPersonas:{maximo:2,ocupados:2,personas:[],reservas:['pending@qa.invalid']}};
 setup(details);const original=mocks.request.getMockImplementation()!;let reads=0;
 mocks.request.mockImplementation(async request=>{
  if(request.url==='/empresas/first'){
   reads++;
   if(reads===1){const response=structuredClone(await original(request));await new Promise(resolve=>setTimeout(resolve,Math.max(1,expires-Date.now()+50)));return response;}
   details.cupoPersonas={...details.cupoPersonas,ocupados:1,reservas:[]};
  }
  return original(request);
 });
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 await waitFor(()=>expect(screen.getByText('1 de 2')).toBeVisible());
 expect(reads).toBe(2);
 expect(mocks.request.mock.calls.filter(([request])=>request.method!=='GET')).toHaveLength(0);
});

const workspaceChoices = (roles:string[], sites=true) => roles.map(rol=>({empresaId:'first',razonSocial:'Alfa',actividadId:rol,rol,autorizacionId:'qa-'+rol,revision:1,todosEstablecimientos:true,establecimientos:sites?[{id:'site-a',nombre:'Sede A',codigo:'A'}]:[]}));
test.each(['/empresas','/app/empresas'])('%s personal transport context selects its own available company role, not the first generator',async entry=>{
 mocks.user={...mocks.user,rol:'TRANSPORTISTA',actorId:'transport-qa'};
 setup({contextos:workspaceChoices(['GENERADOR','TRANSPORTISTA','OPERADOR'])},{entry,base:entry.startsWith('/app')?'/app':undefined});
 await screen.findByLabelText('Calle legal');
 expect(screen.getByLabelText('Actividad autorizada')).toHaveValue('TRANSPORTISTA');
 expect(screen.getByLabelText('Cambiar contexto de trabajo')).not.toHaveAttribute('open');
 expect(mocks.request.mock.calls.every(([r])=>r.method==='GET')).toBe(true);
});
test('another company active context does not force the first role for this company',async()=>{
 mocks.user={...mocks.user,rol:'OPERADOR',empresaContexto:{empresaId:'other',actividadId:'other-role',rol:'OPERADOR'}};
 setup({contextos:workspaceChoices(['GENERADOR','OPERADOR'])});await screen.findByLabelText('Calle legal');
 expect(screen.getByLabelText('Actividad autorizada')).toHaveValue('OPERADOR');
});
test('multiple activities without the current role require an explicit selection',async()=>{
 mocks.user={...mocks.user,rol:'OPERADOR'};
 setup({contextos:workspaceChoices(['GENERADOR','TRANSPORTISTA'],false)});await screen.findByLabelText('Calle legal');
 expect(screen.getByLabelText('Actividad autorizada')).toHaveValue('');
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeDisabled();
 expect(screen.getByText('Elegí la actividad con la que querés operar.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Actividad autorizada'),{target:{value:'TRANSPORTISTA'}});
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeEnabled();
});
test.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('%s with no establishments has no empty selector or misleading establishment action',async rol=>{
 mocks.user={...mocks.user,rol};setup({contextos:workspaceChoices([rol],false)});await screen.findByLabelText('Calle legal');
 expect(screen.queryByLabelText('Establecimiento para operar')).toBeNull();
 expect(screen.queryByLabelText('Actividad autorizada')).toBeNull();
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeEnabled();
 expect(screen.queryByText('Sin establecimiento cargado')).toBeNull();
});
test('a restricted activity without an available establishment explains the block',async()=>{
 setup({contextos:[{...workspaceChoices(['GENERADOR'],false)[0],todosEstablecimientos:false}]});await screen.findByLabelText('Calle legal');
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeDisabled();
 expect(screen.getByText('No hay establecimientos disponibles dentro de tu autorización. Pedí al responsable de la empresa que revise tu acceso.')).toBeInTheDocument();
});
test('a company refresh that removes the selected role does not silently choose a different activity',async()=>{
 const extra={contextos:workspaceChoices(['GENERADOR','OPERADOR'])};
 const state=setup(extra);await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Actividad autorizada'),{target:{value:'OPERADOR'}});
 extra.contextos=extra.contextos.filter(c=>c.rol!=='OPERADOR');await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 await waitFor(()=>expect(screen.getByLabelText('Actividad autorizada')).toHaveValue(''));
 expect(screen.getByText('La actividad elegida ya no está disponible. Elegí otra actividad autorizada.')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeDisabled();
});

const twoSites=()=>[{id:'site-a',nombre:'Sede A',codigo:'A'},{id:'site-b',nombre:'Sede B',codigo:'B'}];
test.each(['/empresas','/app/empresas'])('%s never substitutes a removed selected establishment with the first remaining one',async entry=>{
 const extra={contextos:[{...workspaceChoices(['GENERADOR'])[0],establecimientos:twoSites()}]};
 const state=setup(extra,{entry,base:entry.startsWith('/app')?'/app':undefined});await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Establecimiento para operar'),{target:{value:'site-b'}});
 extra.contextos=[{...extra.contextos[0],establecimientos:twoSites().slice(0,1)}];await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 await waitFor(()=>expect(screen.getByLabelText('Establecimiento para operar')).toHaveValue(''));
 expect(screen.getByText('El establecimiento elegido ya no está disponible. Elegí otro establecimiento autorizado.')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Usar empresa y establecimiento',hidden:true})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Establecimiento para operar'),{target:{value:'site-a'}});
 expect(screen.getByRole('button',{name:'Usar empresa y establecimiento',hidden:true})).toBeEnabled();
 expect(mocks.get).not.toHaveBeenCalled();
});
test('removing the last selected establishment never silently expands to the whole company',async()=>{
 const extra={contextos:workspaceChoices(['GENERADOR'])};const state=setup(extra);await screen.findByLabelText('Calle legal');
 extra.contextos=[{...extra.contextos[0],establecimientos:[]}];await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeDisabled());
 fireEvent.click(screen.getByRole('button',{name:'Continuar sin establecimiento',hidden:true}));
 expect(screen.getByRole('button',{name:'Usar esta actividad',hidden:true})).toBeEnabled();expect(mocks.get).not.toHaveBeenCalled();
});
test.each(['actividadId','establecimientoId'])('a mismatched %s returned by profile validation does not save the requested context',async field=>{
 setup({contextos:workspaceChoices(['GENERADOR'])});await screen.findByLabelText('Calle legal');
 mocks.get.mockResolvedValue({data:{data:{user:{empresaContexto:{empresaId:'first',actividadId:'GENERADOR',establecimientoId:'site-a',[field]:'wrong'}}}}});
 fireEvent.click(screen.getByRole('button',{name:'Usar empresa y establecimiento',hidden:true}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar la actividad y el establecimiento elegidos. Volvé a intentarlo.');
 expect(sessionStorage.getItem('sitrep_company:person-qa')).toBeNull();expect(localStorage.getItem('sitrep_company:person-qa')).toBeNull();
});
test.each(['/empresas','/app/empresas'])('%s section selector preserves the draft and names the current company task',async entry=>{
 setup({actividades:[{id:'g',rol:'GENERADOR'}]},{entry,base:entry.startsWith('/app')?'/app':undefined});await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Sección de empresa'),{target:{value:'personas'}});
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'sections@qa.invalid'}});
 fireEvent.change(screen.getByLabelText('Sección de empresa'),{target:{value:'historial'}});
 expect(screen.getByRole('heading',{name:'Historial de la empresa'})).toBeVisible();
 expect(screen.getByLabelText('Sección de empresa')).toHaveValue('historial');
 fireEvent.change(screen.getByLabelText('Sección de empresa'),{target:{value:'personas'}});
 expect(screen.getByLabelText('Correo de la persona')).toHaveValue('sections@qa.invalid');
 expect(screen.getByRole('button',{name:'Personas autorizadas'})).toHaveAttribute('aria-current','page');
});
test.each(['personas','historial'])('losing management access while in %s falls back to company details instead of a blank workspace',async section=>{
 const extra={puedeGestionar:true};const state=setup(extra);await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:section==='personas'?'Personas autorizadas':'Historial'}));
 extra.puedeGestionar=false;await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(await screen.findByRole('heading',{name:'Domicilio legal'})).toBeVisible();
 expect(screen.getByLabelText('Sección de empresa')).toHaveValue('empresa');
 expect(screen.getByText('Tu acceso de gestión cambió. Podés consultar los datos disponibles de la empresa.')).toBeVisible();
 expect(screen.queryByLabelText('Correo de la persona')).toBeNull();
 expect(screen.queryByRole('button',{name:'Historial'})).toBeNull();
});

test.each(['','/app'])('history explains author, affected person, role and reason without rendering internal identifiers (%s)',async base=>{
 const events=[{id:'evt-private',usuarioId:'opaque-author',tipo:'PERSONA_AUTORIZADA',createdAt:'2026-10-27T12:00:00Z',datos:{motivo:'Revisión documentada',token:'never-render'},presentacion:{titulo:'Acceso autorizado',autor:'Lucía Administración',persona:'María Representante',actividad:'Operador',establecimiento:null}}];
 setup({eventos:events},{base,entry:base+'/empresas'});await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Sección de empresa'),{target:{value:'historial'}});
 expect(await screen.findByRole('heading',{name:'Historial de la empresa'})).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Acceso autorizado'})).toBeInTheDocument();
 expect(screen.getByText('Último cambio')).toBeInTheDocument();
 expect(screen.getByText('María Representante · Operador')).toBeInTheDocument();
 expect(screen.getByText('Registrado por: Lucía Administración')).toBeInTheDocument();
 expect(screen.getByText('Motivo: Revisión documentada')).toBeInTheDocument();
 expect(document.querySelector('time')).toHaveAttribute('datetime','2026-10-27T12:00:00.000Z');
 expect(screen.queryByText(/opaque-author|PERSONA_AUTORIZADA|never-render/)).not.toBeInTheDocument();
});
test('history supports older API responses, missing people and invalid dates without crashing or inventing identities',async()=>{
 setup({eventos:[{id:'old',usuarioId:'secret-id',tipo:'INTERNAL_NEW_TYPE',createdAt:'invalid',datos:{motivo:{nested:'private'}}}]});await screen.findByLabelText('Calle legal');
 fireEvent.click(screen.getByRole('button',{name:'Historial'}));
 expect(await screen.findByRole('heading',{name:'Cambio registrado'})).toBeInTheDocument();
 expect(screen.getByText('Registrado por: Nombre no disponible')).toBeInTheDocument();
 expect(screen.getByText('Fecha no disponible')).toBeInTheDocument();
 expect(screen.queryByText(/secret-id|INTERNAL_NEW_TYPE|private/)).not.toBeInTheDocument();
});
test('an actor without company management cannot open history even when an unexpected payload contains events',async()=>{
 setup({puedeGestionar:false,eventos:[{id:'private',presentacion:{titulo:'Private history'}}]});await screen.findByText(/^Legal first ·/);
 expect(screen.queryByRole('button',{name:'Historial'})).not.toBeInTheDocument();
 expect(screen.queryByRole('option',{name:'Historial'})).not.toBeInTheDocument();
 expect(screen.queryByText('Private history')).not.toBeInTheDocument();
});
test('empty history does not claim that fifty changes exist',async()=>{
 setup();await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Historial'}));
 expect(await screen.findByText('Sin cambios registrados.')).toBeInTheDocument();expect(screen.queryByText(/Últimos 50/)).not.toBeInTheDocument();
});

const eligibleFicha=(id:string)=>({id,razonSocial:'Ficha '+id,cuit:'30-71234567-1',activo:true,numeroInscripcion:'G-'+id});
test.each(['','/app'])('authority requires an explicit active same-CUIT record and never auto-submits the first (%s)',async base=>{
 mocks.generators.mockResolvedValue([eligibleFicha('active'),{...eligibleFicha('inactive'),activo:false},{...eligibleFicha('foreign'),cuit:'20123456786'}]);
 setup({puedeValidar:true},{base,entry:base+'/empresas'});await screen.findByLabelText('Ficha del mismo CUIT');
 await waitFor(()=>expect(screen.getByRole('option',{name:'Ficha active · G-active'})).toBeInTheDocument());
 expect(screen.getByLabelText('Ficha del mismo CUIT')).toHaveValue('');
 expect(screen.queryByRole('option',{name:/Ficha inactive|Ficha foreign/})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Ficha del mismo CUIT'),{target:{value:'active'}});
 expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeEnabled();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('catalog loading and failure are never described as no matching active record',async()=>{
 let reject:(e:Error)=>void=()=>{};mocks.generators.mockReturnValue(new Promise((_,r)=>{reject=r;}));
 setup({puedeValidar:true});await screen.findByText('Consultando fichas de Generador…');
 expect(screen.queryByText('No hay ficha activa coincidente')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 await act(async()=>reject(new Error('QA unavailable')));
 expect(await screen.findByText(/No pudimos consultar las fichas de Generador/)).toBeInTheDocument();
 expect(screen.queryByText('No hay fichas activas del mismo CUIT para Generador.')).not.toBeInTheDocument();
});
test.each(['','/app'])('failed catalog refresh preserves the selection but blocks linking until successful recovery (%s)',async base=>{
 mocks.generators.mockResolvedValue([eligibleFicha('a')]);const state=setup({puedeValidar:true},{base,entry:base+'/empresas'});
 await screen.findByRole('option',{name:'Ficha a · G-a'});fireEvent.change(screen.getByLabelText('Ficha del mismo CUIT'),{target:{value:'a'}});
 mocks.generators.mockRejectedValue(new Error('QA offline'));
 await act(async()=>{await state.client.invalidateQueries({queryKey:['company-role-catalogs']});});
 expect(await screen.findByText(/No pudimos consultar las fichas de Generador/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 expect(screen.getByLabelText('Ficha del mismo CUIT')).toHaveValue('a');
 fireEvent.submit(screen.getByRole('button',{name:'Vincular actividad existente'}).closest('form')!);
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
 mocks.generators.mockResolvedValue([eligibleFicha('a')]);fireEvent.click(screen.getByRole('button',{name:'Reintentar fichas'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeEnabled());
});
test.each(['missing','inactive'])('refresh that makes the chosen record %s never replaces it with another',async kind=>{
 mocks.generators.mockResolvedValue([eligibleFicha('a'),eligibleFicha('b')]);const state=setup({puedeValidar:true});
 await screen.findByRole('option',{name:'Ficha b · G-b'});fireEvent.change(screen.getByLabelText('Ficha del mismo CUIT'),{target:{value:'b'}});
 mocks.generators.mockResolvedValue([eligibleFicha('a'),...(kind==='inactive'?[{...eligibleFicha('b'),activo:false}]:[])]);
 await act(async()=>{await state.client.invalidateQueries({queryKey:['company-role-catalogs']});});
 await screen.findByText('La ficha elegida ya no está disponible para vincular. Elegí otra ficha activa del mismo CUIT.');
 expect(screen.getByLabelText('Ficha del mismo CUIT')).toHaveValue('');expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 fireEvent.submit(screen.getByRole('button',{name:'Vincular actividad existente'}).closest('form')!);
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('each activity reads its own catalog and a failing unrelated role cannot hide available generator records',async()=>{
 mocks.generators.mockResolvedValue([eligibleFicha('g')]);mocks.carriers.mockRejectedValue(new Error('QA transport unavailable'));
 setup({puedeValidar:true});await screen.findByRole('option',{name:'Ficha g · G-g'});
 expect(mocks.carriers).not.toHaveBeenCalled();expect(mocks.operators).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Ficha del mismo CUIT'),{target:{value:'g'}});
 fireEvent.change(screen.getByLabelText('Actividad a vincular'),{target:{value:'TRANSPORTISTA'}});
 await screen.findByText(/No pudimos consultar las fichas de Transportista/);expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Actividad a vincular'),{target:{value:'GENERADOR'}});
 await screen.findByRole('option',{name:'Ficha g · G-g'});expect(screen.getByLabelText('Ficha del mismo CUIT')).toHaveValue('');
});

test('background catalog verification blocks submit until the selected record is verified again',async()=>{
 mocks.generators.mockResolvedValue([eligibleFicha('a')]);const state=setup({puedeValidar:true});
 await screen.findByRole('option',{name:'Ficha a · G-a'});fireEvent.change(screen.getByLabelText('Ficha del mismo CUIT'),{target:{value:'a'}});
 let resolve:(value:unknown)=>void=()=>{};mocks.generators.mockReturnValue(new Promise(r=>{resolve=r;}));
 act(()=>{void state.client.invalidateQueries({queryKey:['company-role-catalogs']});});
 await screen.findByText('Consultando fichas de Generador…');
 expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeDisabled();
 fireEvent.submit(screen.getByRole('button',{name:'Vincular actividad existente'}).closest('form')!);
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
 await act(async()=>resolve([eligibleFicha('a')]));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Vincular actividad existente'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Vincular actividad existente'}));
 await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({url:'/empresas/first/actividades',method:'POST',data:{rol:'GENERADOR',actorId:'a'}})));
});

test.each(['','/app'])('legal form focuses a blank reason and preserves entered data (%s)',async base=>{
 setup({},{base,entry:base+'/empresas'});await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Calle a conservar'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'   '}});
 fireEvent.submit(screen.getByRole('button',{name:'Guardar datos legales'}).closest('form')!);
 await waitFor(()=>expect(screen.getByLabelText('Motivo del cambio legal')).toHaveFocus());
 expect(screen.getByLabelText('Motivo del cambio legal')).toHaveAttribute('aria-invalid','true');
 expect(screen.getByLabelText('Calle legal')).toHaveValue('Calle a conservar');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
 const street=screen.getByLabelText('Calle legal');street.focus();fireEvent.change(street,{target:{value:'Calle corregida'}});expect(street).toHaveFocus();
});
test('legal form rejects overlong data without truncating the draft',async()=>{
 setup();await screen.findByLabelText('Calle legal');const street='x'.repeat(301);
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:street}});fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Corrección documentada'}});
 fireEvent.submit(screen.getByRole('button',{name:'Guardar datos legales'}).closest('form')!);
 await waitFor(()=>expect(screen.getByLabelText('Calle legal')).toHaveFocus());
 expect(screen.getByLabelText('Calle legal')).toHaveValue(street);expect(screen.getByText('Usá hasta 300 caracteres.')).toBeInTheDocument();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test.each(['','/app'])('new company rejects an invalid check digit before sending (%s)',async base=>{
 setup({},{admin:true,base,entry:base+'/empresas'});await screen.findByRole('button',{name:'Guardar datos legales'});
 fireEvent.click(screen.getByText('Registrar empresa',{selector:'summary'}));
 const form=screen.getByRole('button',{name:'Registrar empresa',hidden:true}).closest('form')!;
 fireEvent.change(within(form).getByLabelText('CUIT de empresa'),{target:{value:'30-71234567-2'}});
 fireEvent.change(within(form).getByLabelText('Razón social'),{target:{value:'QA entidad'}});
 fireEvent.submit(form);await waitFor(()=>expect(within(form).getByLabelText('CUIT de empresa')).toHaveFocus());
 expect(within(form).getByLabelText('CUIT de empresa')).toHaveAttribute('aria-invalid','true');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test.each(['nombre','certificados'])('establishment reports invalid %s at the field without losing its code',async field=>{
 setup();await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Establecimientos'}));
 fireEvent.change(screen.getByLabelText('Código de establecimiento'),{target:{value:'QA-CODE'}});
 fireEvent.change(screen.getByLabelText('Nombre de establecimiento'),{target:{value:field==='nombre'?'   ':'QA Sede'}});
 if(field==='certificados')fireEvent.change(screen.getByLabelText('Certificados del establecimiento'),{target:{value:'x'.repeat(101)}});
 fireEvent.submit(screen.getByRole('button',{name:'Agregar establecimiento'}).closest('form')!);
 const input=screen.getByLabelText(field==='nombre'?'Nombre de establecimiento':'Certificados del establecimiento');
 await waitFor(()=>expect(input).toHaveFocus());expect(input).toHaveAttribute('aria-invalid','true');
 expect(screen.getByLabelText('Código de establecimiento')).toHaveValue('QA-CODE');expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test.each(['','/app'])('invitation button validates malformed email and does not start an uncertain operation (%s)',async base=>{
 setup({actividades:[{id:'g',rol:'GENERADOR'}]},{base,entry:base+'/empresas'});await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'sin-arroba'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));
 await waitFor(()=>expect(screen.getByLabelText('Correo de la persona')).toHaveFocus());
 expect(screen.getByLabelText('Correo de la persona')).toHaveAttribute('aria-invalid','true');
 expect(screen.queryByRole('button',{name:'Comprobar preparación'})).not.toBeInTheDocument();
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});
test('responsible validation refuses whitespace reason without changing the selected activity draft',async()=>{
 setup({puedeValidar:true});await screen.findByLabelText('Correo del responsable');
 fireEvent.change(screen.getByLabelText('Correo del responsable'),{target:{value:'qa@night-qa.invalid'}});
 fireEvent.change(screen.getByLabelText('Motivo de validación'),{target:{value:'  '}});
 fireEvent.submit(screen.getByRole('button',{name:'Validar responsable'}).closest('form')!);
 await waitFor(()=>expect(screen.getByLabelText('Motivo de validación')).toHaveFocus());
 expect(screen.getByLabelText('Correo del responsable')).toHaveValue('qa@night-qa.invalid');
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});

test('correcting a legal field clears its inline error and submits the preserved values once',async()=>{
 setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'   '}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Corregir denominación'}});
 fireEvent.submit(screen.getByRole('button',{name:'Guardar datos legales'}).closest('form')!);
 await waitFor(()=>expect(screen.getByLabelText('Razón social')).toHaveFocus());
 fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Alfa corregida'}});
 expect(screen.getByLabelText('Razón social')).not.toHaveAttribute('aria-invalid','true');
 fireEvent.submit(screen.getByRole('button',{name:'Guardar datos legales'}).closest('form')!);
 await waitFor(()=>expect(mocks.request.mock.calls.filter(([r])=>r.method==='PUT')).toHaveLength(1));
 expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({method:'PUT',data:expect.objectContaining({razonSocial:'Alfa corregida',motivo:'Corregir denominación'})}));
});
test('empty establishment selection explains the blocked authorization',async()=>{
 setup({actividades:[{id:'g',rol:'GENERADOR'}],establecimientos:[{id:'s',nombre:'Sede QA',activo:true}]});await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.click(screen.getByLabelText('Todos los establecimientos'));
 expect(screen.getByText('Elegí al menos un establecimiento o activá Todos los establecimientos.')).toBeVisible();
 expect(screen.getByRole('button',{name:'Autorizar cuenta verificada'})).toBeDisabled();
 fireEvent.submit(screen.getByRole('button',{name:'Autorizar cuenta verificada'}).closest('form')!);
 expect(mocks.request.mock.calls.filter(([r])=>r.method!=='GET')).toHaveLength(0);
});

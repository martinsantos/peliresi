import { beforeEach,afterEach,expect,test,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup,act,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EmpresasPage from './EmpresasPage';
const mocks=vi.hoisted(()=>({request:vi.fn(),user:{id:'person-qa',rol:'GENERADOR',actorId:'generator-qa'} as {id:string;rol:string;actorId:string;empresaContexto?:any}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:mocks.user})}));
vi.mock('../../services/api',()=>({api:{request:mocks.request}}));
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllEnvs();mocks.request.mockReset();mocks.user={id:'person-qa',rol:'GENERADOR',actorId:'generator-qa'};});
const company=(id:string,razonSocial:string)=>({id,cuit:'30712345671',razonSocial,revision:0,domicilioLegal:{calle:'Legal '+id,localidad:'Mendoza',departamento:'Capital'}});
function setup(extra:Record<string,unknown>={}, listOptions:{single?:boolean;admin?:boolean}={}){
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
 const view=()=> <QueryClientProvider client={client}><MemoryRouter><EmpresasPage/></MemoryRouter></QueryClientProvider>;
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

test('a prepared link only remains visible for its current person and role while it is usable',async()=>{
 const details={actividades:[{id:'g',rol:'GENERADOR'},{id:'o',rol:'OPERADOR'}],invitaciones:[] as Array<{id:string;email:string;actividadId:string;venceAt:string;revocadaAt?:string}>};
 setup(details);const original=mocks.request.getMockImplementation()!;
 mocks.request.mockImplementation(async request=>{
  if(request.method==='POST'&&request.url.endsWith('/invitaciones')){
   details.invitaciones=[{id:'new',email:request.data.email,actividadId:request.data.actividadId,venceAt:new Date(Date.now()+86400000).toISOString()}];
   return {data:{data:{invitacion:{id:'new'},ruta:'/empresa-invitacion/qa-token'}}};
  }
  if(request.method==='POST'&&request.url.endsWith('/invitaciones/new/revocar')){
   details.invitaciones=details.invitaciones.map(i=>({...i,revocadaAt:new Date().toISOString()}));return {data:{data:{revocada:true}}};
  }
  return original(request);
 });
 await screen.findByLabelText('Calle legal');fireEvent.click(screen.getByRole('button',{name:'Personas autorizadas'}));
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'two@qa.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar invitación'}));
 expect(await screen.findByLabelText('Enlace de invitación')).toHaveValue(window.location.origin+'/empresa-invitacion/qa-token');
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'o'}});expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Rol en esta empresa'),{target:{value:'g'}});expect(screen.getByLabelText('Enlace de invitación')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Correo de la persona'),{target:{value:'another@qa.invalid'}});expect(screen.queryByLabelText('Enlace de invitación')).not.toBeInTheDocument();
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

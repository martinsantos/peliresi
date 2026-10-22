import { afterEach,expect,test,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup,act,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EmpresasPage from './EmpresasPage';
const mocks=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'person-qa',rol:'GENERADOR'}})}));
vi.mock('../../services/api',()=>({api:{request:mocks.request}}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();mocks.request.mockReset();});
const company=(id:string,razonSocial:string)=>({id,cuit:'30712345671',razonSocial,revision:0,domicilioLegal:{calle:'Legal '+id,localidad:'Mendoza',departamento:'Capital'}});
function setup(extra:Record<string,unknown>={}){
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const first=company('first','Alfa'),other=company('other','Beta');let changed=false,failSearch=false;
 mocks.request.mockImplementation(async({url,method,data})=>{
  if(method==='PUT'){changed=true;return {data:{data:{empresa:{...first,...data,revision:1}}}};}
  if(url.startsWith('/empresas?')){
   const params=new URLSearchParams(url.split('?')[1]);
   if(failSearch&&params.get('search'))throw new Error('QA network unavailable');
   const companies=params.get('search')||params.get('page')==='2'?[]:changed?[other,{...first,razonSocial:'Zeta',revision:1}]:[first,other];
   return {data:{data:{empresas:companies,pagination:{page:Number(params.get('page')),limit:25,total:companies.length,totalPages:1},puedeValidar:false}}};
  }
  const c=url.endsWith('/first')?{...first,...(changed?{razonSocial:'Zeta',revision:1}:{})}:other;
  return {data:{data:{empresa:c,contextos:[],actividades:[],establecimientos:[],autorizaciones:[],responsables:[],eventos:[],invitaciones:[],personas:[],puedeGestionar:true,puedeValidar:false,...extra}}};
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={client}><MemoryRouter><EmpresasPage/></MemoryRouter></QueryClientProvider>);
 return {client,externalChange:()=>{changed=true;},failSearch:()=>{failSearch=true;}};
}
test('a background company notice preserves dirty values and requires reconciliation before saving the current revision',async()=>{
 const state=setup();await screen.findByLabelText('Calle legal');
 fireEvent.change(screen.getByLabelText('Calle legal'),{target:{value:'Mi domicilio pendiente'}});
 fireEvent.change(screen.getByLabelText('Motivo del cambio legal'),{target:{value:'Evidencia local'}});
 state.externalChange();await act(async()=>{await state.client.invalidateQueries({queryKey:['empresa']});});
 expect(await screen.findByText('Otra persona actualizó estos datos')).toBeVisible();
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
 expect(screen.queryByText('Otra persona actualizó estos datos')).not.toBeInTheDocument();
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

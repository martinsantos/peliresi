import { afterEach,expect,test,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EmpresasPage from './EmpresasPage';
const mocks=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'person-qa',rol:'GENERADOR'}})}));
vi.mock('../../services/api',()=>({api:{request:mocks.request}}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();mocks.request.mockReset();});
const company=(id:string,razonSocial:string)=>({id,cuit:'30712345671',razonSocial,revision:0,domicilioLegal:{calle:'Legal '+id,localidad:'Mendoza',departamento:'Capital'}});
function setup(){
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
  return {data:{data:{empresa:c,contextos:[],actividades:[],establecimientos:[],autorizaciones:[],responsables:[],eventos:[],invitaciones:[],personas:[],puedeGestionar:true,puedeValidar:false}}};
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={client}><MemoryRouter><EmpresasPage/></MemoryRouter></QueryClientProvider>);
 return {failSearch:()=>{failSearch=true;}};
}
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

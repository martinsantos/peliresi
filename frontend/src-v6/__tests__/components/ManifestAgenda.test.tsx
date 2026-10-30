import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'cap-user',rol:'OPERADOR',training:true}})}));
import {ManifestAgenda} from '../../pages/manifiestos/components/ManifestAgenda';
afterEach(()=>{cleanup();vi.clearAllMocks();sessionStorage.clear();});
it('reaches scheduled records beyond the first 50 and resets to page one when searching',async()=>{
 mock.get.mockImplementation((_url,{params})=>Promise.resolve({data:{data:{total:params.search?1:51,items:[{id:params.search?'found':String(params.page),numero:params.search||`CAP-PAGE-${params.page}`,fechaEstimadaRetiro:'2026-10-20T12:00:00Z'}]}}}));
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ManifestAgenda/></QueryClientProvider></MemoryRouter>);
 await screen.findByText(/CAP-PAGE-1/);expect(screen.getByRole('button',{name:'Anterior'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));await screen.findByText(/CAP-PAGE-2/);expect(screen.getByRole('button',{name:'Siguiente'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Buscar manifiesto programado'),{target:{value:'CAP-NEW'}});await screen.findByText(/CAP-NEW/);
 await waitFor(()=>expect(mock.get).toHaveBeenLastCalledWith('/manifiestos/agenda-partes',{params:{page:1,search:'CAP-NEW',incluirPendientes:'true'}}));
 expect(screen.getByRole('link',{name:/CAP-NEW/})).toHaveAttribute('href','/manifiestos/found');
});

it('shows route participants without fetching a second record and keeps app links',async()=>{
 mock.get.mockResolvedValue({data:{data:{total:1,items:[{id:'scheduled',numero:'QA-RUTA',fechaEstimadaRetiro:'2099-10-20T12:00:00Z',generador:{razonSocial:'Origen artificial'},operador:{razonSocial:'Destino artificial'}}]}}});
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter basename="/app" initialEntries={['/app/manifiestos?vista=programados']}><QueryClientProvider client={q}><ManifestAgenda/></QueryClientProvider></MemoryRouter>);
 const link=await screen.findByRole('link',{name:/QA-RUTA/});
 expect(link).toHaveTextContent('Origen artificial → Destino artificial');expect(link).toHaveAttribute('href','/app/manifiestos/scheduled');
 expect(mock.get).toHaveBeenCalledTimes(1);q.clear();
});

it('drops another context’s agenda filters before fetching',async()=>{
 mock.get.mockResolvedValue({data:{data:{total:0,items:[]}}});
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter initialEntries={[{pathname:'/manifiestos',search:'?vista=programados&programado=OTHER&paginaProgramados=8',state:{filterOwners:{'manifest-agenda':'other-context'}}}]}><QueryClientProvider client={q}><ManifestAgenda/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('Sin manifiestos programados para esta búsqueda.');
 expect(mock.get).toHaveBeenCalledWith('/manifiestos/agenda-partes',{params:{page:1,search:'',incluirPendientes:'true'}});
 expect(screen.getByLabelText('Buscar manifiesto programado')).toHaveValue('');q.clear();
});

it('distinguishes scheduled review, coordination and an unknown status',async()=>{
 mock.get.mockResolvedValue({data:{data:{total:3,items:[
  {id:'bad',numero:'QA-REVISION',fechaEstimadaRetiro:'2099-10-20',aprobacionOperacion:'INCONSISTENTE'},
  {id:'ready',numero:'QA-COORDINAR',fechaEstimadaRetiro:'2099-10-20',aprobacionOperacion:'FALTA_COORDINACION'},
  {id:'unknown',numero:'QA-UNKNOWN',fechaEstimadaRetiro:'2099-10-20'},
 ]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><ManifestAgenda/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByRole('link',{name:/QA-REVISION/})).toHaveTextContent('Propuesta por revisar');
 expect(screen.getByRole('link',{name:/QA-COORDINAR/})).toHaveTextContent('Listo para coordinar');
 expect(screen.getByRole('link',{name:/QA-UNKNOWN/})).toHaveTextContent('Estado por verificar');
 client.clear();
});

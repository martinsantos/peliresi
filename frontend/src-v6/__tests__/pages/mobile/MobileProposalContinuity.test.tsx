import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const mock=vi.hoisted(()=>({offline:false,navigate:vi.fn()}));
vi.mock('react-router-dom',async original=>({...await original<typeof import('react-router-dom')>(),useNavigate:()=>mock.navigate}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa-driver',rol:'TRANSPORTISTA',actorId:'qa-carrier',training:false}})}));
vi.mock('../../../hooks/useDashboard',()=>({useDashboardStats:()=>({data:{estadisticas:{total:2,enTransito:2}}})}));
vi.mock('../../../hooks/useConnectivity',()=>({useConnectivity:()=>({isOnline:!mock.offline,isApiReachable:!mock.offline})}));
vi.mock('../../../services/api',()=>({api:{get:vi.fn(async()=>({data:{data:{items:[],total:0,limited:false}}}))}}));
vi.mock('../../../hooks/useManifiestos',()=>({useManifiestos:(filters?:{estado:string})=>({isLoading:false,isError:mock.offline,data:mock.offline?undefined:{items:filters?.estado==='EN_TRANSITO'?[{id:'one',numero:'QA-TRIP-1'},{id:'two',numero:'QA-TRIP-2'}]:filters?.estado==='APROBADO'?[{id:'approved',numero:'QA-COORDINATION-PENDING'}]:[]}})}));
import {MobileDashboardPage} from '../../../pages/mobile/MobileDashboardPage';
const clients:QueryClient[]=[];
beforeEach(()=>{mock.offline=false;mock.navigate.mockClear();localStorage.clear();vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');vi.stubEnv('VITE_TRANSPORT_MULTI_GPS_ENABLED','true');});
afterEach(()=>{cleanup();clients.forEach(client=>client.clear());clients.length=0;localStorage.clear();vi.unstubAllEnvs();});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<MemoryRouter><QueryClientProvider client={client}><MobileDashboardPage/></QueryClientProvider></MemoryRouter>);}
it('keeps the existing multiple-trip queue beside the new operational proposal agenda',()=>{
 mount();expect(screen.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
 const trips=screen.getByRole('region',{name:'Viajes del transportista'});
 expect(within(trips).getByRole('button',{name:'Ir al viaje QA-TRIP-1'})).toBeVisible();
 fireEvent.click(within(trips).getByRole('button',{name:'Ir al viaje QA-TRIP-2'}));expect(mock.navigate).toHaveBeenCalledWith('/transporte/viaje/two');
 expect(screen.getByRole('button',{name:'Cargas en este móvil'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'Abrir viaje asignado QA-COORDINATION-PENDING'})).toBeNull();
});
it('retains the saved-trip fallback during an outage with proposals enabled',()=>{
 mock.offline=true;localStorage.setItem('sitrep_active_trip_id','saved');localStorage.setItem('viaje_snapshot_saved',JSON.stringify({estado:'EN_TRANSITO',numero:'QA-SAVED'}));
 mount();expect(screen.getByText(/Se muestra sólo el último viaje guardado/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Ir al viaje QA-SAVED'}));expect(mock.navigate).toHaveBeenCalledWith('/transporte/viaje/saved');
});

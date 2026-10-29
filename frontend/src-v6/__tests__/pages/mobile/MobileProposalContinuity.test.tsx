import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const mock=vi.hoisted(()=>({offline:false,accessDenied:false,fetching:false,fetched:true,navigate:vi.fn(),company:null as any}));
vi.mock('react-router-dom',async original=>({...await original<typeof import('react-router-dom')>(),useNavigate:()=>mock.navigate}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa-driver',rol:'TRANSPORTISTA',actorId:'qa-carrier',training:false,empresaContexto:mock.company}})}));
vi.mock('../../../hooks/useDashboard',()=>({useDashboardStats:()=>({data:{estadisticas:{total:2,enTransito:2}}})}));
vi.mock('../../../hooks/useConnectivity',()=>({useConnectivity:()=>({isOnline:!mock.offline,isApiReachable:!mock.offline})}));
vi.mock('../../../services/api',()=>({api:{get:vi.fn(async()=>({data:{data:{items:[],total:0,limited:false}}}))}}));
vi.mock('../../../hooks/useManifiestos',()=>({useManifiestos:(filters?:{estado:string})=>({isLoading:false,isFetching:mock.fetching,isFetchedAfterMount:mock.fetched,isError:mock.offline||mock.accessDenied,error:mock.accessDenied?{response:{status:403}}:null,data:mock.offline||mock.accessDenied?undefined:{items:filters?.estado==='EN_TRANSITO'?[{id:'one',numero:'QA-TRIP-1'},{id:'two',numero:'QA-TRIP-2'}]:filters?.estado==='APROBADO'?[{id:'approved',numero:'QA-COORDINATION-PENDING'}]:[]}})}));
import {MobileDashboardPage} from '../../../pages/mobile/MobileDashboardPage';
import {inspectionWorkspaceOwner} from '../../../utils/inspectionWorkspace';
import {writeTripSnapshot} from '../../../services/tripSnapshot';
const clients:QueryClient[]=[];
beforeEach(()=>{mock.offline=false;mock.accessDenied=false;mock.fetching=false;mock.fetched=true;mock.company=null;mock.navigate.mockClear();localStorage.clear();vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');vi.stubEnv('VITE_TRANSPORT_MULTI_GPS_ENABLED','true');});
afterEach(()=>{cleanup();clients.forEach(client=>client.clear());clients.length=0;localStorage.clear();vi.unstubAllEnvs();});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<MemoryRouter><QueryClientProvider client={client}><MobileDashboardPage/></QueryClientProvider></MemoryRouter>);}
it('has one pending-work list and explicit access to multi-trip GPS without duplicate manifests',()=>{
 mount();expect(screen.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
 expect(screen.queryByRole('region',{name:'Viajes del transportista'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'GPS de mis viajes'}));expect(mock.navigate).toHaveBeenCalledWith('/transporte/cargas');
 fireEvent.click(screen.getByRole('button',{name:'Viajes',exact:true}));expect(mock.navigate).toHaveBeenCalledWith('/transporte/perfil');
 expect(screen.queryByText('Actividad Reciente')).toBeNull();
 expect(screen.queryByRole('button',{name:'Abrir viaje asignado QA-COORDINATION-PENDING'})).toBeNull();
});
it('retains the saved-trip fallback during an outage with proposals enabled',()=>{
 mock.offline=true;const owner=inspectionWorkspaceOwner({id:'qa-driver',rol:'TRANSPORTISTA',actorId:'qa-carrier',training:false});
 writeTripSnapshot(owner,'saved',{id:'saved',estado:'EN_TRANSITO',numero:'QA-SAVED'});
 mount();expect(screen.getByText(/Se muestra sólo el último viaje guardado/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Ir al viaje QA-SAVED'}));expect(mock.navigate).toHaveBeenCalledWith('/transporte/viaje/saved');
});
it('does not show another company’s saved trip during an outage',()=>{
 mock.offline=true;
 const companyA={empresaId:'a',actividadId:'transport-a',rol:'TRANSPORTISTA',actorId:'qa-carrier',autorizacionId:'grant-a',revision:1,todasSedes:true,razonSocial:'QA A',domicilioLegal:{calle:'',localidad:'',departamento:''}};
 const ownerA=inspectionWorkspaceOwner({id:'qa-driver',rol:'TRANSPORTISTA',actorId:'qa-carrier',training:false,empresaContexto:companyA});
 writeTripSnapshot(ownerA,'saved',{id:'saved',estado:'EN_TRANSITO',numero:'QA-OTHER-COMPANY'});
 mock.company={...companyA,empresaId:'b',actividadId:'transport-b',autorizacionId:'grant-b'};
 mount();expect(screen.queryByText('QA-OTHER-COMPANY')).toBeNull();
});
it('does not show a saved trip after the server denies access',()=>{
 const owner=inspectionWorkspaceOwner({id:'qa-driver',rol:'TRANSPORTISTA',actorId:'qa-carrier',training:false});
 writeTripSnapshot(owner,'saved',{id:'saved',estado:'EN_TRANSITO',numero:'QA-DENIED'});mock.accessDenied=true;
 mount();expect(screen.queryByText('QA-DENIED')).toBeNull();
});
it('does not show cached trip rows while checking access on the first online fetch',()=>{
 mock.fetching=true;mock.fetched=false;vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');
 mount();expect(screen.queryByText('QA-TRIP-1')).toBeNull();expect(screen.queryByText('QA-TRIP-2')).toBeNull();
});

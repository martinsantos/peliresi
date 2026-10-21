import {fireEvent,render,screen,cleanup,within,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn(),training:true,rol:'OPERADOR',create:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'u',training:mock.training,rol:mock.rol}})}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{create:mock.create}}));
import {useCreateManifiesto} from '../../hooks/useManifiestoWorkflow';
import {TrainingTaskQueue} from '../../components/TrainingTaskQueue';
afterEach(()=>{vi.unstubAllEnvs();cleanup();mock.training=true;mock.rol='OPERADOR';vi.clearAllMocks();vi.useRealTimers();});
const partes=[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:true},{rol:'OPERADOR',aprobada:true}];
const items=[{id:'a',numero:'CAP-NEW',estado:'PENDIENTE_APROBACION',requiereMiAprobacion:true,partes,fechaEstimadaRetiro:'2099-10-20T12:00:00Z'},{id:'b',numero:'CAP-TRIP',estado:'EN_TRANSITO',partes:partes.map(p=>({...p,aprobada:true})),fechaEstimadaRetiro:'2020-10-20T12:00:00Z'}];
function mount(){mock.get.mockResolvedValue({data:{data:{items,total:2,limited:false}}});render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);}
it('filters current work, preserves approval states and links to the exact manifest',async()=>{
 mount();await screen.findByText('CAP-NEW');
 const row=screen.getByRole('link',{name:/CAP-NEW/});expect(row).toHaveAttribute('href','/manifiestos/a');expect(within(row).getByLabelText('Generador: Pendiente')).toBeVisible();expect(within(row).getByLabelText('Transporte: Aprobado')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Por aprobar'}));expect(screen.queryByText('CAP-TRIP')).not.toBeInTheDocument();expect(row).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'En curso'}));expect(screen.queryByText('CAP-NEW')).not.toBeInTheDocument();expect(screen.getByText('CAP-TRIP')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Todos'}));fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'future'}});expect(screen.queryByText('CAP-TRIP')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Buscar manifiesto en agenda'),{target:{value:'missing'}});expect(screen.getByRole('status')).toHaveTextContent('Sin manifiestos');
});
it('is not enabled in operational sessions',()=>{mock.training=false;mount();expect(mock.get).not.toHaveBeenCalled();expect(screen.queryByLabelText('Agenda de manifiestos')).not.toBeInTheDocument();});
it('shows an operations agenda for the CAP administrator',async()=>{mock.rol='ADMIN';mount();expect(await screen.findByText('Agenda de operaciones')).toBeVisible();expect(await screen.findByText('CAP-TRIP')).toBeVisible();});

it('keeps Hoy and Próximos on the Mendoza date when UTC is already the following day',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T01:30:00Z'));
 const records=[
  {...items[1],id:'today',numero:'CAP-HOY',fechaEstimadaRetiro:'2026-10-19T15:00:00Z'},
  {...items[1],id:'utc-next',numero:'CAP-TARDE',fechaEstimadaRetiro:'2026-10-20T01:00:00Z'},
  {...items[1],id:'future',numero:'CAP-MANANA',fechaEstimadaRetiro:'2026-10-20T15:00:00Z'},
 ];
 mock.get.mockResolvedValue({data:{data:{items:records,total:records.length,limited:false}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('CAP-HOY');fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'today'}});
 expect(screen.getByText('CAP-HOY')).toBeVisible();expect(screen.getByText('CAP-TARDE')).toBeVisible();expect(screen.queryByText('CAP-MANANA')).toBeNull();
 fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'future'}});expect(screen.getByText('CAP-MANANA')).toBeVisible();expect(screen.queryByText('CAP-HOY')).toBeNull();expect(screen.queryByText('CAP-TARDE')).toBeNull();client.clear();
});

it('shows an update error instead of a false empty agenda and recovers on retry',async()=>{
 mock.get.mockRejectedValueOnce(new Error('Synthetic connection failure'));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos actualizar la agenda');expect(screen.queryByText('Sin manifiestos para estos filtros.')).toBeNull();
 mock.get.mockResolvedValue({data:{data:{items,total:2,limited:false}}});fireEvent.click(screen.getByRole('button',{name:'Reintentar',exact:true}));await screen.findByText('CAP-NEW');expect(screen.queryByRole('alert')).toBeNull();client.clear();
});

function Creation(){const mutation=useCreateManifiesto();return <button onClick={()=>mutation.mutate({} as any)}>Crear propuesta de prueba</button>;}
it.each(['OPERADOR','GENERADOR','TRANSPORTISTA','ADMIN'])('shows a newly created waiting proposal first without waiting for polling: %s',async(role)=>{
 mock.rol=role;
 let records=Array.from({length:8},(_,i)=>({...items[1],id:'old-'+i,numero:'CAP-OLD-'+i,fechaEstimadaRetiro:new Date().toISOString()}));
 mock.get.mockImplementation(()=>Promise.resolve({data:{data:{items:records,total:records.length,limited:false}}}));
 mock.create.mockImplementation(async()=>{records=[{...items[0],id:'latest',numero:'CAP-LATEST',requiereMiAprobacion:false,fechaEstimadaRetiro:'2099-12-25T12:00:00Z'},...records];return {id:'latest'};});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><Creation/><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('CAP-OLD-0');expect(screen.queryByText('CAP-OLD-7')).not.toBeInTheDocument();
 const oldRow=screen.getByRole('link',{name:/CAP-OLD-0/});
 fireEvent.click(screen.getByRole('button',{name:'Crear propuesta de prueba'}));
 await waitFor(()=>expect(screen.getAllByRole('link')[0]).toHaveTextContent('CAP-LATEST'),{timeout:1000});
 expect(within(screen.getAllByRole('link')[0]).getByText('En espera')).toBeVisible();
 expect(screen.getByRole('link',{name:/CAP-OLD-0/})).toBe(oldRow);
 fireEvent.click(screen.getByRole('button',{name:'En espera',exact:true}));expect(screen.getByRole('link',{name:/CAP-LATEST/})).toBeVisible();expect(screen.queryByText('CAP-OLD-0')).not.toBeInTheDocument();
 client.clear();
});

it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('offers the live operational agenda only when its flag is enabled: %s',async role=>{
 mock.training=false;mock.rol=role;vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');mount();
 await screen.findByText('CAP-NEW');expect(screen.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
 expect(mock.get).toHaveBeenCalledWith('/manifiestos/tareas-partes');
});

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
afterEach(()=>{cleanup();mock.training=true;mock.rol='OPERADOR';vi.clearAllMocks();});
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

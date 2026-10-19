import {fireEvent,render,screen,cleanup,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn(),training:true,rol:'OPERADOR'}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'u',training:mock.training,rol:mock.rol}})}));
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

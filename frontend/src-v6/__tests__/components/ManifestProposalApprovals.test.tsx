import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor,act} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const mock=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'transport-user',rol:'TRANSPORTISTA',actorId:'transport',training:false}})}));
import {ManifestProposalApprovals} from '../../pages/manifiestos/components/ManifestProposalApprovals';
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.clearAllMocks();});
it('refreshes the parent when another party starts coordination without changing APROBADO',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 const data={autorRol:'GENERADOR',estado:'APROBADO',inicio:null as string|null,puedeIniciar:true,puedeAprobar:null,partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:true}))};
 mock.get.mockImplementation(async()=>({data:{data:{...data}}}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),invalidate=vi.spyOn(client,'invalidateQueries');
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="proposal" estado="APROBADO" onSign={()=>{}}/></QueryClientProvider>);
 await screen.findByText('Todo aprobado');await waitFor(()=>expect(invalidate).toHaveBeenCalledWith({queryKey:['manifiestos','detail','proposal']}));invalidate.mockClear();
 data.inicio=new Date().toISOString();data.puedeIniciar=false;
 await act(async()=>{await client.invalidateQueries({queryKey:['manifest-proposal']});});
 await screen.findByText('Coordinación iniciada');expect(invalidate).toHaveBeenCalledWith({queryKey:['manifiestos','detail','proposal']});
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).toBeNull();client.clear();
});
it('does not query proposals or offer party decisions when the operational flag is closed',()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');
 const client=new QueryClient();render(<QueryClientProvider client={client}><ManifestProposalApprovals id="proposal" estado="APROBADO" onSign={()=>{}}/></QueryClientProvider>);
 expect(mock.get).not.toHaveBeenCalled();expect(screen.queryByRole('region')).toBeNull();client.clear();
});
it('does not present approval or a start action from status alone when a party is still pending',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:true,puedeAprobar:null,partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="inconsistent" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('2 de 3 aprobaciones')).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent('No constan todas las aprobaciones');
 expect(screen.queryByText('Todo aprobado')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Transporte: Pendiente')).toHaveClass('text-neutral-600');
 client.clear();
});
it('shows only generator and operator for in-situ, with no transport approval or GPS step',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{modalidad:'IN_SITU',autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:false,puedeAprobar:null,partes:[{rol:'GENERADOR',aprobada:true},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="in-situ" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('2 de 2 · Aprobado')).toBeVisible();
 expect(screen.getByLabelText('Generador: Aprobado')).toBeVisible();
 expect(screen.getByLabelText('Operador: Aprobado')).toBeVisible();
 expect(screen.queryByLabelText(/^Transporte:/)).not.toBeInTheDocument();
 expect(screen.getByText('El operador confirma la recepción en origen. No hay viaje ni GPS.')).toBeVisible();
 client.clear();
});

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

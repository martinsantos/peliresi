import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import ImpersonationContext from '../../contexts/ImpersonationContext';
import {CompanyAccessLink} from '../../components/CompanyAccessLink';
const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa',rol:'GENERADOR'},isRestricted:false})}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();mock.get.mockReset();});
function mount(temporary=false){
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><ImpersonationContext.Provider value={{impersonationData:temporary?{}:null} as never}><CompanyAccessLink/></ImpersonationContext.Provider></MemoryRouter></QueryClientProvider>);
}
it('does not request or show companies in temporary view',()=>{
 mount(true);expect(mock.get).not.toHaveBeenCalled();expect(screen.queryByRole('link')).toBeNull();
});
it('hides the empty directory without hiding an existing responsible-only company',async()=>{
 mock.get.mockResolvedValue({data:{data:{pagination:{total:0},puedeValidar:false}}});mount();
 await waitFor(()=>expect(mock.get).toHaveBeenCalled());expect(screen.queryByRole('link')).toBeNull();
 cleanup();mock.get.mockResolvedValue({data:{data:{pagination:{total:1},puedeValidar:false}}});mount();
 expect(await screen.findByRole('link',{name:'Empresas y establecimientos'})).toHaveAttribute('href','/empresas');
});
it('offers retry on connection failure without claiming an empty directory',async()=>{
 mock.get.mockRejectedValue(new Error('QA connection'));mount();
 expect(await screen.findByRole('button',{name:'Reintentar consulta'})).toBeVisible();
 expect(screen.queryByRole('link')).toBeNull();
});

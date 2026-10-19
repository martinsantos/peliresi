import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'cap-user',training:true}})}));
import {ManifestAgenda} from '../../pages/manifiestos/components/ManifestAgenda';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('reaches scheduled records beyond the first 50 and resets to page one when searching',async()=>{
 mock.get.mockImplementation((_url,{params})=>Promise.resolve({data:{data:{total:params.search?1:51,items:[{id:params.search?'found':String(params.page),numero:params.search||`CAP-PAGE-${params.page}`,fechaEstimadaRetiro:'2026-10-20T12:00:00Z'}]}}}));
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ManifestAgenda/></QueryClientProvider></MemoryRouter>);
 fireEvent.click(await screen.findByText(/Ver manifiestos programados/));await screen.findByText(/CAP-PAGE-1/);expect(screen.getByRole('button',{name:'Anterior'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));await screen.findByText(/CAP-PAGE-2/);expect(screen.getByRole('button',{name:'Siguiente'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Buscar manifiesto programado'),{target:{value:'CAP-NEW'}});await screen.findByText(/CAP-NEW/);
 await waitFor(()=>expect(mock.get).toHaveBeenLastCalledWith('/manifiestos/agenda-partes',{params:{page:1,search:'CAP-NEW'}}));
 expect(screen.getByRole('link',{name:/CAP-NEW/})).toHaveAttribute('href','/manifiestos/found');
});

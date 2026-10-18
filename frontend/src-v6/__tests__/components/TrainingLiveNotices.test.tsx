import {act,fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({list:vi.fn(),mark:vi.fn()}));
vi.mock('../../services/notificacion.service',()=>({notificacionService:{list:mocks.list,marcarLeida:mocks.mark}}));
import {TrainingLiveNotices} from '../../components/TrainingLiveNotices';
const notice=(id:string,author='other')=>({id,titulo:'Te toca aprobar '+id,mensaje:'CAP-TEST. Abrí para decidir.',leida:false,tipo:'INFO_GENERAL',datos:JSON.stringify({autorId:author,url:'/manifiestos/test'}),manifiestoId:'test',createdAt:new Date().toISOString()});
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();mocks.mark.mockResolvedValue(undefined);});afterEach(cleanup);
function mount(userId='u'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=render(<MemoryRouter><QueryClientProvider client={client}><TrainingLiveNotices userId={userId}/></QueryClientProvider></MemoryRouter>);return {...view,client};
}
describe('CAP foreground notice delivery',()=>{
 it('does not ring the old backlog; presents new arrivals until dismissed and does not resurrect them on navigation',async()=>{
  mocks.list.mockResolvedValue({items:[notice('old')],noLeidas:1});const first=mount();await waitFor(()=>expect(JSON.parse(sessionStorage.getItem('cap-notices-seen:u')||'[]')).toContain('old'));
  expect(screen.queryByText('Te toca aprobar old')).not.toBeInTheDocument();
  mocks.list.mockResolvedValue({items:[notice('new'),notice('old')],noLeidas:2});await act(()=>first.client.invalidateQueries({queryKey:['notificaciones']}));
  expect(await screen.findByText('Te toca aprobar new')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Cerrar aviso en vivo'}));expect(mocks.mark).not.toHaveBeenCalled();
  first.unmount();mount();await act(async()=>{});expect(screen.queryByText('Te toca aprobar new')).not.toBeInTheDocument();
 });
 it('ignores self-authored events and opens a counterpart notice without changing identity',async()=>{
  mocks.list.mockResolvedValue({items:[],noLeidas:0});const {client}=mount();await waitFor(()=>expect(sessionStorage.getItem('cap-notices-seen:u')).toBe('[]'));
  mocks.list.mockResolvedValue({items:[notice('self','u')],noLeidas:1});await act(()=>client.invalidateQueries({queryKey:['notificaciones']}));expect(screen.queryByText('Te toca aprobar self')).not.toBeInTheDocument();
  mocks.list.mockResolvedValue({items:[notice('other')],noLeidas:2});await act(()=>client.invalidateQueries({queryKey:['notificaciones']}));fireEvent.click(await screen.findByRole('button',{name:'Abrir manifiesto',exact:true}));expect(mocks.mark).toHaveBeenCalledWith('other');
 });
});

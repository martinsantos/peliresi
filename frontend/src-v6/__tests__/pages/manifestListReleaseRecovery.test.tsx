import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import ManifiestosPage from '../../pages/manifiestos/ManifiestosPage';
const mock=vi.hoisted(()=>({query:vi.fn(),refetch:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'qa-user',rol:'ADMIN'}})}));
vi.mock('../../hooks/useManifiestos',()=>({useManifiestos:mock.query}));
vi.mock('../../hooks/useMobilePrefix',()=>({useMobilePrefix:()=>((p:string)=>p)}));
vi.mock('../../hooks/useGeneradores',()=>({useGeneradores:()=>({data:{items:[]}})}));
vi.mock('../../hooks/useOperadores',()=>({useOperadores:()=>({data:{items:[]}})}));
vi.mock('../../utils/exportPdf',()=>({exportReportePDF:vi.fn()}));
vi.mock('../../pages/reportes/tabs/shared',()=>({downloadCsv:vi.fn()}));
const item={id:'qa-release',numero:'QA-RELEASE-001',estado:'APROBADO',createdAt:'2026-09-30T12:00:00Z',generador:{razonSocial:'QA'},residuos:[]};
const query=(items=[item],extra={})=>({data:{items,total:items.length,totalPages:1},isLoading:false,isFetching:false,isError:false,refetch:mock.refetch,...extra});
const View=()=> <MemoryRouter><ManifiestosPage/></MemoryRouter>;
beforeEach(()=>{vi.clearAllMocks();mock.query.mockReturnValue(query());});
afterEach(cleanup);
it('clears old rows after a successful empty refresh',()=>{
 const view=render(<View/>);expect(screen.getAllByText(item.numero).length).toBeGreaterThan(0);
 mock.query.mockReturnValue(query([]));view.rerender(<View/>);
 expect(screen.queryAllByText(item.numero)).toHaveLength(0);expect(screen.getByText('No se encontraron manifiestos')).toBeVisible();
});
it('distinguishes an uncached offline query from a proven empty server registry',()=>{
 mock.query.mockReturnValue(query([],{data:{items:[],total:0,totalPages:0,offline:true}}));render(<View/>);
 expect(screen.getByText('No hay copias descargadas para estos filtros')).toBeVisible();
 expect(screen.queryByText('No se encontraron manifiestos')).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('copias de este dispositivo');
});
it('does not interpret a server failure as a disconnected device and retains prior rows',()=>{
 const view=render(<View/>);mock.query.mockReturnValue(query([item],{isError:true}));view.rerender(<View/>);
 expect(screen.getAllByText(item.numero).length).toBeGreaterThan(0);expect(screen.queryByText('(offline)')).not.toBeInTheDocument();
 expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar');fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(mock.refetch).toHaveBeenCalledOnce();
});
it('does not label a failed first request as an empty registry',()=>{
 mock.query.mockReturnValue(query([],{data:undefined,isError:true}));render(<View/>);
 expect(screen.queryByText('No se encontraron manifiestos')).not.toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
});
it('supports an explicit refresh without reloading the app',()=>{
 render(<View/>);fireEvent.click(screen.getByRole('button',{name:'Actualizar listado'}));expect(mock.refetch).toHaveBeenCalledOnce();
});
it('offers delete only for states the server can delete',()=>{
 const draft={...item,id:'qa-draft',numero:'QA-DRAFT-001',estado:'BORRADOR'},treated={...item,id:'qa-treated',numero:'QA-TREATED-001',estado:'TRATADO'};
 mock.query.mockReturnValue(query([draft,treated]));render(<View/>);
 expect(screen.getAllByRole('button',{name:'Eliminar manifiesto QA-DRAFT-001'}).length).toBeGreaterThan(0);
 expect(screen.queryAllByRole('button',{name:'Eliminar manifiesto QA-TREATED-001'})).toHaveLength(0);
});
it('keeps applied filters visible as removable chips and announces how many are active',()=>{
 render(<MemoryRouter initialEntries={['/manifiestos?estado=TRATADO&fechaDesde=2026-10-01']}><ManifiestosPage/></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Filtros, 2 activos'})).toHaveAttribute('aria-expanded','false');
 const chips=screen.getByRole('list',{name:'Filtros activos'});
 expect(within(chips).getAllByRole('button').map(b=>b.getAttribute('aria-label'))).toEqual(['Quitar filtro Tratado','Quitar filtro Desde 01/10/2026']);
 fireEvent.click(within(chips).getByRole('button',{name:'Quitar filtro Desde 01/10/2026'}));
 expect(mock.query).toHaveBeenLastCalledWith(expect.objectContaining({estado:'TRATADO',fechaDesde:undefined}));
 expect(screen.getByRole('button',{name:'Filtros, 1 activos'})).toBeInTheDocument();
});
it('keeps the accessible names of compact header actions',()=>{
 render(<View/>);
 expect(screen.getByRole('button',{name:'Actualizar listado'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Nuevo Manifiesto'})).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Manifiestos'})).toBeInTheDocument();
});
it('names the exceptional circuit Eventuales only where it is enabled',()=>{
 vi.stubEnv('VITE_MANIFEST_EXCEPTIONAL_ENABLED','true');
 try{render(<View/>);expect(screen.getByRole('link',{name:'Eventuales'})).toHaveAttribute('href','/manifiestos/baja-intensidad');}
 finally{vi.unstubAllEnvs();}
 cleanup();render(<View/>);expect(screen.queryByRole('link',{name:'Eventuales'})).not.toBeInTheDocument();
});

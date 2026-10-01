import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import ManifiestosPage from '../../pages/manifiestos/ManifiestosPage';
const mock=vi.hoisted(()=>({query:vi.fn(),refetch:vi.fn()}));
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

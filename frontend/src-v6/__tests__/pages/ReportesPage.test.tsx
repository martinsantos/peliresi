import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import ReportesPage from '../../pages/reportes/ReportesPage';
import { MemoryRouter, useLocation } from 'react-router-dom';
const hooks = vi.hoisted(() => ({
  query: { data: { resumen: {}, manifiestos: [], pagination: undefined as {page:number;limit:number;total:number;pages:number}|undefined }, isLoading: false, isFetching: false, isError: false, fetchStatus: 'idle', refetch: vi.fn() },
  params: vi.fn(), pdf: vi.fn(),
  export: { mutate: vi.fn(), isPending: false, isError: false },
  cc: { data: null, isPending: false, isError: false, refetch: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { rol: 'ADMIN' } }) }));
vi.mock('../../hooks/useReportes', () => ({
  useReporteManifiestos: (filters:unknown) => { hooks.params(filters); return hooks.query; }, useReporteTratados: () => hooks.query,
  useReporteTransporte: () => hooks.query, useExportarReporte: () => hooks.export,
}));
vi.mock('../../utils/exportPdf',()=>({exportReportePDF:hooks.pdf}));
vi.mock('../../hooks/useCentroControl', () => ({ useCentroControl: () => hooks.cc }));
vi.mock('../../pages/reportes/tabs/ManifiestosTab', () => ({ default: () => <div>Tabla de manifiestos QA</div> }));
vi.mock('../../pages/reportes/tabs/TratadosTab', () => ({ default: () => <div>Tabla de tratados QA</div> }));
vi.mock('../../pages/reportes/tabs/TransporteTab', () => ({ default: () => <div>Tabla de transporte QA</div> }));
function Location() { return <span data-testid="report-location">{useLocation().search}</span>; }
function ReportView({entry='/reportes'}:{entry?:string}) { return <MemoryRouter initialEntries={[entry]}><ReportesPage/><Location/></MemoryRouter>; }
describe('report toolbar recovery and controls', () => {
  beforeEach(() => { hooks.params.mockReset(); hooks.pdf.mockReset(); hooks.query.data.pagination=undefined; sessionStorage.clear(); hooks.query.isFetching=false; hooks.query.isError = false; hooks.query.fetchStatus = 'idle'; hooks.query.isLoading = false; hooks.query.refetch.mockReset(); hooks.export.isError = false; hooks.cc.isPending = false; hooks.cc.isError = false; hooks.cc.refetch.mockReset(); });
  it('exposes both custom date inputs with meaningful names', () => {
    render(<ReportView />);
    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date');
  });
  it('names exports and announces the selected report', () => {
    render(<ReportView />);
    expect(screen.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exportar PDF', exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Manifiestos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
  it('offers an actual retry after report query failure', () => {
    hooks.query.isError = true;
    render(<ReportView />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar reporte', exact: true }));
    expect(hooks.query.refetch).toHaveBeenCalledOnce();
  });
  it('does not silently lose a failed CSV export', async () => {
    hooks.export.isError = true;
    render(<ReportView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo exportar'));
  });
  it('does not present zero activity while the actor period query is still pending', async () => {
    hooks.cc.isPending = true;
    render(<ReportView />);
    fireEvent.click(screen.getByRole('button', { name: 'Generadores', exact: true }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando actividad');
  });
  it('offers a real retry for a failed actor period query', () => {
    hooks.cc.isError = true;
    render(<ReportView />);
    fireEvent.click(screen.getByRole('button', { name: 'Operadores', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar actividad', exact: true }));
    expect(hooks.cc.refetch).toHaveBeenCalledOnce();
  });
  it('explains a network-paused query instead of spinning indefinitely', () => {
    hooks.query.fetchStatus = 'paused'; hooks.query.isLoading = true;
    render(<ReportView />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
    expect(screen.queryByText('Generando reporte...')).toBeNull();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
  });
  it.each([['Residuos Tratados','tratados'],['Transporte','transporte']])('exports %s using its own report contract',async(label,tipo)=>{
    hooks.export.mutate.mockReset();render(<ReportView />);
    fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-09-01'}});
    await waitFor(()=>expect(screen.getByTestId('report-location')).toHaveTextContent('desde=2026-09-01'));
    fireEvent.click(screen.getByRole('button',{name:label,exact:true}));
    await waitFor(()=>expect(screen.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true'));
    fireEvent.click(screen.getByRole('button',{name:'Exportar CSV',exact:true}));
    expect(hooks.export.mutate).toHaveBeenCalledWith({tipo,formato:'csv',filters:{fechaDesde:'2026-09-01'}});
  });
  it('requests the next real report page and prevents navigating before page one',async()=>{
    hooks.query.data.pagination={page:1,limit:100,total:101,pages:2};render(<ReportView />);
    expect(await screen.findByRole('button',{name:'Página anterior'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Página siguiente'}));
    expect(hooks.params).toHaveBeenLastCalledWith({page:2});
    fireEvent.click(screen.getByRole('button',{name:'Página anterior'}));
    expect(hooks.params).toHaveBeenLastCalledWith({page:1});
  });
  it('resets the page when dates change instead of requesting an out-of-range page',async()=>{
    hooks.query.data.pagination={page:1,limit:100,total:101,pages:2};render(<ReportView />);
    fireEvent.click(await screen.findByRole('button',{name:'Página siguiente'}));
    fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-09-01'}});
    expect(hooks.params).toHaveBeenLastCalledWith({fechaDesde:'2026-09-01',page:1});
  });
  it('explicitly identifies a page-scoped PDF instead of implying all rows were exported',()=>{
    hooks.query.data.pagination={page:1,limit:100,total:101,pages:2};render(<ReportView />);
    fireEvent.click(screen.getByRole('button',{name:'Exportar PDF',exact:true}));
    expect(hooks.pdf).toHaveBeenCalledWith(expect.objectContaining({subtitulo:expect.stringContaining('Página 1 de 2 (0 registros de 101)')}));
  });

it.each(['error','paused','refresh'])('blocks PDF, CSV and print for unavailable report: %s', mode => {
  if(mode==='error')hooks.query.isError=true;
  if(mode==='paused')hooks.query.fetchStatus='paused';
  if(mode==='refresh')hooks.query.isFetching=true;
  render(<ReportView/>);
  for(const name of ['Exportar PDF','Exportar CSV','Imprimir reporte'])expect(screen.getByRole('button',{name,exact:true})).toBeDisabled();
});
it('retains exact dates, selected report and page when reopened',()=>{
  render(<ReportView entry="/reportes?tipo=transporte&desde=2026-09-01&hasta=2026-09-30&pagina=2"/>);
  expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-01');
  expect(screen.getByLabelText('Hasta')).toHaveValue('2026-09-30');
  expect(screen.getByRole('button',{name:'Transporte',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByTestId('report-location')).toHaveTextContent('pagina=2');
});
it('persists manual dates in the current history entry',()=>{
  render(<ReportView/>);
  fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-09-01'}});
  expect(screen.getByTestId('report-location')).toHaveTextContent('desde=2026-09-01');
  expect(screen.getByText('Desde 01/09/2026')).toBeVisible();
});
it('identifies reversed dates and prevents reading or exporting misleading results',()=>{
  render(<ReportView/>);
  fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-10-25'}});
  fireEvent.change(screen.getByLabelText('Hasta'),{target:{value:'2026-10-01'}});
  expect(screen.getByRole('alert')).toHaveTextContent('La fecha Hasta debe ser igual o posterior a Desde');
  expect(hooks.params).toHaveBeenLastCalledWith(undefined);
  expect(screen.getByRole('button',{name:'Exportar PDF',exact:true})).toBeDisabled();
  expect(screen.queryByText('Tabla de manifiestos QA')).toBeNull();
});

it('explains a PDF failure without losing the period',async()=>{
 hooks.pdf.mockRejectedValueOnce(new Error('image failed'));
 render(<ReportView entry="/reportes?desde=2026-09-01"/>);
 fireEvent.click(screen.getByRole('button',{name:'Exportar PDF',exact:true}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo preparar el PDF');
 expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-01');
 expect(screen.getByRole('button',{name:'Exportar PDF',exact:true})).toBeEnabled();
});
it('does not download an in-flight PDF after leaving the report',async()=>{
 let finish!:()=>void;
 hooks.pdf.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const view=render(<ReportView/>);
 fireEvent.click(screen.getByRole('button',{name:'Exportar PDF',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Exportar PDF',exact:true}));
 expect(hooks.pdf).toHaveBeenCalledOnce();
 const config=hooks.pdf.mock.calls[0][0];expect(config.canDownload()).toBe(true);
 view.unmount();expect(config.canDownload()).toBe(false);finish();
});

});

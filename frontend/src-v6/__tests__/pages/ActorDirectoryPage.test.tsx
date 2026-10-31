import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActoresPage } from '../../pages/actores/ActoresPage';

const qa = vi.hoisted(() => {
 const remove=vi.fn();
 return {
  error: false,
  query: vi.fn(),
  refetch: vi.fn(),
  csv: vi.fn(),
  pdf: vi.fn(),
  remove, mutation: () => ({ mutateAsync: remove, isPending: false }),
 };
});
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id:'admin', rol:'ADMIN' }, isRestricted:false }) }));
vi.mock('../../hooks/useActores', () => ({
  useActorDirectory: (filters: any) => {
    qa.query(filters);
    return { data: qa.error ? undefined : {
      items: [{ id:'qa-o-61', tipo:'operador', razonSocial:'QA Operador 61', cuit:'99-00000061-0',
        domicilio:'QA', telefono:'000', email:'qa@night-qa.invalid', activo:false }],
      counts: { generador: 45, transportista: 32, operador: 61 },
      pagination: { page: filters.page, limit:20, total: filters.tipo==='operador' ? 61 : 138, pages: filters.tipo==='operador' ? 4 : 7 },
    }, isLoading:false, isError:qa.error, refetch:qa.refetch };
  },
  useDeleteGenerador: qa.mutation, useDeleteTransportista: qa.mutation, useDeleteOperador: qa.mutation,
}));
vi.mock('../../utils/exportCsv', () => ({ downloadCsv:qa.csv }));
vi.mock('../../utils/exportPdf', () => ({ exportReportePDF:qa.pdf }));

function Detail() {
 const location=useLocation(), navigate=useNavigate();
 return <button onClick={() => navigate(location.state.actorReturn)}>Volver a Actores</button>;
}
const query='?q=QA&tipo=operador&estado=inactivo&page=3&sortBy=estado&sortOrder=desc';
function show() {
 return render(<MemoryRouter initialEntries={['/admin/actores'+query]}><Routes>
  <Route path="/admin/actores" element={<ActoresPage/>}/>
  <Route path="/admin/actores/operadores/:id" element={<Detail/>}/>
  <Route path="/admin/actores/operadores/nuevo" element={<Detail/>}/>
 </Routes></MemoryRouter>);
}
beforeEach(()=>{qa.error=false;qa.query.mockClear();qa.refetch.mockClear();qa.csv.mockClear();qa.pdf.mockClear();qa.remove.mockReset();});

describe('Unified actor directory',()=>{
 it('requests the complete filtered page and labels an export as the current page',()=>{
  show();
  expect(qa.query).toHaveBeenLastCalledWith({search:'QA',tipo:'operador',estado:'inactivo',sortBy:'estado',sortOrder:'desc',page:3,limit:20});
  expect(screen.getByRole('status')).toHaveTextContent('61 resultados con los filtros actuales');
  fireEvent.click(screen.getByText('Exportar'));
  fireEvent.click(screen.getByRole('button',{name:'CSV de esta página'}));
  expect(qa.csv).toHaveBeenCalledOnce();
  expect(qa.csv.mock.calls[0][0]).toEqual([expect.objectContaining({'Razon Social':'QA Operador 61',Estado:'Inactivo'})]);
  expect(qa.csv.mock.calls[0][2]).toEqual(expect.objectContaining({periodo:'Página 3 de 4',total:1}));
  fireEvent.click(screen.getByText('Exportar'));
  fireEvent.click(screen.getByRole('button',{name:'PDF de esta página'}));
  expect(qa.pdf.mock.calls[0][0]).toEqual(expect.objectContaining({subtitulo:expect.stringContaining('Resultados de la página actual'),periodo:'Página 3 de 4 · 61 resultados'}));
  expect(screen.getByRole('button',{name:'Vista de lista'})).toHaveAttribute('aria-pressed','true');
  expect(screen.queryByRole('checkbox',{name:/Seleccionar/})).toBeNull();
 });
 it('returns from a ficha to the same filters, sort and page',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'Abrir ficha de QA Operador 61'}));
  fireEvent.click(screen.getByRole('button',{name:'Volver a Actores'}));
  expect(screen.getByLabelText('Buscar actores')).toHaveValue('QA');
  expect(qa.query).toHaveBeenLastCalledWith(expect.objectContaining({tipo:'operador',estado:'inactivo',page:3,sortBy:'estado',sortOrder:'desc'}));
 });
 it('reports a failed query and offers retry instead of showing an empty directory',()=>{
  qa.error=true;show();
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos consultar el padrón');
  expect(screen.queryByText('No se encontraron actores')).toBeNull();
  fireEvent.click(screen.getByText('Exportar'));
  expect(screen.getByRole('button',{name:'CSV de esta página'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Reintentar consulta'}));expect(qa.refetch).toHaveBeenCalledOnce();
 });
 it('uses the complete operator form rather than creating with a default password',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'Nuevo Actor'}));
  const dialog=screen.getByRole('dialog',{name:'Nuevo Actor'});
  fireEvent.click(within(dialog).getByLabelText('Tipo de Actor'));
  fireEvent.click(screen.getByRole('option',{name:'Operador'}));
  expect(within(dialog).queryByLabelText('Password inicial')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button',{name:'Continuar al formulario'}));
  expect(screen.getByRole('button',{name:'Volver a Actores'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Volver a Actores'}));
  expect(qa.query).toHaveBeenLastCalledWith(expect.objectContaining({tipo:'operador',estado:'inactivo',page:3}));
 });
 it('keeps a rejected deletion visible and does not submit twice',async()=>{
  qa.remove.mockRejectedValueOnce({response:{data:{message:'Tiene manifiestos asociados'}}});
  show();fireEvent.click(screen.getByRole('button',{name:'Eliminar QA Operador 61'}));
  const dialog=screen.getByRole('dialog',{name:'Eliminar Actor'});
  fireEvent.click(within(dialog).getByRole('button',{name:'Eliminar',exact:true}));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tiene manifiestos asociados');
  let finish!:()=>void;
  qa.remove.mockReturnValueOnce(new Promise<void>(resolve=>{finish=resolve;}));
  fireEvent.click(within(dialog).getByRole('button',{name:'Eliminar',exact:true}));
  fireEvent.click(within(dialog).getByRole('button',{name:'Eliminar',exact:true}));
  expect(qa.remove).toHaveBeenCalledTimes(2);
  finish();await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Eliminar Actor'})).toBeNull());
  expect(qa.refetch).toHaveBeenCalledOnce();
 });
});

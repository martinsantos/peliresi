import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { actorListReturn, useActorListNavigation } from '../../hooks/useActorListNavigation';

function List({path}:{path:string}) {
  const list=useActorListNavigation(), location=useLocation(), navigate=useNavigate();
  return <><output aria-label="URL">{location.pathname+location.search}</output>
    <input aria-label="Buscar" value={list.text('q')} onChange={e=>{list.set('q',e.target.value);list.set('page',1);}} />
    <output aria-label="Página">{list.number('page',1)}</output>
    <button onClick={()=>{list.set('estado','inactivo');list.set('tipo','FIJO');list.set('page',1);}}>Filtrar</button>
    <button onClick={()=>{for(const key of ['estado','tipo','page'])list.set(key,undefined);}}>Restablecer</button>
    <button onClick={()=>list.open(path+'/nuevo')}>Nuevo</button>
    <button onClick={()=>navigate(-1)}>Atrás navegador</button></>;
}
function Form({path}:{path:string}) {
  const location=useLocation(), navigate=useNavigate();
  return <><button onClick={()=>navigate(actorListReturn(location.state,path))}>Volver</button><button onClick={()=>navigate(-1)}>Atrás navegador</button></>;
}
describe('Actor directory continuity',()=>{
  it.each(['','/app','/mobile'])('preserves complete list context on %s',prefix=>{
    const path=prefix+'/admin/actores/operadores';
    render(<MemoryRouter initialEntries={[path+'?q=QA&page=3&sortBy=categoria&sortOrder=desc']}><Routes>
      <Route path={path} element={<List path={path}/>}/><Route path={path+'/nuevo'} element={<Form path={path}/>}/>
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByText('Nuevo'));fireEvent.click(screen.getByText('Volver'));
    expect(screen.getByLabelText('URL')).toHaveTextContent(path+'?q=QA&page=3&sortBy=categoria&sortOrder=desc');
    fireEvent.click(screen.getByText('Filtrar'));
    expect(screen.getByLabelText('URL')).toHaveTextContent('estado=inactivo&tipo=FIJO');
    expect(screen.getByLabelText('Página')).toHaveTextContent('1');
    fireEvent.change(screen.getByLabelText('Buscar'),{target:{value:'Otra'}});
    fireEvent.click(screen.getByText('Nuevo'));fireEvent.click(screen.getByText('Atrás navegador'));
    expect(screen.getByLabelText('Buscar')).toHaveValue('Otra');
    expect(screen.getByLabelText('URL')).toHaveTextContent('estado=inactivo&tipo=FIJO');
    fireEvent.click(screen.getByText('Restablecer'));
    expect(screen.getByLabelText('URL')).toHaveTextContent(path+'?q=Otra&sortBy=categoria&sortOrder=desc');
    expect(screen.getByLabelText('URL')).not.toHaveTextContent('tipo=');
  });
  it.each(['https://evil.invalid/admin/actores/operadores?q=a','//evil.invalid/admin/actores/operadores','/app/admin/actores/operadores?q=a','/admin/actores/generadores?q=a','/admin/actores/operadores\\?q=a'])('refuses an unrelated return path %s',value=>{
    expect(actorListReturn({actorReturn:value},'/admin/actores/operadores')).toBe('/admin/actores/operadores');
  });
  it('retains an encoded search on the same list',()=>{
    expect(actorListReturn({actorReturn:'/admin/actores/operadores?q=QA%20%26%20Uno&page=2'},'/admin/actores/operadores')).toBe('/admin/actores/operadores?q=QA%20%26%20Uno&page=2');
  });
});

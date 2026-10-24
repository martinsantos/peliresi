import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecordListFilters } from '../../components/crud/RecordListFilters';
import { RecordListToolbar } from '../../components/crud/RecordListToolbar';

function FilterFixture() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('todos');
  const [year, setYear] = useState('2026');
  return <RecordListFilters title="Generadores" value={search} onChange={setSearch} filters={[
    {key:'state', label:'Estado', placeholder:'Todos los estados',value:state,onChange:setState,options:[{value:'todos',label:'Todos'},{value:'activo',label:'Activo'}]},
    {key:'year',label:'Ejercicio',placeholder:'Ejercicio',defaultValue:'2026',value:year,onChange:setYear,options:[{value:'2025',label:'2025'},{value:'2026',label:'2026'}]},
  ]}/>;
}

describe('Record list controls', () => {
  it('keeps the selected filters visible in a compact summary and restores them on expand', () => {
    render(<FilterFixture />);
    expect(screen.queryByRole('button',{name:'Estado'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Filtros'}));
    fireEvent.click(screen.getByRole('button',{name:'Estado'}));
    fireEvent.click(screen.getByRole('option',{name:'Activo',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Filtros (1)'}));
    expect(screen.getByText('Estado: Activo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Filtros (1)'}));
    expect(screen.getByRole('button',{name:'Estado'})).toHaveTextContent('Activo');
  });
  it('resets filters to their declared defaults without losing the search', () => {
    render(<FilterFixture />);
    fireEvent.change(screen.getByRole('textbox',{name:'Buscar generadores'}),{target:{value:'QA'}});
    fireEvent.click(screen.getByRole('button',{name:'Filtros'}));
    fireEvent.click(screen.getByRole('button',{name:'Ejercicio'}));
    fireEvent.click(screen.getByRole('option',{name:'2025',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Restablecer filtros'}));
    expect(screen.getByRole('button',{name:'Ejercicio'})).toHaveTextContent('2026');
    expect(screen.getByRole('textbox',{name:'Buscar generadores'})).toHaveValue('QA');
    expect(screen.getByRole('button',{name:'Filtros'})).toHaveAttribute('aria-expanded','true');
  });
  it('offers the permitted create action and prevents exports when records are unavailable', () => {
    const create=vi.fn(), download=vi.fn();
    render(<RecordListToolbar title="Operadores" onNew={create} newLabel="Nuevo operador" exports={[{label:'Descargar PDF',icon:null,onClick:download,disabled:true}]}/>);
    fireEvent.click(screen.getByRole('button',{name:'Nuevo operador'}));
    expect(create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Exportar'));
    const details=screen.getByText('Exportar').closest('details')!;
    expect(within(details).getByRole('button',{name:'Descargar PDF'})).toBeDisabled();
    fireEvent.click(within(details).getByRole('button',{name:'Descargar PDF'}));
    expect(download).not.toHaveBeenCalled();
  });
  it('does not invent a create action for a read-only list', () => {
    render(<RecordListToolbar title="Operadores" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Exportar')).not.toBeInTheDocument();
  });
});

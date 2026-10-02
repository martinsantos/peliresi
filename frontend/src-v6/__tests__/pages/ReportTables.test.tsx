import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ManifiestosTab from '../../pages/reportes/tabs/ManifiestosTab';
import TratadosTab from '../../pages/reportes/tabs/TratadosTab';
import TransporteTab from '../../pages/reportes/tabs/TransporteTab';
import GeneradoresTab from '../../pages/reportes/tabs/GeneradoresTab';
import OperadoresTab from '../../pages/reportes/tabs/OperadoresTab';

const actors = vi.hoisted(() => ({
  generator: { id: 'gen', razonSocial: 'QA Generador', cuit: '30000000001', categoria: 'Y8', _count: { manifiestos: 1 } },
  operator: { id: 'op', razonSocial: 'QA Operador', cuit: '30000000002', categoria: 'Y8', tratamientos: [], activo: true },
}));
vi.mock('../../hooks/useActores', () => ({
  useGeneradores: () => ({ data: { items: [actors.generator] }, isLoading: false }),
  useOperadores: () => ({ data: { items: [actors.operator] }, isLoading: false }),
}));
// Charts are outside this interaction test; real charts are exercised by browser QA.
vi.mock('recharts', () => Object.fromEntries(['BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'Cell', 'Legend'].map(name => [name, () => null])));
vi.mock('../../components/charts/CategoryBarChart', () => ({ CategoryBarChart: (props: unknown) => <output data-testid="residue-chart">{JSON.stringify(props)}</output> }));
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
const props = { periodo: 'Todo', onExportPDF: vi.fn() };
const cases = [
  { name: 'manifiestos', render: () => <ManifiestosTab {...props} data={{ manifiestos: [{ id: 'm', numero: 'QA-M', estado: 'APROBADO', generador: 'QA Generador' }] }} />, text: 'QA-M', header: 'Número', path: '/manifiestos/m' },
  { name: 'tratados', render: () => <TratadosTab {...props} data={{ detalle: [{ id: 'm', numero: 'QA-T', generador: 'QA Generador', residuos: [] }] }} />, text: 'QA-T', header: 'Número', path: '/manifiestos/m' },
  { name: 'transporte', render: () => <TransporteTab {...props} data={{ transportistas: [{ transportistaId: 't', transportista: 'QA Transporte', totalViajes: 1, tasaCompletitud: '0%' }] }} />, text: 'QA Transporte', header: 'Transportista', path: '/admin/actores/transportistas/t' },
  { name: 'generadores', render: () => <GeneradoresTab periodoLabel="Todo" />, text: 'QA Generador', header: 'Razon Social', path: '/admin/actores/generadores/gen' },
  { name: 'operadores', render: () => <OperadoresTab periodoLabel="Todo" />, text: 'QA Operador', header: 'Razon Social', path: '/admin/actores/operadores/op' },
];
describe('report table interaction contract', () => {
  it.each(['manifiestos','tratados'])('%s charts never add incompatible units or use lossy API aggregates',tipo=>{
    const row={id:'m',numero:'QA-MIX',residuos:[{tipo:'Y1',codigo:'Y1',cantidad:2,unidad:'L'},{tipo:'Y1',codigo:'Y1',cantidad:5,unidad:'kg'}]};
    const data={porTipoResiduo:{Y1:{cantidad:999,unidad:'kg'}},totalPorTipo:{Y1:999},manifiestos:[row],detalle:[row]};
    render(<MemoryRouter>{tipo==='manifiestos'?<ManifiestosTab {...props} data={data}/>:<TratadosTab {...props} data={data}/>}</MemoryRouter>);
    expect(screen.getByText('Cantidad por unidad · esta página')).toBeVisible();
    const charts=screen.getAllByTestId('residue-chart').map(node=>JSON.parse(node.textContent!));
    expect(charts).toHaveLength(2);
    expect(charts.map(chart=>[chart.valueSuffix,chart.data[0].value])).toEqual([['L',2],['kg',5]]);
    expect(charts.every(chart=>chart.showPercent===false)).toBe(true);
  });
  it.each(['manifiestos','tratados'])('%s cannot chart quantities with unknown dimensions',tipo=>{
    const row={id:'m',numero:'QA-UNKNOWN',residuos:[{tipo:'Y1',codigo:'Y1',cantidad:2,unidad:null}]};
    render(<MemoryRouter>{tipo==='manifiestos'?<ManifiestosTab {...props} data={{manifiestos:[row]}}/>:<TratadosTab {...props} data={{detalle:[row]}}/>}</MemoryRouter>);
    expect(screen.getByText('Falta la unidad de un residuo; no se puede comparar su cantidad.')).toBeVisible();
    expect(screen.queryAllByTestId('residue-chart')).toHaveLength(0);
  });
  it.each(['manifiestos','tratados'])('%s cannot chart a partial sum after invalid quantities',tipo=>{
    const row={id:'m',numero:'QA-INVALID',residuos:[{tipo:'Y1',codigo:'Y1',cantidad:2,unidad:'kg'},{tipo:'Y1',codigo:'Y1',cantidad:'unknown',unidad:'kg'}]};
    render(<MemoryRouter>{tipo==='manifiestos'?<ManifiestosTab {...props} data={{manifiestos:[row]}}/>:<TratadosTab {...props} data={{detalle:[row]}}/>}</MemoryRouter>);
    expect(screen.getByText('Hay cantidades inválidas; no se muestra una suma parcial.')).toBeVisible();
    expect(screen.queryAllByTestId('residue-chart')).toHaveLength(0);
  });
  it.each(['manifiestos','tratados'])('%s never labels liters as kilograms or a page as the complete quantity',tipo=>{
    const row={id:'m',numero:'QA-MIX',residuos:[{cantidad:2,unidad:'L'},{cantidad:5,unidad:'kg'}]};
    const data={resumen:{totalResiduos:999,totalResiduosTratados:999},manifiestos:[row],detalle:[row]};
    render(<MemoryRouter>{tipo==='manifiestos'?<ManifiestosTab {...props} data={data}/>:<TratadosTab {...props} data={data}/>}</MemoryRouter>);
    const metric=screen.getByText('Residuos de esta página').parentElement!;
    expect(metric).toHaveTextContent('2 L');expect(metric).toHaveTextContent('5 kg');expect(metric).not.toHaveTextContent('999');
    expect(metric.querySelector('p.text-xl')).toHaveClass('break-words');
  });
  it('identifies transport aggregates that only describe the current page',()=>{
    render(<MemoryRouter><TransporteTab {...props} data={{resumen:{totalTransportistas:101,totalViajes:2,viajesActivos:1},transportistas:[]}}/></MemoryRouter>);
    expect(screen.getByText('Viajes de esta página')).toBeVisible();
    expect(screen.queryByText('Total Viajes',{exact:true})).toBeNull();
  });
  it('does not claim 50 visible records when all 100 loaded rows are rendered',()=>{
    render(<MemoryRouter><ManifiestosTab {...props} data={{manifiestos:Array.from({length:100},(_,i)=>({id:'m'+i,numero:'QA-'+i,estado:'APROBADO',generador:'QA'}))}} /></MemoryRouter>);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(100);
    expect(screen.queryByText(/Mostrando 50 de/)).toBeNull();
  });
  for (const item of cases) {
    it(`${item.name}: the whole row supports keyboard navigation within app basename`, () => {
      render(<MemoryRouter basename="/app" initialEntries={['/app/reportes']}>{item.render()}<Location /></MemoryRouter>);
      const row = screen.getByRole('table').querySelector('tbody tr')!;
      expect(within(row as HTMLElement).getByText(item.text)).toBeVisible();
      expect(row).toHaveAttribute('tabindex', '0');
      fireEvent.keyDown(row, { key: 'Enter' });
      expect(screen.getByTestId('location')).toHaveTextContent(item.path);
    });
    it(`${item.name}: sorting uses native buttons and announces direction`, () => {
      render(<MemoryRouter>{item.render()}</MemoryRouter>);
      const button = within(screen.getByRole('table')).getByRole('button', { name: `Ordenar por ${item.header}`, exact: true });
      const header = button.closest('th')!;
      expect(header).toHaveAttribute('aria-sort', 'none');
      fireEvent.click(button);
      expect(header).toHaveAttribute('aria-sort', 'ascending');
      fireEvent.click(button);
      expect(header).toHaveAttribute('aria-sort', 'descending');
    });
  }
  it('a period with no generators never falls back to all registered generators', () => {
    render(<MemoryRouter><GeneradoresTab periodoLabel="Período vacío" incluirTodos={false} ccData={{ generadores: [] } as never} /></MemoryRouter>);
    expect(screen.queryByText('QA Generador')).toBeNull();
  });
  it('a period with no operators never falls back to all registered operators', () => {
    render(<MemoryRouter><OperadoresTab periodoLabel="Período vacío" incluirTodos={false} ccData={{ operadores: [] } as never} /></MemoryRouter>);
    expect(screen.queryByText('QA Operador')).toBeNull();
  });
});

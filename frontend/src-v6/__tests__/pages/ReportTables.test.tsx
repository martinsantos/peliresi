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
vi.mock('../../components/charts/CategoryBarChart', () => ({ CategoryBarChart: () => null }));
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

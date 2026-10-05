import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ManifiestosTab from '../../pages/reportes/tabs/ManifiestosTab';
import TransporteTab from '../../pages/reportes/tabs/TransporteTab';
import TratamientosTab from '../../pages/reportes/tabs/TratamientosTab';
import DepartamentosTab, { DepartamentoDetalleModal } from '../../pages/reportes/tabs/DepartamentosTab';
import TratadosTab from '../../pages/reportes/tabs/TratadosTab';
import GeneradoresTab from '../../pages/reportes/tabs/GeneradoresTab';
import OperadoresTab from '../../pages/reportes/tabs/OperadoresTab';
import { ACTOR_COLORS } from '../../utils/actor-identity';

// Only chart layout is a double. The actual labels, rows, category definitions
// and computed values render unchanged; browser QA separately measures CSS.
vi.mock('recharts', () => ({
  ...Object.fromEntries(['BarChart', 'Bar', 'ResponsiveContainer'].map(name => [name, ({ children }: { children?: ReactNode }) => <div>{children}</div>])),
  ...Object.fromEntries(['CartesianGrid', 'Tooltip', 'Cell'].map(name => [name, () => null])),
  ...Object.fromEntries(['XAxis', 'YAxis'].map(name => [name, ({ tick, stroke }: { tick?: { fill?: string; fontSize?: number }; stroke?: string }) =>
    <output data-testid="chart-axis">{JSON.stringify({ axis: name, tick, stroke })}</output>])),
  Legend: ({ formatter }: { formatter?: (value: string) => ReactNode }) => <div data-testid="legend">
    {['Transportistas', 'En Tránsito'].map(label => <span key={label} style={{ color: '#F59E0B' }}>{formatter ? formatter(label) : label}</span>)}
  </div>,
}));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {} } }) }));
vi.mock('../../hooks/useActores', () => ({
  useGeneradores: () => ({ data: { items: [{ id: 'qa-g', razonSocial: 'QA Generador', cuit: '99000000010', domicilioRealDepto: 'Capital' }] }, isLoading: false }),
  useOperadores: () => ({ data: { items: [{ id: 'qa-o', razonSocial: 'QA Operador', cuit: '99000000012', domicilio: 'Capital', categoria: 'Y1' }] }, isLoading: false }),
}));
vi.mock('../../components/charts/CategoryBarChart', () => ({ CategoryBarChart: () => null }));
const props = { periodo: 'QA', onExportPDF: vi.fn() };

for (const [name, content, count] of [
  ['manifiestos', <ManifiestosTab {...props} data={{ porEstado: { APROBADO: 2 } }} />, 2],
  ['tratados', <TratadosTab {...props} data={{ porGenerador: { 'QA Generador': 2 } }} />, 2],
  ['transporte', <TransporteTab {...props} data={{ transportistas: [{ transportista: 'QA Transporte', totalViajes: 2, completados: 1, enTransito: 1 }] }} />, 2],
  ['generadores', <GeneradoresTab periodoLabel="QA" />, 2],
  ['operadores', <OperadoresTab periodoLabel="QA" />, 2],
  ['tratamientos', <TratamientosTab periodoLabel="QA" />, 4],
  ['departamentos', <DepartamentosTab ccData={{ generadores: [{ id: 'qa-g', latitud: -32.8895, longitud: -68.8458 }], transportistas: [], operadores: [] } as never} onSelectDep={vi.fn()} periodoLabel="QA" />, 2],
] as const) {
  it(`${name} axes use readable SVG fill independently of decorative grid strokes`, () => {
    render(<MemoryRouter>{content}</MemoryRouter>);
    const axes = screen.getAllByTestId('chart-axis').map(node => JSON.parse(node.textContent!));
    expect(axes).toHaveLength(count);
    for (const axis of axes) {
      expect(axis.tick.fill).toBe('#475569');
      expect(axis.tick.fontSize).toBeGreaterThanOrEqual(11);
      expect(axis.stroke).toBe('#94a3b8');
    }
  });
}

it('state labels use dark ink independently of the preserved colored status dot', () => {
  render(<MemoryRouter><ManifiestosTab {...props} data={{ manifiestos: ['BORRADOR', 'APROBADO', 'RECIBIDO', 'TRATADO'].map((estado, i) => ({ id: 'qa-' + i, numero: 'QA-' + i, estado, generador: 'QA' })) }} /></MemoryRouter>);
  for (const status of ['BORRADOR', 'APROBADO', 'RECIBIDO', 'TRATADO']) {
    const badge = screen.getByText(status, { exact: true });
    expect(badge).toHaveClass('text-neutral-700');
    expect((badge.querySelector('span') as HTMLElement).style.backgroundColor).not.toBe('');
    expect(badge.style.backgroundColor).not.toBe('');
  }
});

it('transport rows and legend labels remain readable without recoloring the data series', () => {
  render(<MemoryRouter><TransporteTab {...props} data={{ transportistas: [{ transportista: 'QA Transporte', totalViajes: 55, completados: 22, enTransito: 33, tasaCompletitud: '40%' }] }} /></MemoryRouter>);
  const row = screen.getByRole('table').querySelector('tbody tr') as HTMLElement;
  expect(within(row).getByText('22')).toHaveClass('text-emerald-700');
  expect(within(row).getByText('33')).toHaveClass('text-amber-800');
  expect(within(row).getByText('40%')).toHaveClass('text-neutral-700');
  const legend = screen.getByTestId('legend');
  for (const label of ['Transportistas', 'En Tránsito']) expect(within(legend).getByText(label)).toHaveClass('text-neutral-700');
});

it('treatment categories keep their names and tint without using chart colors as small text ink', () => {
  render(<MemoryRouter><TratamientosTab periodoLabel="QA" /></MemoryRouter>);
  const captions = [...screen.getByRole('table').querySelectorAll('span.inline-block.font-semibold')];
  expect(captions.length).toBeGreaterThan(5);
  for (const caption of captions) {
    expect(caption).toHaveClass('text-neutral-700');
    expect(caption.textContent?.trim()).not.toBe('');
    expect((caption as HTMLElement).style.backgroundColor).not.toBe('');
  }
});

it('department actor metrics retain canonical generator and operator identity', () => {
  render(<MemoryRouter><DepartamentosTab ccData={{ generadores: [], transportistas: [], operadores: [] } as never} onSelectDep={vi.fn()} periodoLabel="QA" /></MemoryRouter>);
  const generator = screen.getByText('Generadores', { selector: 'p', exact: true }).closest('.bg-gradient-to-br')!;
  const operator = screen.getByText('Operadores', { selector: 'p', exact: true }).closest('.bg-gradient-to-br')!;
  expect(generator).toHaveClass('from-purple-700', 'to-purple-800');
  expect(generator.querySelector('svg.lucide-factory')).toBeInTheDocument();
  expect(operator.querySelector('svg.lucide-flask-conical')).toBeInTheDocument();
});

it('treated report references the generator with its canonical category instead of operator blue', () => {
  render(<MemoryRouter><TratadosTab {...props} data={{ detalle: [], porGenerador: {} }} /></MemoryRouter>);
  const generator = screen.getByText('Generadores de esta página', { selector: 'p', exact: true }).closest('.bg-gradient-to-br')!;
  expect(generator).toHaveClass('from-purple-700', 'to-purple-800');
  expect(generator.querySelector('svg.lucide-factory')).toBeInTheDocument();
});

it('department table keys match the actual canonical actor series, not a green generator', () => {
  render(<MemoryRouter><DepartamentosTab ccData={{ generadores: [{ id: 'qa-g', latitud: -32.8895, longitud: -68.8458 }], transportistas: [], operadores: [] } as never} onSelectDep={vi.fn()} periodoLabel="QA" /></MemoryRouter>);
  for (const [label, color] of [['Gen.', ACTOR_COLORS.generador], ['Trans.', ACTOR_COLORS.transportista], ['Oper.', ACTOR_COLORS.operador]]) {
    const key = screen.getByRole('columnheader', { name: label, exact: true }).querySelector('span.rounded-full');
    expect(key).toHaveStyle({ backgroundColor: color });
  }
});

it('department detail keys use the same actor identity as the table and chart', () => {
  render(<MemoryRouter><DepartamentoDetalleModal departamento="Capital" generadores={[]} transportistas={[]} operadores={[]} periodoLabel="QA" onClose={vi.fn()} /></MemoryRouter>);
  for (const [label, color] of [['Generadores', ACTOR_COLORS.generador], ['Transportistas', ACTOR_COLORS.transportista], ['Operadores', ACTOR_COLORS.operador]]) {
    const key = screen.getByText(label, { selector: 'span', exact: true }).parentElement!.querySelector('span.rounded-full');
    expect(key).toHaveStyle({ backgroundColor: color });
  }
});

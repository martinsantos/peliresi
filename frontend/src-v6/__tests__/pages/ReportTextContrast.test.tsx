import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ManifiestosTab from '../../pages/reportes/tabs/ManifiestosTab';
import TransporteTab from '../../pages/reportes/tabs/TransporteTab';
import TratamientosTab from '../../pages/reportes/tabs/TratamientosTab';
import DepartamentosTab from '../../pages/reportes/tabs/DepartamentosTab';

// Only chart layout is a double. The actual labels, rows, category definitions
// and computed values render unchanged; browser QA separately measures CSS.
vi.mock('recharts', () => ({
  ...Object.fromEntries(['BarChart', 'Bar', 'ResponsiveContainer'].map(name => [name, ({ children }: { children?: ReactNode }) => <div>{children}</div>])),
  ...Object.fromEntries(['XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Cell'].map(name => [name, () => null])),
  Legend: ({ formatter }: { formatter?: (value: string) => ReactNode }) => <div data-testid="legend">
    {['Transportistas', 'En Tránsito'].map(label => <span key={label} style={{ color: '#F59E0B' }}>{formatter ? formatter(label) : label}</span>)}
  </div>,
}));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {} } }) }));
vi.mock('../../components/charts/CategoryBarChart', () => ({ CategoryBarChart: () => null }));
const props = { periodo: 'QA', onExportPDF: vi.fn() };

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
  expect(generator).toHaveClass('from-purple-600');
  expect(generator.querySelector('svg.lucide-factory')).toBeInTheDocument();
  expect(operator.querySelector('svg.lucide-flask-conical')).toBeInTheDocument();
});

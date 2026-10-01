import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ControlStats } from '../../pages/centro-control/components/ControlStats';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="measured-chart">{children}</div>,
  Tooltip: () => null, BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Area: () => null,
}));
const cc = { estadisticas: { totalManifiestos: 2, porEstado: { APROBADO: 2 },
  distribucionPorEstado: { APROBADO: 2 }, enTransitoActivos: 0, generadoresActivos: 1,
  operadoresActivos: 1, toneladasPeriodo: 0, manifiestosPorDia: [{ fecha: '2026-10-01', cantidad: 2 }] } };
function setup() {
  const view = render(<ControlStats cc={cc as never} alertas={[]} datePreset={30} />);
  return { ...view, details: view.container.querySelector('details')! };
}
function toggle(details: HTMLDetailsElement, open: boolean) {
  details.open = open;
  fireEvent(details, new Event('toggle'));
}
describe('Control: visible charts and native interactions', () => {
  it('opens and closes the semantic details while mounting its contents in the same update', async () => {
    const { details } = setup();
    const summary = screen.getByText('Actividad y estadísticas del período');
    await userEvent.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getAllByTestId('measured-chart')).toHaveLength(2);
    await userEvent.click(summary);
    expect(details.open).toBe(false);
    expect(screen.queryAllByTestId('measured-chart')).toHaveLength(0);
    await userEvent.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getAllByTestId('measured-chart')).toHaveLength(2);
  });
  it('does not mount measuring charts in the closed section, mounts on expand and unmounts on close', () => {
    const { details } = setup();
    expect(details.open).toBe(false);
    expect(screen.queryAllByTestId('measured-chart')).toHaveLength(0);
    toggle(details, true);
    expect(screen.getAllByTestId('measured-chart')).toHaveLength(2);
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent('2');
    toggle(details, false);
    expect(screen.queryAllByTestId('measured-chart')).toHaveLength(0);
    toggle(details, true);
    expect(screen.getAllByTestId('measured-chart')).toHaveLength(2);
  });
  it('activates the manifesto KPI with Enter once and exposes a native button', async () => {
    setup(); navigate.mockClear();
    const button = screen.getByRole('button', { name: 'Total Manifiestos' });
    expect(button).toHaveAttribute('type', 'button');
    button.focus(); await userEvent.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/manifiestos');
  });
  it('activates a pipeline stage with Space once without submitting a form', async () => {
    const { details } = setup(); toggle(details, true); navigate.mockClear();
    const stage = screen.getByRole('button', { name: 'APROBADO: 2' });
    expect(stage).toHaveAttribute('type', 'button');
    stage.focus(); await userEvent.keyboard(' ');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/manifiestos?estado=APROBADO');
  });
  it('uses the operator FlaskConical symbol, not the package icon', () => {
    setup();
    const operator = screen.getByText('Operadores Activos').closest('button');
    expect(operator?.querySelector('.lucide-flask-conical')).not.toBeNull();
    expect(operator?.querySelector('.lucide-package')).toBeNull();
  });
});

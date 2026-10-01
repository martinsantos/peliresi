import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlStats } from '../../pages/centro-control/components/ControlStats';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null, BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Area: () => null,
}));

function expandStatistics() {
  const details = screen.getByText('Actividad y estadísticas del período').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
}
function renderCounts(porEstado: Record<string, number>, totalManifiestos: number) {
  const cc = { estadisticas: { totalManifiestos, porEstado, enTransitoActivos: 0,
    generadoresActivos: 0, operadoresActivos: 0, toneladasPeriodo: 0, manifiestosPorDia: [] } };
  render(<ControlStats cc={cc as never} alertas={[]} datePreset={30} />);
  expandStatistics();
}

describe('distribution totals account for every returned manifest state', () => {
  it('includes treatment, rejection and cancellation in the same 22-item denominator', () => {
    renderCounts({ BORRADOR: 3, APROBADO: 2, EN_TRANSITO: 3, ENTREGADO: 3,
      RECIBIDO: 2, TRATADO: 6, EN_TRATAMIENTO: 1, RECHAZADO: 1, CANCELADO: 1 }, 22);
    expect(screen.getByText('Total Manifiestos').previousElementSibling).toHaveTextContent(/^22$/);
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent(/^22$/);
    expect(screen.getAllByText('EN TRATAMIENTO').length).toBeGreaterThan(0);
    expect(screen.getByText('RECHAZADO')).toBeInTheDocument();
    expect(screen.getByText('CANCELADO')).toBeInTheDocument();
    expect(screen.getAllByText('(4.5%)')).toHaveLength(3);
  });

  it('retains an unfamiliar server state instead of silently dropping its count', () => {
    renderCounts({ BORRADOR: 1, ESTADO_LEGADO: 2 }, 3);
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent(/^3$/);
    expect(screen.getByText('ESTADO LEGADO')).toBeInTheDocument();
    expect(screen.getByText('(66.7%)')).toBeInTheDocument();
  });

  it('renders a confirmed empty distribution without inventing a non-zero denominator', () => {
    renderCounts({ BORRADOR: 0, CANCELADO: 0 }, 0);
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent(/^0$/);
    expect(screen.queryByText('(NaN%)')).not.toBeInTheDocument();
  });

  it('uses the matching historical cohort, not the differently dated pipeline', () => {
    render(<ControlStats cc={{ estadisticas: { totalManifiestos: 5, porEstado: { APROBADO: 1 }, distribucionPorEstado: { APROBADO: 2, CANCELADO: 3 }, enTransitoActivos: 0, generadoresActivos: 0, operadoresActivos: 0, toneladasPeriodo: 0, manifiestosPorDia: [] } } as never} alertas={[]} datePreset={30} />);
    expandStatistics();
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent(/^5$/);
    expect(screen.getByText('CANCELADO')).toBeInTheDocument();
    expect(screen.getByText('(60.0%)')).toBeInTheDocument();
  });

  it('does not fall back to nonempty stage activity when the historical cohort is confirmed empty', () => {
    render(<ControlStats cc={{ estadisticas: { totalManifiestos: 0, porEstado: { APROBADO: 7 }, distribucionPorEstado: {}, enTransitoActivos: 0, generadoresActivos: 0, operadoresActivos: 0, toneladasPeriodo: 0, manifiestosPorDia: [] } } as never} alertas={[]} datePreset={30} />);
    expandStatistics();
    expect(screen.getByText('Total manifiestos').previousElementSibling).toHaveTextContent(/^0$/);
  });
});

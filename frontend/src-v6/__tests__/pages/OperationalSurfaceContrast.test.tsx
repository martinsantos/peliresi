import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ControlFilters } from '../../pages/centro-control/components/ControlFilters';
import AdminBlockchainPage from '../../pages/admin/AdminBlockchainPage';
import DashboardPage from '../../pages/dashboard/DashboardPage';
import ManifiestosPage from '../../pages/manifiestos/ManifiestosPage';

const mocks = vi.hoisted(() => {
  const trip = (estado: string, numero: string) => ({ data: { items: [{ id: 'qa-trip', numero, estado, createdAt: '2026-10-05T12:00:00Z', generador: { razonSocial: 'QA Generador' }, operador: { razonSocial: 'QA Operador' }, residuos: [] }], total: 1, totalPages: 1 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() });
  return { verify: vi.fn(), query: vi.fn(), active: trip('EN_TRANSITO', 'QA-ACTIVE-001'), pending: trip('APROBADO', 'QA-PENDING-001') };
});
vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.query,
  useMutation: () => ({ mutate: mocks.verify, isPending: false }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(() => { throw new Error('No external API in unit tests'); }) } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  isAdmin: false, isTransportista: true, currentUser: { nombre: 'QA Transporte', sector: 'Empresa QA' },
}) }));
vi.mock('../../hooks/useDashboard', () => ({ useDashboardStats: () => ({ data: { estadisticas: { entregados: 0, enTransito: 1, aprobados: 1, recibidos: 0 }, enTransitoList: [] } }) }));
vi.mock('../../hooks/useInspectionOperations', () => ({ useInspectionOperations: () => ({ data: { total: 0 } }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: (filter: { estado?: string }) => filter.estado === 'EN_TRANSITO' ? mocks.active : mocks.pending }));
vi.mock('../../hooks/useMobilePrefix', () => ({ useMobilePrefix: () => ((route: string) => route) }));
vi.mock('../../hooks/useGeneradores', () => ({ useGeneradores: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useOperadores', () => ({ useOperadores: () => ({ data: { items: [] } }) }));
vi.mock('../../utils/exportPdf', () => ({ exportReportePDF: vi.fn() }));
vi.mock('../../pages/reportes/tabs/shared', () => ({ downloadCsv: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.query.mockReturnValue({ data: { manifiestos: [], total: 0 }, isLoading: false }); });
afterEach(cleanup);

it('keeps live status readable on its tinted background and refresh operational', () => {
  const refresh = vi.fn();
  render(<ControlFilters countdown={30} datePreset={7} fechaDesde="2026-09-29" fechaHasta="2026-10-05" onManualRefresh={refresh} onDatePreset={vi.fn()} onFechaDesde={vi.fn()} onFechaHasta={vi.fn()} />);
  expect(screen.getByText('LIVE')).toHaveClass('text-red-700');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
  expect(refresh).toHaveBeenCalledOnce();
});

it('keeps PDF export text readable on the error-tinted button', () => {
  render(<MemoryRouter><ManifiestosPage /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'PDF', exact: true })).toHaveClass('text-error-700');
});

it('uses readable, touch-sized certification controls with a semantic selected filter', () => {
  render(<MemoryRouter><AdminBlockchainPage /></MemoryRouter>);
  const verify = screen.getByRole('button', { name: 'Verificar Integridad' });
  expect(verify).toHaveClass('bg-emerald-700', 'min-h-11');
  expect(screen.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Pendientes', exact: true }));
  expect(screen.getByRole('button', { name: 'Pendientes', exact: true })).toHaveClass('bg-emerald-700', 'min-h-11');
  expect(screen.getByRole('button', { name: 'Pendientes', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(verify);
  expect(mocks.verify).toHaveBeenCalledOnce();
});

it('keeps active and assigned trip references readable without changing their meaning', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  expect(screen.getByText('#QA-ACTIVE-001')).toHaveClass('text-success-700');
  expect(screen.getByText('Pendientes de retiro')).toHaveClass('text-warning-700');
  expect(screen.getByRole('button', { name: 'Ir al Viaje' })).toBeEnabled();
  expect(screen.getByRole('button', { name: /#QA-PENDING-001/ })).toBeEnabled();
});

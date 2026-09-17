import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileDashboardPage from '../../pages/mobile/MobileDashboardPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), refetch: vi.fn(), trips: vi.fn(),
  role: 'ADMIN', data: undefined as unknown, error: false, loading: false,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa', rol: mocks.role, nombre: 'QA' }, isAuditor: mocks.role === 'AUDITOR' }) }));
vi.mock('../../hooks/useMobilePrefix', () => ({ useMobilePrefix: () => (path: string) => `/app${path}` }));
vi.mock('../../hooks/useDashboard', () => ({ useDashboardStats: () => ({ data: mocks.data, isError: mocks.error, isLoading: mocks.loading, refetch: mocks.refetch }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: mocks.trips }));

describe('Mobile dashboard production states', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    mocks.role = 'ADMIN'; mocks.error = false; mocks.loading = false;
    mocks.trips.mockReturnValue({ data: undefined });
    mocks.data = { estadisticas: { total: 19, borradores: 2, aprobados: 3, enTransito: 5, recibidos: 1, tratados: 8 }, recientes: [{ id: 'qa-manifest', numero: 'QA-001', estado: 'EN_TRANSITO' }] };
  });
  afterEach(cleanup);

  it('uses canonical API counts in cards, summary and real recent activity', () => {
    render(<MobileDashboardPage />);
    expect(screen.getByText('5 en tránsito')).toBeInTheDocument();
    expect(screen.getByText('5 por preparar o retirar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3 Aprobados' }));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/app/manifiestos?estado=APROBADO');
    fireEvent.click(screen.getByRole('button', { name: '2 Borradores' }));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/app/manifiestos?estado=BORRADOR');
    fireEvent.click(screen.getByRole('button', { name: /QA-001/ }));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/app/manifiestos/qa-manifest');
  });

  it.each(['TRANSPORTISTA', 'OPERADOR', 'AUDITOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'])('does not offer create to %s', role => {
    mocks.role = role; render(<MobileDashboardPage />);
    expect(screen.queryByRole('button', { name: 'Nuevo Manifiesto' })).not.toBeInTheDocument();
    expect(mocks.trips).toHaveBeenCalledWith(expect.anything(), { enabled: role === 'TRANSPORTISTA' });
  });

  it.each(['ADMIN', 'GENERADOR', 'ADMIN_GENERADOR'])('offers create to %s', role => {
    mocks.role = role; render(<MobileDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Manifiesto' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/manifiestos/nuevo');
  });

  it('does not present a failed request as zero activity and allows retry', () => {
    mocks.data = undefined; mocks.error = true; render(<MobileDashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Esto no significa que no haya manifiestos');
    expect(screen.queryByText('Sin actividad reciente')).not.toBeInTheDocument();
    expect(screen.getByText('— en tránsito')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it('labels retained data as stale on a refetch error', () => {
    mocks.error = true; render(<MobileDashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('última consulta');
    expect(screen.getByText('5 en tránsito')).toBeInTheDocument();
  });
});

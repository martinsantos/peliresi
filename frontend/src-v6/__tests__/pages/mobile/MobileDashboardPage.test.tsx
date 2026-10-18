import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileDashboardPage } from '../../../pages/mobile/MobileDashboardPage';
import { EstadoManifiesto } from '../../../types/models';

const navigateMock = vi.hoisted(() => vi.fn());
const manifiestosByEstado = vi.hoisted(() => new Map<string, unknown[]>());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      id: 'operador-1',
      rol: 'OPERADOR',
      nombre: 'Operador Sur',
    },
  }),
}));

vi.mock('../../../hooks/useDashboard', () => ({
  useDashboardStats: () => ({
    data: {
      estadisticas: {
        borradores: 12,
        aprobados: 7,
        enTransito: 17,
        entregados: 6,
        recibidos: 9,
        tratados: 88,
        total: 295,
      },
      recientes: [],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../../hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    isOnline: true,
    isApiReachable: true,
    lastOnline: new Date('2026-06-01T00:00:00Z'),
  }),
}));

vi.mock('../../../hooks/useManifiestos', () => ({
  useManifiestos: (filters?: { estado?: string }) => ({
    data: { items: filters?.estado ? manifiestosByEstado.get(filters.estado) || [] : [] },
  }),
}));

describe('MobileDashboardPage operator queue', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    manifiestosByEstado.clear();
  });

  it('includes manifests in treatment as pending operator actions', () => {
    manifiestosByEstado.set(EstadoManifiesto.EN_TRATAMIENTO, [
      {
        id: 'manifiesto-tratamiento-1',
        numero: 'M-TRAT-1',
        estado: EstadoManifiesto.EN_TRATAMIENTO,
        generador: { razonSocial: 'Generador Norte' },
      },
    ]);

    render(
      <MemoryRouter>
        <MobileDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Cargas por resolver' })).toBeInTheDocument();
    expect(screen.getByText('295')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('Cerrar tratamiento')).toBeInTheDocument();
    expect(screen.queryByText('Sin acciones de operador')).not.toBeInTheDocument();
    const deviceStatus = screen.getByText('Conexión y dispositivo');
    expect(deviceStatus).toBeInTheDocument();
    deviceStatus.click();
    expect(screen.getByText('Conectado al servidor')).toBeInTheDocument();
    expect(screen.queryByText('Score operativo Android')).not.toBeInTheDocument();
  });
});

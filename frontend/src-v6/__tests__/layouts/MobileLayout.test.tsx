import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileLayout } from '../../layouts/MobileLayout';

const authState = vi.hoisted(() => ({
  currentUser: {
    id: 17,
    rol: 'TRANSPORTISTA',
    nombre: 'Transporte Test',
    email: 'transporte@test.com',
    sector: 'Ruta Norte',
    avatar: 'TT',
    telefono: '',
    ubicacion: '',
    permisos: [],
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: authState.currentUser,
    users: [authState.currentUser],
    switchUser: vi.fn(),
    logout: vi.fn(),
    isAdmin: false,
    isGenerador: false,
    isTransportista: authState.currentUser.rol === 'TRANSPORTISTA',
    isOperador: false,
    isLoading: false,
    isDemo: false,
  }),
}));

vi.mock('../../hooks/useActiveTripRecovery', () => ({
  useActiveTripRecovery: vi.fn(),
}));

vi.mock('../../hooks/useOfflineSync', () => ({
  useOfflineSync: vi.fn(),
}));

vi.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('../../components/ConnectivityIndicator', () => ({
  ConnectivityIndicator: () => <div data-testid="connectivity-indicator" />,
}));

vi.mock('../../components/SWUpdateBanner', () => ({
  SWUpdateBanner: () => null,
}));

vi.mock('../../components/InstallPWAButton', () => ({
  InstallPWAButton: () => <button type="button">Instalar</button>,
}));

vi.mock('../../components/InstallPWAModal', () => ({
  InstallPWAModal: () => null,
}));

vi.mock('../../components/NotificacionesPoller', () => ({
  NotificacionesPoller: () => null,
}));

vi.mock('../../components/ui/Toast', () => ({
  ToastContainer: () => null,
  toast: { add: vi.fn() },
}));

function renderMobileLayout(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<MobileLayout />}>
          <Route path="dashboard" element={<div data-testid="dashboard-content">Dashboard</div>} />
          <Route path="transporte/viaje/:id" element={<div data-testid="trip-content">Trip</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('MobileLayout Android shell', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.currentUser = { ...authState.currentUser, rol: 'TRANSPORTISTA' };
  });

  it('uses a short transportista bottom navigation label', () => {
    renderMobileLayout('/dashboard');

    expect(screen.getByText('Viajes')).toBeInTheDocument();
    expect(screen.queryByText('Mis Viajes')).not.toBeInTheDocument();
  });

  it('shows an accessible active trip return surface outside trip mode', async () => {
    localStorage.setItem('sitrep_active_trip_id', 'trip-123');

    renderMobileLayout('/dashboard');

    expect(await screen.findByRole('button', { name: 'Volver al viaje en curso' })).toBeInTheDocument();
  });

  it('reduces bottom padding on the field trip route', () => {
    renderMobileLayout('/transporte/viaje/trip-123');

    const outletContainer = screen.getByTestId('trip-content').parentElement;
    expect(outletContainer).toHaveClass('pb-6');
    expect(outletContainer).not.toHaveClass('pb-28');
  });
});

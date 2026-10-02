import { fireEvent, render, screen } from '@testing-library/react';
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
const impersonationState = vi.hoisted(() => ({
  data: null as null | { impersonatedUser: { nombre: string } },
  exit: vi.fn(),
}));

vi.mock('../../contexts/ImpersonationContext', () => ({
  useImpersonation: () => ({ impersonationData: impersonationState.data, exitImpersonation: impersonationState.exit }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: authState.currentUser,
    users: [authState.currentUser],
    switchUser: vi.fn(),
    logout: vi.fn(),
    isAdmin: authState.currentUser.rol === 'ADMIN',
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
  useOfflineSync: vi.fn(() => ({ processed: 0, pending: 0, retryable: 0, terminal: 0, auth: 0, skipped: 0, syncing: false, retry: vi.fn() })),
}));

vi.mock('../../hooks/useNotificaciones', () => ({
  useNotificacionesNoLeidas: vi.fn(() => ({ data: 0 })),
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
          <Route path="notificaciones" element={<div>Bandeja de avisos</div>} />
          <Route path="transporte/viaje/:id" element={<div data-testid="trip-content">Trip</div>} />
          <Route path="admin/actores/generadores/:id" element={<div>Ficha del generador</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('MobileLayout Android shell', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.currentUser = { ...authState.currentUser, rol: 'TRANSPORTISTA' };
    impersonationState.data = null;
    impersonationState.exit.mockClear();
  });

  it('uses a short transportista bottom navigation label', () => {
    renderMobileLayout('/dashboard');

    expect(screen.getByText('Viajes')).toBeInTheDocument();
    expect(screen.queryByText('Mis Viajes')).not.toBeInTheDocument();
  });

  it('uses the short Avisos title so the app header retains room for role and bell', () => {
    renderMobileLayout('/notificaciones');
    expect(screen.getByRole('banner')).toHaveTextContent('Avisos');
    expect(screen.getByRole('banner')).not.toHaveTextContent('Notificaciones');
  });

  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('keeps active navigation green for %s without changing the role', role => {
    authState.currentUser = { ...authState.currentUser, rol: role };
    renderMobileLayout('/notificaciones');
    const noticeLink = screen.getByRole('link', { name: 'Avisos', exact: true });
    expect(noticeLink).toHaveAttribute('aria-current', 'page');
    expect(noticeLink).toHaveClass('text-primary-800', 'bg-primary-50', 'border-current');
    expect(screen.getByRole('banner')).toHaveTextContent(role === 'GENERADOR' ? 'Generador' : role === 'OPERADOR' ? 'Operador' : 'Transportista');
  });

  it('keeps menu destinations at least 44px with visible keyboard focus', () => {
    renderMobileLayout('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    const link = screen.getByRole('link', { name: 'Todos los Manifiestos', exact: true });
    expect(link).toHaveClass('min-h-11', 'focus-visible:outline-2', 'transition-colors');
  });

  it('identifies the generator category on its canonical detail route', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'ADMIN' };
    renderMobileLayout('/admin/actores/generadores/qa-generator');
    expect(screen.getByRole('banner')).toHaveTextContent('Generadores');
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    const link = screen.getByRole('link', { name: 'Generadores', exact: true });
    expect(link).toHaveAttribute('href', '/admin/actores/generadores');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('bg-primary-50', 'text-primary-900');
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

  it('does not offer account switching to an operator', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'OPERADOR' };
    renderMobileLayout('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByText('Ver como otro usuario')).not.toBeInTheDocument();
  });

  it('shows a readable return action during temporary access', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'OPERADOR' };
    impersonationState.data = { impersonatedUser: { nombre: 'Operador QA' } };
    renderMobileLayout('/dashboard');
    expect(screen.getByTestId('impersonation-banner')).toHaveTextContent('Operador QA');
    fireEvent.click(screen.getByTestId('exit-impersonation'));
    expect(impersonationState.exit).toHaveBeenCalledOnce();
  });
});

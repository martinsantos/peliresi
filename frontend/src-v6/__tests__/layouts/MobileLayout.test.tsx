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
    esInspector: false,
  },
}));
const impersonationState = vi.hoisted(() => ({
  data: null as null | { impersonatedUser: { nombre: string } },
  exit: vi.fn(),
}));
const notices = vi.hoisted(() => ({ unread: 0 }));

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
    isGenerador: authState.currentUser.rol === 'GENERADOR',
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
  useNotificacionesNoLeidas: vi.fn(() => ({ data: notices.unread })),
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
          <Route path="manifiestos" element={<div>Listado de manifiestos</div>} />
          <Route path="manifiestos/nuevo" element={<div>Formulario de nuevo manifiesto</div>} />
          <Route path="manifiestos/:id" element={<div>Detalle del manifiesto</div>} />
          <Route path="transporte/viaje/:id" element={<div data-testid="trip-content">Trip</div>} />
          <Route path="admin/actores/generadores/:id" element={<div>Ficha del generador</div>} />
          <Route path="inspecciones/:id" element={<div>Expediente de campo</div>} />
          <Route path="mis-inspecciones/:id" element={<div>Inspección del actor</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('MobileLayout Android shell', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.currentUser = { ...authState.currentUser, rol: 'TRANSPORTISTA', esInspector: false };
    impersonationState.data = null;
    impersonationState.exit.mockClear();
    notices.unread = 0;
  });

  it('uses a short transportista bottom navigation label', () => {
    renderMobileLayout('/dashboard');

    expect(screen.getByText('Viajes')).toBeInTheDocument();
    expect(screen.queryByText('Mis Viajes')).not.toBeInTheDocument();
  });

  it('keeps the small bottom-navigation unread counter readable', () => {
    notices.unread = 14;
    renderMobileLayout('/dashboard');
    expect(screen.getByText('9+', { exact: true })).toHaveClass('bg-error-700', 'text-white');
    expect(screen.getByRole('link', { name: /Avisos/ })).toHaveAttribute('href', '/notificaciones');
  });

  it('uses the same readable unread token in the expanded menu without changing its count', () => {
    notices.unread = 14;
    renderMobileLayout('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.getByText('14', { exact: true })).toHaveClass('bg-error-700', 'text-white');
  });

  it.each(['ADMIN', 'GENERADOR'])('keeps the list create action working for %s', role => {
    authState.currentUser = { ...authState.currentUser, rol: role };
    renderMobileLayout('/manifiestos');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo manifiesto', exact: true }));
    expect(screen.getByText('Formulario de nuevo manifiesto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo manifiesto', exact: true })).not.toBeInTheDocument();
  });

  it.each([
    ['ADMIN', '/manifiestos/qa-record'],
    ['GENERADOR', '/manifiestos/qa-record'],
    ['ADMIN', '/manifiestos/nuevo'],
    ['GENERADOR', '/manifiestos/nuevo'],
  ])('does not overlay %s work with a create action on %s', (role, path) => {
    authState.currentUser = { ...authState.currentUser, rol: role };
    renderMobileLayout(path);
    expect(screen.queryByRole('button', { name: 'Nuevo manifiesto', exact: true })).not.toBeInTheDocument();
  });
  it('uses the same operational inspector label and exposes its unchanged base role', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'GENERADOR', esInspector: true };
    renderMobileLayout('/inspecciones/qa-expediente');
    const badge = screen.getByRole('banner').querySelector('[aria-label="Función actual"]');
    expect(badge).toHaveTextContent(/^Inspector$/);
    expect(badge).toHaveAttribute('title', 'Rol base: GENERADOR');
    expect(authState.currentUser.rol).toBe('GENERADOR');
  });
  it('does not reinterpret the actor own inspection route as inspector work', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'GENERADOR', esInspector: true };
    renderMobileLayout('/mis-inspecciones/qa-expediente');
    expect(screen.getByRole('banner').querySelector('[aria-label="Función actual"]')).toHaveTextContent(/^Generador$/);
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

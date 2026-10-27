import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileLayout } from '../../layouts/MobileLayout';
const attentionState = vi.hoisted(() => ({ support: 0, applicationPending: 0, supportState: 'ready', applicationsState: 'ready' }));
vi.mock('../../hooks/useAttentionCounts', () => ({ useAttentionCounts: () => attentionState }));

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
    training: false,
  },
}));
const impersonationState = vi.hoisted(() => ({
  data: null as null | { impersonatedUser: { nombre: string } },
  exit: vi.fn(),
}));
const notices = vi.hoisted(() => ({ unread: 0 }));
const logout = vi.hoisted(() => vi.fn());
const support = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../services/support.service', () => ({ supportService: support, supportError: () => 'No se confirmó el ticket.' }));

vi.mock('../../contexts/ImpersonationContext', () => ({
  useImpersonation: () => ({ impersonationData: impersonationState.data, exitImpersonation: impersonationState.exit }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: authState.currentUser,
    users: [authState.currentUser],
    switchUser: vi.fn(),
    logout,
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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<MobileLayout />}>
          <Route path="dashboard" element={<div data-testid="dashboard-content">Dashboard</div>} />
          <Route path="centro-control" element={<div>Centro de Control</div>} />
          <Route path="monitor" element={<div>Monitor</div>} />
          <Route path="actores" element={<div>Consulta de actores</div>} />
          <Route path="notificaciones" element={<div>Bandeja de avisos</div>} />
          <Route path="notificaciones/:id" element={<div>Resultado del aviso</div>} />
          <Route path="app/notificaciones/:id" element={<div>Resultado del aviso app</div>} />
          <Route path="manifiestos" element={<div>Listado de manifiestos</div>} />
          <Route path="app/manifiestos" element={<div>Listado app</div>} />
          <Route path="mobile/manifiestos" element={<div>Listado móvil</div>} />
          <Route path="transporte/perfil" element={<div>Mis viajes</div>} />
          <Route path="manifiestos/nuevo" element={<div>Formulario de nuevo manifiesto</div>} />
          <Route path="manifiestos/:id" element={<div>Detalle del manifiesto</div>} />
          <Route path="manifiestos/:id/adendas" element={<div>Adendas</div>} />
          <Route path="app/manifiestos/:id/adendas" element={<div>Adendas app</div>} />
          <Route path="mobile/manifiestos/:id/adendas" element={<div>Adendas móvil</div>} />
          <Route path="transporte/viaje/:id" element={<div data-testid="trip-content">Trip</div>} />
          <Route path="transporte/cargas" element={<div>Cargas de este móvil</div>} />
          <Route path="app/transporte/cargas" element={<div>Cargas app</div>} />
          <Route path="mobile/transporte/cargas" element={<div>Cargas móvil</div>} />
          <Route path="admin/actores/generadores/:id" element={<div>Ficha del generador</div>} />
          <Route path="admin/actores/transportistas/:id" element={<div>Ficha del transportista</div>} />
          <Route path="admin/actores/operadores/:id" element={<div>Ficha del operador</div>} />
          <Route path="inspecciones" element={<div>Agenda de inspecciones</div>} />
          <Route path="inspecciones/:id" element={<div>Expediente de campo<textarea aria-label="Observación QA" /></div>} />
          <Route path="mis-inspecciones/:id" element={<div>Inspección del actor</div>} />
          <Route path="soporte/:id" element={<div>Ticket confirmado</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
    </QueryClientProvider>
  );
}

function SignedOutLocation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="signed-out-location">{location.pathname}:{JSON.stringify(location.state)}</output><button onClick={() => navigate(-1)}>Atrás de prueba</button></>;
}

it.each(['', '/app', '/mobile'])('explicit sign-out replaces the old private location without waiting for the server (%s)', async prefix => {
  authState.currentUser.rol = 'ADMIN';
  logout.mockReturnValueOnce(new Promise(() => {}));
  const basename = prefix === '/app' ? '/app' : '/';
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter basename={basename} initialEntries={[prefix + '/dashboard', { pathname: prefix + '/inspecciones/old-account', search: '?vista=plazos', hash: '#intercambios', state: { from: '/admin/usuarios' } }]}>
      <Routes>
        <Route path={prefix === '/mobile' ? '/mobile/login' : '/login'} element={<SignedOutLocation />} />
        <Route path="*" element={<MobileLayout />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /cerrar sesi[oó]n/i }));
  await waitFor(() => expect(screen.getByTestId('signed-out-location')).toHaveTextContent((prefix === '/mobile' ? '/mobile/login' : '/login') + ':null'));
  expect(logout).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Atrás de prueba' }));
  expect(screen.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();
});

describe('MobileLayout Android shell', () => {
  it.each(['generadores','transportistas','operadores'])('keeps %s creation help above the form',kind=>{
    authState.currentUser.rol='ADMIN';
    renderMobileLayout('/admin/actores/'+kind+'/nuevo');
    const help=screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true});
    expect(help.closest('header')).toBe(screen.getByRole('banner'));
    expect(help.parentElement).not.toHaveClass('fixed');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sitrep_access_token', 'unit.' + btoa(JSON.stringify({ id: String(authState.currentUser.id) })) + '.not-a-credential');
    authState.currentUser = { ...authState.currentUser, rol: 'TRANSPORTISTA', esInspector: false };
    impersonationState.data = null;
    authState.currentUser.training = false;
    impersonationState.exit.mockClear();
    notices.unread = 0;
    support.create.mockReset(); support.create.mockResolvedValue({ id: 'ticket' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('selects only the deepest administrative destination in the drawer',()=>{
    authState.currentUser.rol='ADMIN';
    renderMobileLayout('/admin/actores/generadores/qa');
    fireEvent.click(screen.getByRole('button',{name:/abrir menu/i}));
    expect(screen.getByRole('link',{name:'Generadores',exact:true})).toHaveAttribute('aria-current','page');
    expect(screen.getByRole('link',{name:'Actores',exact:true})).not.toHaveAttribute('aria-current');
  });
  it.each(['/transporte/viaje/qa','/transporte/cargas'])('retains the Viajes destination at %s',path=>{
    renderMobileLayout(path);
    const navigation=screen.getByRole('navigation',{name:'Navegación principal'});
    expect(within(navigation).getByRole('link',{name:'Viajes',exact:true})).toHaveAttribute('aria-current','page');
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
  it.each(['/manifiestos','/manifiestos/qa'])('keeps the transport manifest section visible at %s',path=>{
    renderMobileLayout(path);
    const navigation=screen.getByRole('navigation',{name:'Navegación principal'});
    expect(within(navigation).getByRole('link',{name:'Manifiestos',exact:true})).toHaveAttribute('aria-current','page');
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:/abrir menu/i}));
    expect(screen.getByRole('link',{name:'Reportes',exact:true})).toBeVisible();
  });
  it('labels a direct CAP login and offers no return to a personal administrator',()=>{
    authState.currentUser.training=true;authState.currentUser.rol='ADMIN';renderMobileLayout();
    expect(screen.getByRole('status',{name:'Modo capacitación'})).toHaveTextContent('Capacitación · sin validez oficial');
    expect(screen.queryByText('Volver a mi cuenta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/abrir menu/i}));
    expect(screen.queryByRole('link',{name:'Ver como otro usuario'})).not.toBeInTheDocument();
  });
  it('has one support destination rather than competing support entries', () => {
    renderMobileLayout('/dashboard');
    fireEvent.click(screen.getByRole('button', {name:/abrir menu/i}));
    expect(screen.getAllByRole('link',{name:'Soporte',exact:true})).toHaveLength(1);
    expect(screen.queryByRole('button',{name:'Reportar problema',exact:true})).toBeNull();
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
  });

  it('offers contextual help above navigation and hides it while the menu is open', () => {
    renderMobileLayout('/dashboard');
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByRole('button', { name: 'Ayuda y soporte técnico', exact: true })).not.toBeInTheDocument();
  });
  it('keeps help outside the inspection agenda fields', () => {
    renderMobileLayout('/inspecciones?vista=agenda');
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true }).closest('header')).toBe(screen.getByRole('banner'));
  });
  it('moves inspection help into the header rather than over the save bar', () => {
    renderMobileLayout('/inspecciones/qa-expediente');
    const button = screen.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
    expect(screen.getByRole('heading', { name: 'Inspección', exact: true })).toBeVisible();
    expect(button.closest('header')).toBe(screen.getByRole('banner'));
    expect(button.parentElement).not.toHaveClass('fixed');
    expect(screen.queryByRole('navigation', { name: /principal/i })).not.toBeInTheDocument();
  });

  it('keeps the inspection header and notice outlet in the panned keyboard viewport without replacing the editor', () => {
    const viewport = Object.assign(new EventTarget(), { height: 783, width: 393, offsetTop: 0, offsetLeft: 0, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    const remove = vi.spyOn(viewport, 'removeEventListener');
    const view = renderMobileLayout('/inspecciones/qa-expediente');
    const shell = screen.getByRole('banner').closest('[data-app-shell]') as HTMLElement;
    const input = screen.getByRole('textbox', { name: 'Observación QA' }); input.focus();
    fireEvent.change(input, { target: { value: 'Comentario conservado' } });
    act(() => { viewport.height = 471; viewport.offsetTop = 190; viewport.dispatchEvent(new Event('resize')); });
    expect(shell).toHaveStyle({ position: 'fixed', top: '190px', height: '471px' });
    expect(input).toHaveFocus(); expect(input).toHaveValue('Comentario conservado');
    act(() => { viewport.offsetTop = 120; viewport.dispatchEvent(new Event('scroll')); });
    expect(shell.style.top).toBe('120px');
    act(() => { viewport.height = 0; viewport.dispatchEvent(new Event('resize')); });
    expect(shell.style.height).toBe('471px');
    act(() => { viewport.height = 783; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')); });
    expect(shell).toHaveStyle({ top: '0px', height: '783px' });
    expect(screen.getByRole('textbox', { name: 'Observación QA' })).toBe(input);
    view.unmount(); expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(shell.style.height).toBe('');
  });

  it('leaves ordinary pages and pinch zoom under browser control', () => {
    const viewport = Object.assign(new EventTarget(), { height: 471, width: 393, offsetTop: 90, offsetLeft: 0, scale: 2 });
    vi.stubGlobal('visualViewport', viewport);
    const view = renderMobileLayout('/inspecciones/qa-expediente');
    expect(screen.getByRole('banner').closest('[data-app-shell]')).not.toHaveStyle({ position: 'fixed' });
    view.unmount(); viewport.scale = 1;
    renderMobileLayout('/dashboard');
    expect(screen.getByRole('banner').closest('[data-app-shell]')).not.toHaveStyle({ position: 'fixed' });
  });

  it.each(['/manifiestos/qa/adendas', '/app/manifiestos/qa/adendas'])('keeps the addenda shell visible after native viewer restoration on %s', route => {
    const viewport = Object.assign(new EventTarget(), { height: 783, width: 393, offsetTop: 0, offsetLeft: 0, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    const view = renderMobileLayout(route);
    const shell = screen.getByRole('banner').closest('[data-app-shell]') as HTMLElement;
    const content = screen.getByText(route.startsWith('/app') ? 'Adendas app' : 'Adendas');
    expect(shell).toHaveStyle({ position: 'fixed', top: '0px', height: '783px' });
    act(() => { viewport.height = 720; viewport.offsetTop = 42; viewport.dispatchEvent(new Event('scroll')); });
    expect(shell).toHaveStyle({ top: '42px', height: '720px' });
    expect(screen.getByText(content.textContent!)).toBe(content);
    act(() => { viewport.scale = 2; viewport.dispatchEvent(new Event('resize')); });
    expect(shell.style.position).toBe('');
    view.unmount();
    expect(shell.style.height).toBe('');
  });

  it('keeps contextual help on the working screen without needing the menu',()=>{
    renderMobileLayout('/manifiestos/qa-manifiesto');
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico'}).closest('header')).toBe(screen.getByRole('banner'));
    expect(screen.queryByRole('navigation',{name:'Menú de la aplicación'})).toBeNull();
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

  it.each(['ADMIN', 'GENERADOR'])('leaves creation to the list instead of overlaying its rows for %s', role => {
    authState.currentUser = { ...authState.currentUser, rol: role };
    renderMobileLayout('/manifiestos');
    expect(screen.getByText('Listado de manifiestos')).toBeVisible();
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
  it.each(['/dashboard', '/manifiestos', '/app/manifiestos', '/mobile/manifiestos', '/transporte/perfil', '/manifiestos/nuevo', '/manifiestos/qa-record', '/transporte/viaje/qa-trip', '/transporte/cargas', '/app/transporte/cargas', '/mobile/transporte/cargas', '/manifiestos/qa-record/adendas', '/app/manifiestos/qa-record/adendas', '/mobile/manifiestos/qa-record/adendas'])('keeps technical help reachable without covering form/trip controls on %s', path => {
    renderMobileLayout(path);
    const help = screen.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true });
    expect(help.closest('header')).toBe(screen.getByRole('banner'));
    expect(help.parentElement).not.toHaveClass('fixed');
    expect(help).toHaveClass('h-11', 'w-11');
  });
  it.each(['/notificaciones', '/notificaciones/qa', '/app/notificaciones/qa'])('keeps notice help in the header and one screen title on %s', path => {
    renderMobileLayout(path);
    expect(screen.getByRole('button', { name: 'Ayuda y soporte técnico', exact: true }).closest('header')).toBe(screen.getByRole('banner'));
    expect(screen.getByRole('banner').querySelector('h1')).toHaveTextContent(path.endsWith('/qa') ? 'Aviso recibido' : 'Avisos');
  });
  it('does not reinterpret the actor own inspection route as inspector work', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'GENERADOR', esInspector: true };
    renderMobileLayout('/mis-inspecciones/qa-expediente');
    expect(screen.getByRole('banner').querySelector('h1')).toHaveTextContent(/^Requerimiento$/);
    expect(screen.getByRole('button',{name:'Ayuda y soporte técnico',exact:true}).closest('header')).toBe(screen.getByRole('banner'));
    expect(screen.getByRole('banner').querySelector('[aria-label="Función actual"]')).toHaveTextContent(/^Generador$/);
  });

  it.each(['/dashboard', '/centro-control', '/monitor', '/actores'])('identifies inspection work on %s without changing the base role', path => {
    authState.currentUser = { ...authState.currentUser, rol: 'GENERADOR', esInspector: true };
    renderMobileLayout(path);
    const badge = screen.getByRole('banner').querySelector('[aria-label="Función actual"]');
    expect(badge).toHaveTextContent(/^Inspector$/);
    expect(badge).toHaveAttribute('title', 'Rol base: GENERADOR');
    expect(authState.currentUser.rol).toBe('GENERADOR');
  });

  it('uses the short Avisos title so the app header retains room for role and bell', () => {
    renderMobileLayout('/notificaciones');
    expect(screen.getByRole('banner')).toHaveTextContent('Avisos');
    expect(screen.getByRole('banner')).not.toHaveTextContent('Notificaciones');
  });

  it('keeps a complete long page title and sector role in a stable header frame', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'ADMIN_GENERADOR' };
    renderMobileLayout('/manifiestos/nuevo');
    const header = screen.getByRole('banner');
    expect(header.querySelector('h1')).toHaveClass('whitespace-normal', 'break-words');
    expect(header.querySelector('h1')).not.toHaveClass('truncate');
    expect(header.firstElementChild).toHaveClass('min-h-16', 'py-2');
    expect(header.firstElementChild).not.toHaveClass('h-16');
    expect(header.querySelector('h1')).toHaveClass('w-full');
    expect(header.querySelector('[aria-label="Función actual"]')).toHaveTextContent('Adm. Generadores');
    const badge = header.querySelector('[aria-label="Función actual"]');
    expect(badge).toHaveClass('w-fit', 'max-w-full', 'break-normal');
    expect(badge?.parentElement).toBe(header.querySelector('h1')?.parentElement);
    expect(badge?.parentElement).toHaveClass('min-w-0', 'flex-1', 'flex-col');
    expect(header.querySelector('[aria-label="Función actual"]')).not.toHaveClass('break-words', 'max-w-24');
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
    const link = within(screen.getByRole('navigation', { name: 'Menú de la aplicación' })).getByRole('link', { name: 'Manifiestos', exact: true });
    expect(link).toHaveClass('min-h-11', 'focus-visible:outline-2', 'transition-colors');
  });

  it('identifies the generator category on its canonical detail route', () => {
    authState.currentUser = { ...authState.currentUser, rol: 'ADMIN' };
    renderMobileLayout('/admin/actores/generadores/qa-generator');
    expect(screen.getByRole('banner')).toHaveTextContent('Ficha del generador');
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    const link = screen.getByRole('link', { name: 'Generadores', exact: true });
    expect(link).toHaveAttribute('href', '/admin/actores/generadores');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('bg-primary-50', 'text-primary-900');
  });

  it('keeps one stable Viajes destination rather than adding a stale last-trip duplicate', async () => {
    localStorage.setItem('sitrep_active_trip_id', 'trip-123');

    renderMobileLayout('/dashboard');

    expect(screen.queryByRole('button', { name: 'Volver al viaje en curso' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByRole('link', { name: 'Último viaje abierto' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Viajes', exact:true }).every(link=>link.getAttribute('href')==='/transporte/perfil')).toBe(true);
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


it('shows application pending totals and failure state in the administrative app menu', async () => {
  authState.currentUser.rol = 'ADMIN'; attentionState.applicationPending = 12;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const content = <QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><MobileLayout /></MemoryRouter></QueryClientProvider>;
  const view = render(content);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
  const link = screen.getByRole('link', { name: /Solicitudes/ });
  expect(within(link).getByLabelText('12 pendientes de atender')).toBeVisible();
  attentionState.applicationsState = 'error';
  view.rerender(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><MobileLayout /></MemoryRouter></QueryClientProvider>);
  expect(within(link).getByLabelText(/Cantidad de pendientes no disponible/)).toBeVisible();
  expect(within(link).queryByText('12')).toBeNull();
  attentionState.applicationPending = 0; attentionState.applicationsState = 'ready'; client.clear();
});

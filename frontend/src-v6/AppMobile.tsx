/**
 * SITREP v6 - Mobile App Router
 * ==============================
 * Router para la PWA mobile (/app)
 * Todas las rutas usan MobileLayout directamente
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MobileLayout } from './layouts/MobileLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { canVisitRoute } from './utils/routeAccess';
import { hasStoredImpersonationSession } from './utils/impersonationNavigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  activeTripStorageKey,
  gpsPendingStorageKey,
  tripSnapshotStorageKey,
  tripStatusStorageKey,
} from './utils/userContext';

// Pages — shared lazy imports (single source of truth with App.tsx)
import {
  LoginPage, ReclamarCuentaPage, RegistroPage, ForgotPasswordPage, ResetPasswordPage, UserSwitcherPage,
  MobileDashboardPage, CentroControlPage, InspeccionesPage, InspeccionDetallePage,
  ManifiestosPage, ManifiestoDetallePage, NuevoManifiestoPage, EditarManifiestoPage, VerificarManifiestoPage,
  TransportePerfilPage, ViajeEnCursoTransportista,
  ActoresPage, OperadoresPage, OperadorDetallePage, TransportistasPage, TransportistaDetallePage,
  ReportesPage, AlertasPage, NotificacionesPage, ConfiguracionPage,
  UsuariosPage, AdminGeneradoresPage, GeneradorDetallePage, NuevoGeneradorPage,
  AdminOperadoresPage, NuevoOperadorPage, NuevoTransportistaPage,
  AdminVehiculosPage, AdminResiduosPage, AdminTratamientosPage, AdminBlockchainPage,
  AdminRenovacionesPage, AdminSolicitudesPage, SolicitudDetallePage,
  AuditoriaPage, CargaMasivaPage, PerfilPage, SolicitarCambiosPage,
  AyudaPage, EscanerQRPage, EstadisticasPage,
  InscripcionWizardPage, MiSolicitudPage, VerificarCertificadoPage, NotFoundPage,
} from './routes/pages';

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-neutral-600 font-medium">Cargando SITREP...</p>
    </div>
  </div>
);

const TrackingRedirectMobile: React.FC = () => {
  const { id } = useParams();
  return <Navigate to={id ? `/manifiestos/${id}` : `/centro-control`} replace />;
};

// Redirect centro-control/viaje/:id → manifiestos/:id (unified single view)
const ViajeRedirectMobile: React.FC = () => {
  const { id } = useParams();
  return <Navigate to={`/manifiestos/${id}`} replace />;
};

// Auto-redirect to active trip when PWA reopens
const ActiveTripGuard: React.FC = () => {
  const { currentUser } = useAuth();
  const activeTripId = currentUser?.id != null
    ? localStorage.getItem(activeTripStorageKey(currentUser.id))
    : null;
  if (activeTripId) {
    // A3: Verify trip hasn't ended — if status is terminal, clean up and go to dashboard
    const savedStatus = localStorage.getItem(tripStatusStorageKey(currentUser!.id, activeTripId));
    const snapshot = localStorage.getItem(tripSnapshotStorageKey(currentUser!.id, activeTripId));
    let snapshotEstado: string | null = null;
    if (snapshot) {
      try { snapshotEstado = JSON.parse(snapshot)?.estado; } catch { /* ignore */ }
    }
    const terminalStates = ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'CANCELADO', 'RECHAZADO'];
    if ((snapshotEstado && terminalStates.includes(snapshotEstado)) || savedStatus === 'COMPLETED') {
      localStorage.removeItem(activeTripStorageKey(currentUser!.id));
      localStorage.removeItem(tripSnapshotStorageKey(currentUser!.id, activeTripId));
      localStorage.removeItem(tripStatusStorageKey(currentUser!.id, activeTripId));
      localStorage.removeItem(gpsPendingStorageKey(currentUser!.id, activeTripId));
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to={`/transporte/viaje/${activeTripId}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

/** Auth gate: single source of truth for public/private routing */
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading, isRestricted } = useAuth();
  const location = useLocation();

  // Public routes that don't need auth
  const publicPaths = ['/login', '/reclamar', '/manifiestos/verificar', '/certificados/verificar', '/inscripcion', '/registro', '/recuperar', '/reset-password'];
  const isPublic = publicPaths.some(p => location.pathname.startsWith(p));

  // While auth state is loading, show loader (even for public routes,
  // so we can redirect logged-in users away from /login once resolved)
  if (isLoading) return <PageLoader />;

  // Logged-in user on /login → redirect to dashboard
  if (currentUser && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  // Public route → render
  if (isPublic) return <>{children}</>;

  // Private route without auth → redirect to login
  if (!currentUser) return <Navigate to="/login" replace />;

  if (isRestricted && location.pathname !== '/mi-solicitud') return <Navigate to="/mi-solicitud" replace />;

  // An administrator inspecting a pending account must never be forced to
  // change that person's credentials. The real user still gets this gate.
  if (currentUser.forcePasswordChange && !hasStoredImpersonationSession() && !location.pathname.startsWith('/configuracion')) {
    return <Navigate to="/configuracion?tab=seguridad" replace />;
  }

  const inspectorRoute = Boolean(currentUser.esInspector) && location.pathname.startsWith('/inspecciones');
  if (!inspectorRoute && !canVisitRoute(currentUser.rol, location.pathname)) return <Navigate to="/dashboard" replace />;

  if (currentUser.rol === 'AUDITOR') {
    const path = location.pathname;
    if (path === '/') return <Navigate to="/dashboard" replace />;
    const exactAllowed = new Set([
      '/dashboard', '/manifiestos', '/reportes', '/alertas', '/ayuda', '/admin/auditoria',
      ...(currentUser.forcePasswordChange ? ['/configuracion'] : []),
    ]);
    const manifestDetail = /^\/manifiestos\/[^/]+$/.test(path) && !path.endsWith('/nuevo');
    if (!exactAllowed.has(path) && !manifestDetail) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

function AppMobile() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <AuthGate>
        <Routes>
          {/* Auth — public, sin layout */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reclamar" element={<ReclamarCuentaPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Mobile Routes - MobileLayout (auth handled by AuthGate above) */}
          <Route element={<MobileLayout />}>
            <Route path="/dashboard" element={<MobileDashboardPage />} />
            <Route path="/centro-control" element={<CentroControlPage />} />
            <Route path="/centro-control/viaje/:id" element={<ViajeRedirectMobile />} />
            <Route path="/manifiestos" element={<ManifiestosPage />} />
            <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
            <Route path="/manifiestos/:id/editar" element={<EditarManifiestoPage />} />
            <Route path="/manifiestos/:id" element={<ManifiestoDetallePage />} />
            <Route path="/inspecciones" element={<InspeccionesPage />} />
            <Route path="/inspecciones/:id" element={<InspeccionDetallePage />} />
            <Route path="/transporte/perfil" element={<TransportePerfilPage />} />
            <Route path="/transporte/viaje/:id" element={<ViajeEnCursoTransportista />} />
            {/* Actores overview */}
            <Route path="/actores" element={<ActoresPage />} />
            <Route path="/admin/actores" element={<ActoresPage />} />

            {/* Legacy paths (kept for compatibility with bookmarks/links) */}
            <Route path="/actores/operadores" element={<OperadoresPage />} />
            <Route path="/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/actores/transportistas/:id" element={<TransportistaDetallePage />} />

            {/* Canonical paths (match App.tsx web routes) */}
            <Route path="/admin/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/admin/actores/transportistas/nuevo" element={<NuevoTransportistaPage />} />
            <Route path="/admin/actores/transportistas/:id/editar" element={<NuevoTransportistaPage />} />
            <Route path="/admin/actores/transportistas/:id" element={<TransportistaDetallePage />} />

            <Route path="/admin/actores/operadores" element={<AdminOperadoresPage />} />
            <Route path="/admin/actores/operadores/nuevo" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id/editar" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id/renovar" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id" element={<OperadorDetallePage />} />

            <Route path="/admin/actores/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/admin/actores/generadores/nuevo" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id/editar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id/renovar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/notificaciones" element={<NotificacionesPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="/mi-perfil" element={<PerfilPage />} />
            <Route path="/mi-perfil/solicitar-cambios" element={<SolicitarCambiosPage />} />
            <Route path="/mi-solicitud" element={<MiSolicitudPage />} />
            <Route path="/ayuda" element={<AyudaPage />} />

            {/* Admin */}
            <Route path="/admin/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/admin/generadores/nuevo" element={<NuevoGeneradorPage />} />
            <Route path="/admin/generadores/:id/editar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/admin/operadores" element={<AdminOperadoresPage />} />
            <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
            <Route path="/admin/residuos" element={<AdminResiduosPage />} />
            <Route path="/admin/tratamientos" element={<AdminTratamientosPage />} />
            <Route path="/admin/blockchain" element={<AdminBlockchainPage />} />
            <Route path="/admin/renovaciones" element={<AdminRenovacionesPage />} />
            <Route path="/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />

            {/* Special */}
            <Route path="/escaner-qr" element={<EscanerQRPage />} />
            {/* Compatibility alias for links shared before the canonical QR route. */}
            <Route path="/escaner" element={<Navigate to="/escaner-qr" replace />} />
            <Route path="/estadisticas" element={<EstadisticasPage />} />
          </Route>

          {/* Sector admins may review only their own actor type.  Keep the
              guard in the PWA router as well as the API middleware. */}
          <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']} />}>
            <Route element={<MobileLayout />}>
              <Route path="/admin/solicitudes" element={<AdminSolicitudesPage />} />
              <Route path="/admin/solicitudes/:id" element={<SolicitudDetallePage />} />
            </Route>
          </Route>

          {/* Root admin only: user administration and impersonation */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route element={<MobileLayout />}>
              <Route path="/switch-user" element={<UserSwitcherPage />} />
              <Route path="/admin/usuarios" element={<UsuariosPage />} />
            </Route>
          </Route>

          {/* Inscripcion publica de actores */}
          <Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} />
          <Route path="/certificados/verificar/:token" element={<VerificarCertificadoPage />} />

          {/* Verificación pública de manifiesto (QR) */}
          <Route path="/manifiestos/verificar/:numero" element={<VerificarManifiestoPage />} />

          {/* Root redirect */}
          <Route path="/" element={<ActiveTripGuard />} />

          {/* Legacy tracking redirects */}
          <Route path="/tracking" element={<Navigate to="/centro-control" replace />} />
          <Route path="/tracking/viaje/:id" element={<TrackingRedirectMobile />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AuthGate>
      </Suspense>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default AppMobile;

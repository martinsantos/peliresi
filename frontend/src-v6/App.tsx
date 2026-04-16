/**
 * SITREP v6 - App Router
 * ======================
 * Routing principal con todas las páginas
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';

// ========================================
// CONTEXTS & COMPONENTS
// ========================================
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// ========================================
// LAYOUTS
// ========================================
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { MobileLayout } from './layouts/MobileLayout';

// ========================================
// PAGES — shared lazy imports (single source of truth)
// ========================================
import {
  LoginPage, LandingPage, RegistroPage, VerificarEmailPage, ForgotPasswordPage,
  ResetPasswordPage, ReclamarCuentaPage, UserSwitcherPage,
  DashboardPage, CentroControlPage, WarRoomPage,
  ManifiestosPage, ManifiestoDetallePage, NuevoManifiestoPage, EditarManifiestoPage, VerificarManifiestoPage,
  ViajeEnCursoPage, TransportePerfilPage, ViajeEnCursoTransportista,
  ActoresPage, OperadoresPage, OperadorDetallePage, TransportistasPage, TransportistaDetallePage,
  ReportesPage, AlertasPage, ConfiguracionPage,
  UsuariosPage, AdminGeneradoresPage, GeneradorDetallePage, NuevoGeneradorPage,
  AdminOperadoresPage, NuevoOperadorPage, NuevoTransportistaPage,
  AdminRenovacionesPage, AdminVehiculosPage, AdminResiduosPage, AdminTratamientosPage, AdminBlockchainPage,
  AdminSolicitudesPage, SolicitudDetallePage,
  AuditoriaPage, CargaMasivaPage, PerfilPage, SolicitarCambiosPage,
  MobileDashboardPage, NotificacionesPage, AyudaPage, EscanerQRPage, EstadisticasPage,
  InscripcionWizardPage, MiSolicitudPage, NotFoundPage,
} from './routes/pages';

// ========================================
// COMPONENTE DE CARGA
// ========================================
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-neutral-600 font-medium">Cargando SITREP v6...</p>
    </div>
  </div>
);

// ========================================
// TRACKING REDIRECT (legacy routes → centro-control)
// ========================================
const TrackingRedirect: React.FC = () => {
  const { id } = useParams();
  const loc = useLocation();
  const prefix = loc.pathname.startsWith('/mobile') ? '/mobile' : '';
  return <Navigate to={id ? `${prefix}/manifiestos/${id}` : `${prefix}/centro-control`} replace />;
};

// Legacy /v6/ QR redirect
const V6VerificarRedirect: React.FC = () => {
  const { numero } = useParams();
  return <Navigate to={`/manifiestos/verificar/${numero}`} replace />;
};

// Redirect centro-control/viaje/:id → manifiestos/:id (unified single view)
const ViajeRedirect: React.FC = () => {
  const { id } = useParams();
  const loc = useLocation();
  const prefix = loc.pathname.startsWith('/mobile') ? '/mobile' : '';
  return <Navigate to={`${prefix}/manifiestos/${id}`} replace />;
};

// ========================================
// APP COMPONENT
// ========================================
function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/verificar-email" element={<VerificarEmailPage />} />
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reclamar" element={<ReclamarCuentaPage />} />
          <Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} />
        </Route>

        {/* Mobile Routes - Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile" element={<MobileDashboardPage />} />
            <Route path="/mobile/dashboard" element={<MobileDashboardPage />} />
            <Route path="/mobile/centro-control" element={<CentroControlPage />} />
            <Route path="/mobile/centro-control/viaje/:id" element={<ViajeRedirect />} />
            <Route path="/mobile/manifiestos" element={<ManifiestosPage />} />
            <Route path="/mobile/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
            <Route path="/mobile/manifiestos/:id/editar" element={<EditarManifiestoPage />} />
            <Route path="/mobile/manifiestos/:id" element={<ManifiestoDetallePage />} />
            <Route path="/mobile/transporte/perfil" element={<TransportePerfilPage />} />
            <Route path="/mobile/transporte/viaje/:id" element={<ViajeEnCursoTransportista />} />
            <Route path="/mobile/admin/usuarios" element={<UsuariosPage />} />
            <Route path="/mobile/reportes" element={<ReportesPage />} />
            <Route path="/mobile/alertas" element={<AlertasPage />} />
            <Route path="/mobile/notificaciones" element={<NotificacionesPage />} />
            <Route path="/mobile/configuracion" element={<ConfiguracionPage />} />
            <Route path="/mobile/mi-perfil" element={<PerfilPage />} />
            <Route path="/mobile/ayuda" element={<AyudaPage />} />
            <Route path="/mobile/switch-user" element={<UserSwitcherPage />} />

            {/* Mobile Special Routes */}
            <Route path="/mobile/escaner-qr" element={<EscanerQRPage />} />
            <Route path="/mobile/estadisticas" element={<EstadisticasPage />} />
          </Route>
        </Route>

        {/* Admin Mobile Routes - ADMIN only */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores" element={<ActoresPage />} />
            <Route path="/mobile/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/mobile/admin/carga-masiva" element={<CargaMasivaPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Transportista Mobile */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/mobile/admin/actores/transportistas/nuevo" element={<NuevoTransportistaPage />} />
            <Route path="/mobile/admin/actores/transportistas/:id/editar" element={<NuevoTransportistaPage />} />
          </Route>
        </Route>
        {/* Transportista detail: ADMIN + ADMIN_TRANSPORTISTA + TRANSPORTISTA (own profile) */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores/transportistas/:id" element={<TransportistaDetallePage />} />
          </Route>
        </Route>
        {/* Vehículos Mobile: ADMIN + ADMIN_TRANSPORTISTA + TRANSPORTISTA */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/vehiculos" element={<AdminVehiculosPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Generador Mobile */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/mobile/admin/actores/generadores/nuevo" element={<NuevoGeneradorPage />} />
            <Route path="/mobile/admin/actores/generadores/:id/editar" element={<NuevoGeneradorPage />} />
            <Route path="/mobile/admin/actores/generadores/:id/renovar" element={<NuevoGeneradorPage />} />
            <Route path="/mobile/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/mobile/admin/residuos" element={<AdminResiduosPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Operador Mobile */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_OPERADOR']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores/operadores" element={<AdminOperadoresPage />} />
            <Route path="/mobile/admin/actores/operadores/nuevo" element={<NuevoOperadorPage />} />
            <Route path="/mobile/admin/actores/operadores/:id/editar" element={<NuevoOperadorPage />} />
            <Route path="/mobile/admin/actores/operadores/:id/renovar" element={<NuevoOperadorPage />} />
            <Route path="/mobile/admin/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/mobile/admin/renovaciones" element={<AdminRenovacionesPage />} />
          </Route>
        </Route>

        {/* War Room Monitor — full-screen, outside MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/monitor" element={<WarRoomPage />} />
        </Route>

        {/* Main Routes - Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Dashboard */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/centro-control" element={<CentroControlPage />} />
            <Route path="/centro-control/viaje/:id" element={<ViajeRedirect />} />

            {/* Manifiestos */}
            <Route path="/manifiestos" element={<ManifiestosPage />} />
            <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
            <Route path="/manifiestos/:id/editar" element={<EditarManifiestoPage />} />
            <Route path="/manifiestos/:id" element={<ManifiestoDetallePage />} />

            {/* Transporte */}
            <Route path="/transporte/perfil" element={<TransportePerfilPage />} />
            <Route path="/transporte/viaje/:id" element={<ViajeEnCursoTransportista />} />

            {/* Reportes */}
            <Route path="/reportes" element={<ReportesPage />} />

            {/* Alertas */}
            <Route path="/alertas" element={<AlertasPage />} />

            {/* Configuración */}
            <Route path="/configuracion" element={<ConfiguracionPage />} />

            {/* Perfil */}
            <Route path="/mi-perfil" element={<PerfilPage />} />

            {/* Ayuda */}
            <Route path="/ayuda" element={<AyudaPage />} />

            {/* Solicitudes */}
            <Route path="/mi-solicitud" element={<MiSolicitudPage />} />
            <Route path="/mi-perfil/solicitar-cambios" element={<SolicitarCambiosPage />} />

          </Route>
        </Route>

        {/* Admin Solicitudes - ADMIN + sub-admins */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/solicitudes" element={<AdminSolicitudesPage />} />
            <Route path="/admin/solicitudes/:id" element={<SolicitudDetallePage />} />
          </Route>
        </Route>

        {/* Admin Routes - Super ADMIN only */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/usuarios" element={<UsuariosPage />} />
            <Route path="/admin/actores" element={<ActoresPage />} />
          </Route>
        </Route>

        {/* Blockchain + Carga Masiva + Auditoria - All admin roles */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/blockchain" element={<AdminBlockchainPage />} />
            <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />
            <Route path="/admin/auditoria" element={<AuditoriaPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Transportista */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/admin/actores/transportistas/nuevo" element={<NuevoTransportistaPage />} />
            <Route path="/admin/actores/transportistas/:id/editar" element={<NuevoTransportistaPage />} />
          </Route>
        </Route>
        {/* Transportista detail: ADMIN + ADMIN_TRANSPORTISTA + TRANSPORTISTA (own profile) */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/actores/transportistas/:id" element={<TransportistaDetallePage />} />
          </Route>
        </Route>
        {/* Vehículos: ADMIN + ADMIN_TRANSPORTISTA + TRANSPORTISTA */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_TRANSPORTISTA', 'TRANSPORTISTA']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Generador */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/actores/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/admin/actores/generadores/nuevo" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id/editar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id/renovar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/admin/residuos" element={<AdminResiduosPage />} />
          </Route>
        </Route>

        {/* Sub-Admin Operador */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_OPERADOR']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin/actores/operadores" element={<AdminOperadoresPage />} />
            <Route path="/admin/actores/operadores/nuevo" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id/editar" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id/renovar" element={<NuevoOperadorPage />} />
            <Route path="/admin/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/admin/tratamientos" element={<AdminTratamientosPage />} />
            <Route path="/admin/renovaciones" element={<AdminRenovacionesPage />} />
          </Route>
        </Route>

        {/* Verificación pública de manifiesto (QR) */}
        <Route path="/manifiestos/verificar/:numero" element={<VerificarManifiestoPage />} />

        {/* Legacy /v6/ QR redirect — QR codes ya impresos apuntan a /v6/manifiestos/verificar/... */}
        <Route path="/v6/manifiestos/verificar/:numero" element={<V6VerificarRedirect />} />

        {/* User Switcher */}
        <Route path="/switch-user" element={<UserSwitcherPage />} />

        {/* Redirects */}
        <Route path="/" element={<LandingPage />} />

        {/* Legacy actores redirects */}
        <Route path="/actores" element={<Navigate to="/admin/actores" replace />} />
        <Route path="/actores/*" element={<Navigate to="/admin/actores" replace />} />
        <Route path="/admin/generadores" element={<Navigate to="/admin/actores" replace />} />
        <Route path="/admin/operadores" element={<Navigate to="/admin/actores" replace />} />

        {/* Legacy tracking redirects */}
        <Route path="/tracking" element={<Navigate to="/centro-control" replace />} />
        <Route path="/tracking/:id" element={<TrackingRedirect />} />
        <Route path="/mobile/tracking" element={<Navigate to="/mobile/centro-control" replace />} />
        <Route path="/mobile/tracking/viaje/:id" element={<TrackingRedirect />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

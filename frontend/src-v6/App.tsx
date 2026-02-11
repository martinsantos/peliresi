/**
 * SITREP v6 - App Router
 * ======================
 * Routing principal con todas las páginas
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';

// ========================================
// CONTEXTS
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
// PAGES - Lazy loaded (32 páginas totales)
// ========================================

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));

// Dashboard & Centro de Control
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CentroControlPage = lazy(() => import('./pages/centro-control/CentroControlPage'));

// Manifiestos
const ManifiestosPage = lazy(() => import('./pages/manifiestos/ManifiestosPage'));
const ManifiestoDetallePage = lazy(() => import('./pages/manifiestos/ManifiestoDetallePage'));
const NuevoManifiestoPage = lazy(() => import('./pages/manifiestos/NuevoManifiestoPage'));

// Tracking (TrackingPage eliminated — functionality merged into CentroControlPage)
const ViajeEnCursoPage = lazy(() => import('./pages/tracking/ViajeEnCursoPage'));

// Transporte
const TransportePerfilPage = lazy(() => import('./pages/transporte/TransportePerfilPage'));
const ViajeEnCursoTransportista = lazy(() => import('./pages/transporte/ViajeEnCursoTransportista'));

// Actores
const ActoresPage = lazy(() => import('./pages/actores/ActoresPage'));
const OperadoresPage = lazy(() => import('./pages/actores/OperadoresPage'));
const OperadorDetallePage = lazy(() => import('./pages/actores/OperadorDetallePage'));
const TransportistasPage = lazy(() => import('./pages/actores/TransportistasPage'));
const TransportistaDetallePage = lazy(() => import('./pages/actores/TransportistaDetallePage'));

// Reportes
const ReportesPage = lazy(() => import('./pages/reportes/ReportesPage'));

// Alertas
const AlertasPage = lazy(() => import('./pages/alertas/AlertasPage'));

// Configuración
const ConfiguracionPage = lazy(() => import('./pages/configuracion/ConfiguracionPage'));

// Admin - Usuarios
const UsuariosPage = lazy(() => import('./pages/usuarios/UsuariosPage'));

// Admin - Sectoriales
const AdminGeneradoresPage = lazy(() => import('./pages/admin/AdminGeneradoresPage'));
const GeneradorDetallePage = lazy(() => import('./pages/admin/GeneradorDetallePage'));
const AdminOperadoresPage = lazy(() => import('./pages/admin/AdminOperadoresPage'));
const AdminVehiculosPage = lazy(() => import('./pages/admin/AdminVehiculosPage'));
const AdminResiduosPage = lazy(() => import('./pages/admin/AdminResiduosPage'));
const AdminTratamientosPage = lazy(() => import('./pages/admin/AdminTratamientosPage'));

// Auditoría
const AuditoriaPage = lazy(() => import('./pages/auditoria/AuditoriaPage'));

// Carga Masiva
const CargaMasivaPage = lazy(() => import('./pages/carga-masiva/CargaMasivaPage'));

// Perfil
const PerfilPage = lazy(() => import('./pages/perfil/PerfilPage'));

// Mobile
const MobileDashboardPage = lazy(() => import('./pages/mobile/MobileDashboardPage'));

// User Switcher
const UserSwitcherPage = lazy(() => import('./pages/auth/UserSwitcherPage'));

// Notificaciones
const NotificacionesPage = lazy(() => import('./pages/notificaciones/NotificacionesPage'));

// Ayuda
const AyudaPage = lazy(() => import('./pages/ayuda/AyudaPage'));

// Escaner QR
const EscanerQRPage = lazy(() => import('./pages/escaner/EscanerQRPage'));

// Verificación pública de manifiesto (sin auth)
const VerificarManifiestoPage = lazy(() => import('./pages/manifiestos/VerificarManifiestoPage'));

// Estadísticas
const EstadisticasPage = lazy(() => import('./pages/estadisticas/EstadisticasPage'));

// 404
const NotFoundPage = lazy(() => import('./pages/shared/NotFoundPage'));

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
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
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

        {/* Admin Mobile Routes - Protected (ADMIN only) */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<MobileLayout />}>
            <Route path="/mobile/admin/actores" element={<ActoresPage />} />
            <Route path="/mobile/admin/actores/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/mobile/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/mobile/admin/actores/operadores" element={<AdminOperadoresPage />} />
            <Route path="/mobile/admin/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/mobile/admin/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/mobile/admin/actores/transportistas/:id" element={<TransportistaDetallePage />} />
            <Route path="/mobile/admin/vehiculos" element={<AdminVehiculosPage />} />
            <Route path="/mobile/admin/residuos" element={<AdminResiduosPage />} />
            <Route path="/mobile/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/mobile/admin/carga-masiva" element={<CargaMasivaPage />} />
          </Route>
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
          </Route>
        </Route>

        {/* Admin Routes - Protected (ADMIN only) */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<MainLayout />}>
            {/* Admin - Usuarios */}
            <Route path="/admin/usuarios" element={<UsuariosPage />} />

            {/* Admin - Actores (vista unificada) */}
            <Route path="/admin/actores" element={<ActoresPage />} />
            <Route path="/admin/actores/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/admin/actores/operadores" element={<AdminOperadoresPage />} />
            <Route path="/admin/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/admin/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/admin/actores/transportistas/:id" element={<TransportistaDetallePage />} />
            <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
            <Route path="/admin/residuos" element={<AdminResiduosPage />} />
            <Route path="/admin/tratamientos" element={<AdminTratamientosPage />} />

            {/* Auditoría */}
            <Route path="/admin/auditoria" element={<AuditoriaPage />} />

            {/* Carga Masiva */}
            <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />
          </Route>
        </Route>

        {/* Verificación pública de manifiesto (QR) */}
        <Route path="/manifiestos/verificar/:numero" element={<VerificarManifiestoPage />} />

        {/* Legacy /v6/ QR redirect — QR codes ya impresos apuntan a /v6/manifiestos/verificar/... */}
        <Route path="/v6/manifiestos/verificar/:numero" element={<V6VerificarRedirect />} />

        {/* User Switcher */}
        <Route path="/switch-user" element={<UserSwitcherPage />} />

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

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

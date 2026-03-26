/**
 * SITREP v6 - Mobile App Router
 * ==============================
 * Router para la PWA mobile (/app)
 * Todas las rutas usan MobileLayout directamente
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MobileLayout } from './layouts/MobileLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages - Lazy loaded
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ReclamarCuentaPage = lazy(() => import('./pages/auth/ReclamarCuentaPage'));
const MobileDashboardPage = lazy(() => import('./pages/mobile/MobileDashboardPage'));
const CentroControlPage = lazy(() => import('./pages/centro-control/CentroControlPage'));
const ManifiestosPage = lazy(() => import('./pages/manifiestos/ManifiestosPage'));
const ManifiestoDetallePage = lazy(() => import('./pages/manifiestos/ManifiestoDetallePage'));
const NuevoManifiestoPage = lazy(() => import('./pages/manifiestos/NuevoManifiestoPage'));
const ViajeEnCursoPage = lazy(() => import('./pages/tracking/ViajeEnCursoPage'));
const TransportePerfilPage = lazy(() => import('./pages/transporte/TransportePerfilPage'));
const ViajeEnCursoTransportista = lazy(() => import('./pages/transporte/ViajeEnCursoTransportista'));
const ActoresPage = lazy(() => import('./pages/actores/ActoresPage'));
const OperadoresPage = lazy(() => import('./pages/actores/OperadoresPage'));
const OperadorDetallePage = lazy(() => import('./pages/actores/OperadorDetallePage'));
const TransportistasPage = lazy(() => import('./pages/actores/TransportistasPage'));
const TransportistaDetallePage = lazy(() => import('./pages/actores/TransportistaDetallePage'));
const ReportesPage = lazy(() => import('./pages/reportes/ReportesPage'));
const AlertasPage = lazy(() => import('./pages/alertas/AlertasPage'));
const NotificacionesPage = lazy(() => import('./pages/notificaciones/NotificacionesPage'));
const ConfiguracionPage = lazy(() => import('./pages/configuracion/ConfiguracionPage'));
const PerfilPage = lazy(() => import('./pages/perfil/PerfilPage'));
const AyudaPage = lazy(() => import('./pages/ayuda/AyudaPage'));
const UserSwitcherPage = lazy(() => import('./pages/auth/UserSwitcherPage'));
const UsuariosPage = lazy(() => import('./pages/usuarios/UsuariosPage'));
const AdminGeneradoresPage = lazy(() => import('./pages/admin/AdminGeneradoresPage'));
const GeneradorDetallePage = lazy(() => import('./pages/admin/GeneradorDetallePage'));
const NuevoGeneradorPage = lazy(() => import('./pages/admin/NuevoGeneradorPage'));
const AdminOperadoresPage = lazy(() => import('./pages/admin/AdminOperadoresPage'));
const AdminVehiculosPage = lazy(() => import('./pages/admin/AdminVehiculosPage'));
const AdminResiduosPage = lazy(() => import('./pages/admin/AdminResiduosPage'));
const AuditoriaPage = lazy(() => import('./pages/auditoria/AuditoriaPage'));
const CargaMasivaPage = lazy(() => import('./pages/carga-masiva/CargaMasivaPage'));
const EscanerQRPage = lazy(() => import('./pages/escaner/EscanerQRPage'));
const EstadisticasPage = lazy(() => import('./pages/estadisticas/EstadisticasPage'));
const NotFoundPage = lazy(() => import('./pages/shared/NotFoundPage'));
const VerificarManifiestoPage = lazy(() => import('./pages/manifiestos/VerificarManifiestoPage'));

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
  const activeTripId = localStorage.getItem('sitrep_active_trip_id');
  if (activeTripId) {
    // A3: Verify trip hasn't ended — if status is terminal, clean up and go to dashboard
    const savedStatus = localStorage.getItem(`viaje_status_${activeTripId}`);
    const snapshot = localStorage.getItem(`viaje_snapshot_${activeTripId}`);
    let snapshotEstado: string | null = null;
    if (snapshot) {
      try { snapshotEstado = JSON.parse(snapshot)?.estado; } catch { /* ignore */ }
    }
    const terminalStates = ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'CANCELADO', 'RECHAZADO'];
    if ((snapshotEstado && terminalStates.includes(snapshotEstado)) || savedStatus === 'COMPLETED') {
      localStorage.removeItem('sitrep_active_trip_id');
      localStorage.removeItem(`viaje_snapshot_${activeTripId}`);
      localStorage.removeItem(`viaje_status_${activeTripId}`);
      localStorage.removeItem(`gps_pending_${activeTripId}`);
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to={`/transporte/viaje/${activeTripId}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function AppMobile() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Login & Account Claim */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reclamar" element={<ReclamarCuentaPage />} />

          {/* Mobile Routes - protected + MobileLayout */}
          <Route element={<ProtectedRoute redirectTo="/login" />}>
          <Route element={<MobileLayout />}>
            <Route path="/dashboard" element={<MobileDashboardPage />} />
            <Route path="/centro-control" element={<CentroControlPage />} />
            <Route path="/centro-control/viaje/:id" element={<ViajeRedirectMobile />} />
            <Route path="/manifiestos" element={<ManifiestosPage />} />
            <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
            <Route path="/manifiestos/:id" element={<ManifiestoDetallePage />} />
            <Route path="/transporte/perfil" element={<TransportePerfilPage />} />
            <Route path="/transporte/viaje/:id" element={<ViajeEnCursoTransportista />} />
            <Route path="/actores" element={<ActoresPage />} />
            <Route path="/actores/operadores" element={<OperadoresPage />} />
            <Route path="/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/admin/actores/operadores/:id" element={<OperadorDetallePage />} />
            <Route path="/actores/transportistas" element={<TransportistasPage />} />
            <Route path="/actores/transportistas/:id" element={<TransportistaDetallePage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/notificaciones" element={<NotificacionesPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="/mi-perfil" element={<PerfilPage />} />
            <Route path="/ayuda" element={<AyudaPage />} />
            <Route path="/switch-user" element={<UserSwitcherPage />} />

            {/* Admin */}
            <Route path="/admin/usuarios" element={<UsuariosPage />} />
            <Route path="/admin/generadores" element={<AdminGeneradoresPage />} />
            <Route path="/admin/generadores/nuevo" element={<NuevoGeneradorPage />} />
            <Route path="/admin/generadores/:id/editar" element={<NuevoGeneradorPage />} />
            <Route path="/admin/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/admin/operadores" element={<AdminOperadoresPage />} />
            <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
            <Route path="/admin/residuos" element={<AdminResiduosPage />} />
            <Route path="/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />

            {/* Special */}
            <Route path="/escaner-qr" element={<EscanerQRPage />} />
            <Route path="/estadisticas" element={<EstadisticasPage />} />
          </Route>
          </Route>

          {/* Verificación pública de manifiesto (QR) */}
          <Route path="/manifiestos/verificar/:numero" element={<VerificarManifiestoPage />} />

          {/* Root: protected redirect */}
          <Route element={<ProtectedRoute redirectTo="/login" />}>
            <Route path="/" element={<ActiveTripGuard />} />
          </Route>

          {/* Legacy tracking redirects */}
          <Route path="/tracking" element={<Navigate to="/centro-control" replace />} />
          <Route path="/tracking/viaje/:id" element={<TrackingRedirectMobile />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default AppMobile;

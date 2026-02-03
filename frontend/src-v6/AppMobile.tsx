/**
 * SITREP v6 - Mobile App Router
 * ==============================
 * Router para la PWA mobile (/app)
 * Todas las rutas usan MobileLayout directamente
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MobileLayout } from './layouts/MobileLayout';

// Pages - Lazy loaded
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const MobileDashboardPage = lazy(() => import('./pages/mobile/MobileDashboardPage'));
const CentroControlPage = lazy(() => import('./pages/centro-control/CentroControlPage'));
const ManifiestosPage = lazy(() => import('./pages/manifiestos/ManifiestosPage'));
const ManifiestoDetallePage = lazy(() => import('./pages/manifiestos/ManifiestoDetallePage'));
const NuevoManifiestoPage = lazy(() => import('./pages/manifiestos/NuevoManifiestoPage'));
const TrackingPage = lazy(() => import('./pages/tracking/TrackingPage'));
const ViajeEnCursoPage = lazy(() => import('./pages/tracking/ViajeEnCursoPage'));
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
const AdminEstablecimientosPage = lazy(() => import('./pages/admin/AdminEstablecimientosPage'));
const AdminVehiculosPage = lazy(() => import('./pages/admin/AdminVehiculosPage'));
const AdminResiduosPage = lazy(() => import('./pages/admin/AdminResiduosPage'));
const AuditoriaPage = lazy(() => import('./pages/auditoria/AuditoriaPage'));
const CargaMasivaPage = lazy(() => import('./pages/carga-masiva/CargaMasivaPage'));
const EscanerQRPage = lazy(() => import('./pages/escaner/EscanerQRPage'));
const EstadisticasPage = lazy(() => import('./pages/estadisticas/EstadisticasPage'));
const NotFoundPage = lazy(() => import('./pages/shared/NotFoundPage'));

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-neutral-600 font-medium">Cargando SITREP...</p>
    </div>
  </div>
);

function AppMobile() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Mobile Routes - all use MobileLayout */}
          <Route element={<MobileLayout />}>
            <Route path="/dashboard" element={<MobileDashboardPage />} />
            <Route path="/centro-control" element={<CentroControlPage />} />
            <Route path="/manifiestos" element={<ManifiestosPage />} />
            <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
            <Route path="/manifiestos/:id" element={<ManifiestoDetallePage />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/tracking/viaje/:id" element={<ViajeEnCursoPage />} />
            <Route path="/transporte/perfil" element={<ViajeEnCursoTransportista />} />
            <Route path="/actores" element={<ActoresPage />} />
            <Route path="/actores/operadores" element={<OperadoresPage />} />
            <Route path="/actores/operadores/:id" element={<OperadorDetallePage />} />
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
            <Route path="/admin/generadores/:id" element={<GeneradorDetallePage />} />
            <Route path="/admin/establecimientos" element={<AdminEstablecimientosPage />} />
            <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
            <Route path="/admin/residuos" element={<AdminResiduosPage />} />
            <Route path="/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />

            {/* Special */}
            <Route path="/escaner-qr" element={<EscanerQRPage />} />
            <Route path="/estadisticas" element={<EstadisticasPage />} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default AppMobile;

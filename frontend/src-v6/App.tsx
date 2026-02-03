/**
 * SITREP v6 - App Router
 * ======================
 * Routing principal con todas las páginas
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// ========================================
// CONTEXTS
// ========================================
import { AuthProvider } from './contexts/AuthContext';

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

// Tracking
const TrackingPage = lazy(() => import('./pages/tracking/TrackingPage'));
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
const AdminEstablecimientosPage = lazy(() => import('./pages/admin/AdminEstablecimientosPage'));
const AdminVehiculosPage = lazy(() => import('./pages/admin/AdminVehiculosPage'));
const AdminResiduosPage = lazy(() => import('./pages/admin/AdminResiduosPage'));

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
// APP COMPONENT
// ========================================
function App() {
  return (
    <AuthProvider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Mobile Routes */}
        <Route element={<MobileLayout />}>
          <Route path="/mobile" element={<MobileDashboardPage />} />
          <Route path="/mobile/dashboard" element={<MobileDashboardPage />} />
          <Route path="/mobile/centro-control" element={<CentroControlPage />} />
          <Route path="/mobile/manifiestos" element={<ManifiestosPage />} />
          <Route path="/mobile/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
          <Route path="/mobile/manifiestos/:id" element={<ManifiestoDetallePage />} />
          <Route path="/mobile/tracking" element={<TrackingPage />} />
          <Route path="/mobile/tracking/viaje/:id" element={<ViajeEnCursoPage />} />
          <Route path="/mobile/transporte/perfil" element={<ViajeEnCursoTransportista />} />
          <Route path="/mobile/actores" element={<ActoresPage />} />
          <Route path="/mobile/actores/operadores" element={<OperadoresPage />} />
          <Route path="/mobile/actores/operadores/:id" element={<OperadorDetallePage />} />
          <Route path="/mobile/actores/transportistas" element={<TransportistasPage />} />
          <Route path="/mobile/actores/transportistas/:id" element={<TransportistaDetallePage />} />
          <Route path="/mobile/reportes" element={<ReportesPage />} />
          <Route path="/mobile/alertas" element={<AlertasPage />} />
          <Route path="/mobile/notificaciones" element={<NotificacionesPage />} />
          <Route path="/mobile/configuracion" element={<ConfiguracionPage />} />
          <Route path="/mobile/mi-perfil" element={<PerfilPage />} />
          <Route path="/mobile/ayuda" element={<AyudaPage />} />
          <Route path="/mobile/switch-user" element={<UserSwitcherPage />} />
          
          {/* Admin Mobile Routes */}
          <Route path="/mobile/admin/usuarios" element={<UsuariosPage />} />
          <Route path="/mobile/admin/generadores" element={<AdminGeneradoresPage />} />
          <Route path="/mobile/admin/generadores/:id" element={<GeneradorDetallePage />} />
          <Route path="/mobile/admin/establecimientos" element={<AdminEstablecimientosPage />} />
          <Route path="/mobile/admin/vehiculos" element={<AdminVehiculosPage />} />
          <Route path="/mobile/admin/residuos" element={<AdminResiduosPage />} />
          <Route path="/mobile/admin/auditoria" element={<AuditoriaPage />} />
          <Route path="/mobile/admin/carga-masiva" element={<CargaMasivaPage />} />
          
          {/* Mobile Special Routes */}
          <Route path="/mobile/escaner-qr" element={<EscanerQRPage />} />
          <Route path="/mobile/estadisticas" element={<EstadisticasPage />} />
        </Route>

        {/* Main Routes */}
        <Route element={<MainLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/centro-control" element={<CentroControlPage />} />
          
          {/* Manifiestos */}
          <Route path="/manifiestos" element={<ManifiestosPage />} />
          <Route path="/manifiestos/nuevo" element={<NuevoManifiestoPage />} />
          <Route path="/manifiestos/:id" element={<ManifiestoDetallePage />} />
          
          {/* Tracking */}
          <Route path="/tracking" element={<TrackingPage />} />
          
          {/* Actores */}
          <Route path="/actores" element={<ActoresPage />} />
          <Route path="/actores/operadores" element={<OperadoresPage />} />
          <Route path="/actores/operadores/:id" element={<OperadorDetallePage />} />
          <Route path="/actores/transportistas" element={<TransportistasPage />} />
          <Route path="/actores/transportistas/:id" element={<TransportistaDetallePage />} />
          
          {/* Reportes */}
          <Route path="/reportes" element={<ReportesPage />} />
          
          {/* Alertas */}
          <Route path="/alertas" element={<AlertasPage />} />
          
          {/* Configuración */}
          <Route path="/configuracion" element={<ConfiguracionPage />} />
          
          {/* Admin - Usuarios */}
          <Route path="/admin/usuarios" element={<UsuariosPage />} />
          
          {/* Admin - Sectoriales */}
          <Route path="/admin/generadores" element={<AdminGeneradoresPage />} />
          <Route path="/admin/generadores/:id" element={<GeneradorDetallePage />} />
          <Route path="/admin/establecimientos" element={<AdminEstablecimientosPage />} />
          <Route path="/admin/vehiculos" element={<AdminVehiculosPage />} />
          <Route path="/admin/residuos" element={<AdminResiduosPage />} />
          
          {/* Auditoría */}
          <Route path="/admin/auditoria" element={<AuditoriaPage />} />
          
          {/* Carga Masiva */}
          <Route path="/admin/carga-masiva" element={<CargaMasivaPage />} />
          
          {/* Perfil */}
          <Route path="/mi-perfil" element={<PerfilPage />} />
        </Route>

        {/* User Switcher */}
        <Route path="/switch-user" element={<UserSwitcherPage />} />

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </AuthProvider>
  );
}

export default App;

/**
 * Shared lazy-loaded page imports.
 * Single source of truth for both Web (App.tsx) and PWA (AppMobile.tsx).
 * Adding a new page = 1 line here, then reference in route definitions.
 */

import { lazy } from 'react';

// Auth
export const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
export const LandingPage = lazy(() => import('../pages/auth/LandingPage'));
export const RegistroPage = lazy(() => import('../pages/auth/RegistroPage'));
export const VerificarEmailPage = lazy(() => import('../pages/auth/VerificarEmailPage'));
export const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
export const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
export const ReclamarCuentaPage = lazy(() => import('../pages/auth/ReclamarCuentaPage'));
export const UserSwitcherPage = lazy(() => import('../pages/auth/UserSwitcherPage'));

// Dashboard & Centro de Control
export const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
export const CentroControlPage = lazy(() => import('../pages/centro-control/CentroControlPage'));
export const WarRoomPage = lazy(() => import('../pages/monitor/WarRoomPage'));

// Manifiestos
export const ManifiestosPage = lazy(() => import('../pages/manifiestos/ManifiestosPage'));
export const ManifiestoDetallePage = lazy(() => import('../pages/manifiestos/ManifiestoDetallePage'));
export const NuevoManifiestoPage = lazy(() => import('../pages/manifiestos/NuevoManifiestoPage'));
export const EditarManifiestoPage = lazy(() => import('../pages/manifiestos/EditarManifiestoPage'));
export const VerificarManifiestoPage = lazy(() => import('../pages/manifiestos/VerificarManifiestoPage'));

// Tracking & Transporte
export const ViajeEnCursoPage = lazy(() => import('../pages/tracking/ViajeEnCursoPage'));
export const TransportePerfilPage = lazy(() => import('../pages/transporte/TransportePerfilPage'));
export const ViajeEnCursoTransportista = lazy(() => import('../pages/transporte/ViajeEnCursoTransportista'));

// Actores
export const ActoresPage = lazy(() => import('../pages/actores/ActoresPage'));
export const OperadoresPage = lazy(() => import('../pages/actores/OperadoresPage'));
export const OperadorDetallePage = lazy(() => import('../pages/actores/OperadorDetallePage'));
export const TransportistasPage = lazy(() => import('../pages/actores/TransportistasPage'));
export const TransportistaDetallePage = lazy(() => import('../pages/actores/TransportistaDetallePage'));

// Reportes
export const ReportesPage = lazy(() => import('../pages/reportes/ReportesPage'));

// Alertas
export const AlertasPage = lazy(() => import('../pages/alertas/AlertasPage'));

// Configuración
export const ConfiguracionPage = lazy(() => import('../pages/configuracion/ConfiguracionPage'));

// Admin
export const UsuariosPage = lazy(() => import('../pages/usuarios/UsuariosPage'));
export const AdminGeneradoresPage = lazy(() => import('../pages/admin/AdminGeneradoresPage'));
export const GeneradorDetallePage = lazy(() => import('../pages/admin/GeneradorDetallePage'));
export const NuevoGeneradorPage = lazy(() => import('../pages/admin/NuevoGeneradorPage'));
export const AdminOperadoresPage = lazy(() => import('../pages/admin/AdminOperadoresPage'));
export const NuevoOperadorPage = lazy(() => import('../pages/admin/NuevoOperadorPage'));
export const NuevoTransportistaPage = lazy(() => import('../pages/admin/NuevoTransportistaPage'));
export const AdminRenovacionesPage = lazy(() => import('../pages/admin/AdminRenovacionesPage'));
export const AdminVehiculosPage = lazy(() => import('../pages/admin/AdminVehiculosPage'));
export const AdminResiduosPage = lazy(() => import('../pages/admin/AdminResiduosPage'));
export const AdminTratamientosPage = lazy(() => import('../pages/admin/AdminTratamientosPage'));
export const AdminBlockchainPage = lazy(() => import('../pages/admin/AdminBlockchainPage'));
export const AdminSolicitudesPage = lazy(() => import('../pages/admin/AdminSolicitudesPage'));
export const SolicitudDetallePage = lazy(() => import('../pages/admin/SolicitudDetallePage'));

// Auditoría & Carga Masiva
export const AuditoriaPage = lazy(() => import('../pages/auditoria/AuditoriaPage'));
export const CargaMasivaPage = lazy(() => import('../pages/carga-masiva/CargaMasivaPage'));

// Perfil
export const PerfilPage = lazy(() => import('../pages/perfil/PerfilPage'));
export const SolicitarCambiosPage = lazy(() => import('../pages/perfil/SolicitarCambiosPage'));

// Mobile
export const MobileDashboardPage = lazy(() => import('../pages/mobile/MobileDashboardPage'));

// Notificaciones, Ayuda, QR, Estadísticas
export const NotificacionesPage = lazy(() => import('../pages/notificaciones/NotificacionesPage'));
export const AyudaPage = lazy(() => import('../pages/ayuda/AyudaPage'));
export const EscanerQRPage = lazy(() => import('../pages/escaner/EscanerQRPage'));
export const EstadisticasPage = lazy(() => import('../pages/estadisticas/EstadisticasPage'));

// Inscripción pública & Solicitudes
export const InscripcionWizardPage = lazy(() => import('../pages/public/InscripcionWizardPage'));
export const MiSolicitudPage = lazy(() => import('../pages/solicitud/MiSolicitudPage'));

// 404
export const NotFoundPage = lazy(() => import('../pages/shared/NotFoundPage'));

/**
 * SITREP v6 - Mobile Layout
 * =========================
 * Layout optimizado para dispositivos móviles - Adaptado por rol
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Home,
  FileText,
  MapPin,
  Users,
  Bell,
  Menu,
  X,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Plus,
  SwitchCamera,
  Eye,
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  Truck,
  Factory,
  FlaskConical,
  Shield,
  LayoutDashboard,
  ScanLine,
  BookOpen,
  PieChart,
  Database,
  Upload,
  HelpCircle,
  Navigation,
  ClipboardCheck,
  Scale,
  Radio,
} from 'lucide-react';
import { Badge } from '../components/ui/BadgeV2';
import { NotificationBell } from '../components/NotificationBell';
import { SitrepMark } from '../components/SitrepMark';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';
import { SWUpdateBanner } from '../components/SWUpdateBanner';
import { InstallPWAButton } from '../components/InstallPWAButton';
import { InstallPWAModal } from '../components/InstallPWAModal';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import type { UserRole } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { useActiveTripRecovery } from '../hooks/useActiveTripRecovery';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { NotificacionesPoller } from '../components/NotificacionesPoller';
import { ToastContainer, toast } from '../components/ui/Toast';
import { useNotificacionesNoLeidas } from '../hooks/useNotificaciones';
import { inspectionContextLabel } from '../utils/inspectionContextLabel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// ROLE CONFIG
// ========================================
const roleConfig: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  ADMIN: { label: 'Admin', color: 'text-primary-800', bgColor: 'bg-primary-700' },
  GENERADOR: { label: 'Generador', color: 'text-purple-700', bgColor: 'bg-purple-700' },
  TRANSPORTISTA: { label: 'Transportista', color: 'text-orange-800', bgColor: 'bg-orange-700' },
  OPERADOR: { label: 'Operador', color: 'text-blue-700', bgColor: 'bg-blue-700' },
  AUDITOR: { label: 'Auditor', color: 'text-info-700', bgColor: 'bg-info-700' },
  ADMIN_TRANSPORTISTA: { label: 'Adm. Transportistas', color: 'text-slate-600', bgColor: 'bg-slate-500' },
  ADMIN_GENERADOR: { label: 'Adm. Generadores', color: 'text-green-600', bgColor: 'bg-green-600' },
  ADMIN_OPERADOR: { label: 'Adm. Operadores', color: 'text-teal-700', bgColor: 'bg-teal-700' },
};

// ========================================
// BOTTOM NAVIGATION ITEM
// ========================================
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  isActive?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, isActive }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive: active }) => cn(
        'flex flex-1 flex-col items-center justify-center gap-1 border-t-2 py-2 px-1 min-w-0 min-h-14 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700',
        active || isActive
          ? 'text-primary-800 border-current bg-primary-50'
          : 'border-transparent text-neutral-600 hover:bg-neutral-50'
      )}
    >
      <div className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-error-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-xs font-semibold">{label}</span>
    </NavLink>
  );
};

// ========================================
// MOBILE LAYOUT
// ========================================
export const MobileLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, isAdmin, isGenerador, isTransportista, isOperador, isLoading, isDemo } = useAuth();
  const { impersonationData, exitImpersonation } = useImpersonation();
  const mp = useMobilePrefix();
  const isInspector = Boolean(currentUser?.esInspector);
  const isInspectionRoute = /\/inspecciones(?:\/|$)/.test(location.pathname);
  const isInspectionCase = /\/inspecciones\/[^/]+/.test(location.pathname);
  const canInspect = Boolean(isInspector || currentUser?.rol === 'ADMIN' || currentUser?.rol.startsWith('ADMIN_'));
  const { data: unreadNotificationCount = 0 } = useNotificacionesNoLeidas();

  // Recover active trip from API after reinstall/crash
  useActiveTripRecovery();

  // Auto-sync data to IndexedDB for offline use
  const offlineSync = useOfflineSync({ downloadManifests: !isInspectionRoute });

  // Bienvenida al cambiar de perfil (solo PWA)
  const prevUserIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== String(currentUser.id)) {
      toast.add({
        type: 'success',
        title: `Bienvenido, ${currentUser.nombre}`,
        message: `Sesión iniciada como ${roleConfig[currentUser.rol]?.label ?? currentUser.rol}`,
        duration: 5000,
      });
    }
    prevUserIdRef.current = String(currentUser.id);
  }, [currentUser?.id]);

  // Track active trip for TRANSPORTISTA — must be before any conditional returns (Rules of Hooks)
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  useEffect(() => {
    const checkActiveTrip = () => {
      const tripId = localStorage.getItem('sitrep_active_trip_id');
      setActiveTripId(tripId);
    };
    checkActiveTrip();
    // Re-check when localStorage changes (other tabs) or on navigation
    window.addEventListener('storage', checkActiveTrip);
    const interval = setInterval(checkActiveTrip, 5000);
    return () => { window.removeEventListener('storage', checkActiveTrip); clearInterval(interval); };
  }, []);

  // Items de navegación según rol — depend on currentUser.rol directly
  // NOTE: hooks must be called unconditionally (before any early returns)
  const bottomNavItems = useMemo(() => {
    const items = [];

    items.push({ to: mp('/dashboard'), icon: <Home size={22} />, label: 'Inicio' });
    items.push(isInspector
      ? { to: mp('/inspecciones'), icon: <ClipboardCheck size={22} />, label: 'Inspecciones' }
      : {
          to: isTransportista ? mp('/transporte/perfil') : mp('/manifiestos'),
          icon: isTransportista ? <Truck size={22} /> : <FileText size={22} />,
          label: isTransportista ? 'Viajes' : 'Manifiestos',
        });

    if (isAdmin || isTransportista) {
      items.push({ to: mp('/centro-control'), icon: <MapPin size={22} />, label: 'Control' });
    } else {
      items.push({ to: mp('/reportes'), icon: <BarChart3 size={22} />, label: 'Reportes' });
    }

    if (isAdmin) {
      items.push({ to: mp('/actores'), icon: <Users size={22} />, label: 'Actores' });
    } else {
      items.push({ to: mp('/notificaciones'), icon: <Bell size={22} />, label: 'Avisos', badge: unreadNotificationCount });
    }

    return items;
  }, [currentUser?.rol, currentUser?.esInspector, isInspector, isTransportista, isAdmin, mp, unreadNotificationCount]);

  // Menu items según rol
  const menuItems = useMemo(() => {
    const items = [];

    // Principal
    items.push({ to: mp('/dashboard'), icon: <Home size={20} />, label: 'Inicio', section: 'main' });

    if (isTransportista) {
      items.push({ to: mp('/transporte/perfil'), icon: <Truck size={20} />, label: 'Mis Viajes', section: 'main' });
      items.push({ to: mp('/manifiestos'), icon: <FileText size={20} />, label: 'Todos los Manifiestos', section: 'main' });
      if (activeTripId) {
        items.push({ to: mp(`/transporte/viaje/${activeTripId}`), icon: <Navigation size={20} />, label: 'Viaje en Curso', section: 'main' });
      }
    } else {
      items.push({ to: mp('/manifiestos'), icon: <FileText size={20} />, label: 'Manifiestos', section: 'main' });
    }

    if (canInspect) {
      items.push({ to: mp('/inspecciones'), icon: <ClipboardCheck size={20} />, label: 'Inspecciones', section: 'main' });
    }

    if (currentUser && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(currentUser.rol)) {
      items.push({ to: mp('/mis-inspecciones'), icon: <Scale size={20} />, label: 'Mis inspecciones', section: 'main' });
    }

    if (isAdmin || isTransportista) {
      items.push({ to: mp('/centro-control'), icon: <LayoutDashboard size={20} />, label: 'Centro de Control', section: 'main' });
    }

    if (isAdmin) {
      items.push({ to: mp('/monitor'), icon: <Radio size={20} />, label: 'Monitor', section: 'main' });
      items.push({ to: mp('/actores'), icon: <Users size={20} />, label: 'Actores', section: 'main' });
    }

    items.push({ to: mp('/reportes'), icon: <BarChart3 size={20} />, label: 'Reportes', section: 'main' });
    items.push({ to: mp('/notificaciones'), icon: <Bell size={20} />, label: 'Avisos', badge: unreadNotificationCount, section: 'main' });
    if (isAdmin) {
      items.push({ to: mp('/alertas'), icon: <AlertTriangle size={20} />, label: 'Alertas operativas', section: 'main' });
    }

    // Admin section
    if (isAdmin) {
      items.push({ to: mp('/admin/usuarios'), icon: <User size={20} />, label: 'Usuarios', section: 'admin' });
      items.push({ to: mp('/admin/actores/generadores'), icon: <Factory size={20} />, label: 'Generadores', section: 'admin' });
      items.push({ to: mp('/admin/actores/operadores'), icon: <FlaskConical size={20} />, label: 'Operadores', section: 'admin' });
      items.push({ to: mp('/admin/vehiculos'), icon: <Truck size={20} />, label: 'Vehículos', section: 'admin' });
      items.push({ to: mp('/admin/residuos'), icon: <Database size={20} />, label: 'Catálogo Residuos', section: 'admin' });
      items.push({ to: mp('/admin/auditoria'), icon: <Shield size={20} />, label: 'Auditoría', section: 'admin' });
      items.push({ to: mp('/admin/carga-masiva'), icon: <Upload size={20} />, label: 'Carga Masiva', section: 'admin' });
      items.push({ to: mp('/estadisticas'), icon: <PieChart size={20} />, label: 'Estadísticas', section: 'admin' });
    } else if (isTransportista) {
      items.push({ to: mp('/admin/vehiculos'), icon: <Truck size={20} />, label: 'Mis Vehículos', section: 'admin' });
    }

    // Herramientas comunes
    items.push({ to: mp('/escaner-qr'), icon: <ScanLine size={20} />, label: 'Escanear QR', section: 'tools' });
    if (!isTransportista) {
      items.push({ to: mp('/transporte/perfil'), icon: <Truck size={20} />, label: 'Mi Transporte', section: 'tools' });
    }
    items.push({ to: mp('/ayuda'), icon: <HelpCircle size={20} />, label: 'Ayuda', section: 'tools' });

    return items;
  }, [currentUser?.rol, currentUser?.esInspector, canInspect, isAdmin, isTransportista, mp, activeTripId, unreadNotificationCount]);

  // Separar items por sección
  const mainItems = menuItems.filter(i => i.section === 'main');
  const adminItems = menuItems.filter(i => i.section === 'admin');
  const toolsItems = menuItems.filter(i => i.section === 'tools');

  // Auth is handled by AuthGate in AppMobile — this is a safety net.
  // Returns null while loading or if no user (AuthGate will redirect to /login).
  if (isLoading || !currentUser) return null;

  const inspectionLabel = inspectionContextLabel(currentUser, location.pathname);
  const config = inspectionLabel ? { label: inspectionLabel, color: 'text-teal-700', bgColor: 'bg-teal-700' } : roleConfig[currentUser.rol];

  // Título según la ruta actual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Inicio';
    if (path.includes('/manifiestos/nuevo')) return 'Nuevo Manifiesto';
    if (path.includes('/manifiestos')) return isTransportista ? 'Mis Viajes' : 'Manifiestos';
    if (path.includes('/inspecciones')) return 'Inspecciones';
    if (path.includes('/transporte/perfil')) return 'Mis Viajes';
    if (path.includes('/transporte/viaje')) return 'Viaje en Curso';
    if (path.includes('/tracking')) return 'Tracking';
    if (path.includes('/admin/actores/generadores')) return 'Generadores';
    if (path.includes('/admin/actores/operadores')) return 'Operadores';
    if (path.includes('/admin/actores/transportistas')) return 'Transportistas';
    if (path.includes('/actores')) return 'Actores';
    if (path.includes('/reportes')) return 'Reportes';
    if (path.includes('/alertas')) return 'Alertas';
    if (path.includes('/configuracion')) return 'Configuración';
    if (path.includes('/mi-perfil')) return 'Mi Perfil';
    if (path.includes('/notificaciones')) return 'Avisos';
    if (path.includes('/estadisticas')) return 'Estadísticas';
    if (path.includes('/escaner-qr')) return 'Escanear QR';
    if (path.includes('/ayuda')) return 'Ayuda';
    if (path.includes('/switch-user')) return 'Cuenta';
    if (path.includes('/centro-control')) return 'Centro de Control';
    if (path.includes('/admin/usuarios')) return 'Usuarios';
    if (path.includes('/admin/generadores')) return 'Generadores';
    if (path.includes('/admin/operadores')) return 'Operadores';
    if (path.includes('/admin/vehiculos')) return 'Vehículos';
    if (path.includes('/admin/residuos')) return 'Catálogo Residuos';
    if (path.includes('/admin/auditoria')) return 'Auditoría';
    if (path.includes('/admin/carga-masiva')) return 'Carga Masiva';
    return 'SITREP';
  };

  // Create belongs to the list, not over the current record's fields or actor links.
  const showFab = /^\/(?:app\/)?manifiestos\/?$/.test(location.pathname) && (isAdmin || isGenerador);
  const isFieldTripRoute = location.pathname.includes('/transporte/viaje/');

  return (
    <div data-app-shell className="h-dvh overflow-hidden bg-[#F8F8F6] flex flex-col tap-transparent">
      <NotificacionesPoller />
      {/* Demo mode banner */}
      {isDemo && (
        <div className="shrink-0 bg-amber-100 text-amber-950 text-center text-xs sm:text-sm py-1 font-medium sticky top-0 z-50">
          Modo Demo — Los datos no son reales
        </div>
      )}

      {/* Connectivity indicator - always visible at top */}
      {!isInspectionCase && <ConnectivityIndicator />}

      {(offlineSync.terminal > 0 || offlineSync.auth > 0 || offlineSync.retryable > 0) && (
        <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${offlineSync.terminal > 0 || offlineSync.auth > 0 ? 'border-error-200 bg-error-50 text-error-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
          <span className="flex min-w-0 items-center gap-2"><AlertTriangle size={16} className="shrink-0" /><span className="min-w-0"><strong>{offlineSync.auth > 0 ? 'La sesión debe renovarse' : offlineSync.terminal > 0 ? 'Hay cambios que requieren revisión' : 'Hay cambios esperando reintento'}</strong><span className="ml-1">· {offlineSync.pending} pendientes</span>{offlineSync.lastError && <span className="block truncate opacity-80">{offlineSync.lastError}</span>}</span></span>
          <button type="button" disabled={offlineSync.syncing} onClick={() => void offlineSync.retry()} className="min-h-9 shrink-0 rounded-md border border-current bg-white px-2 font-bold disabled:opacity-50">{offlineSync.syncing ? 'Reintentando…' : 'Reintentar'}</button>
        </div>
      )}

      {/* SW update banner - shown when new version available */}
      <SWUpdateBanner />

      {impersonationData && (
        <div data-testid="impersonation-banner" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-2 text-amber-950">
          <Eye size={18} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
            <span className="block">Vista temporal</span>
            <span className="block truncate text-xs font-medium">{impersonationData.impersonatedUser.nombre}</span>
          </span>
          <button type="button" data-testid="exit-impersonation" onClick={exitImpersonation} className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-amber-700 bg-white px-3 text-sm font-bold text-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-900">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a mi cuenta
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 shrink-0 sidebar-polished safe-area-top">
        <div className="flex items-center justify-between h-16 px-4 safe-top">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 text-white/80 hover:bg-white/10 rounded-xl transition-colors touch-target"
              aria-label="Abrir menu"
            >
              <Menu size={24} />
            </button>
            <SitrepMark size={24} />
            <h1 className="min-w-0 flex-1 whitespace-normal break-words text-base font-bold leading-5 text-white">{getPageTitle()}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Badge de rol */}
            <span aria-label="Función actual" title={`Rol base: ${currentUser.rol}`} className="w-min whitespace-normal break-normal text-center text-xs leading-4 font-medium px-2 py-1 rounded-full bg-white/20 text-white">
              {config.label}
            </span>
            <NotificationBell basePath={mp('')} inverse />
          </div>
        </div>
      </header>
      <ToastContainer />

      {/* Keep absolutely positioned field controls inside this scroll container. */}
      <main className={cn('relative min-h-0 min-w-0 flex-1', isInspectionCase ? 'overflow-clip' : 'overflow-y-auto')}>
        <div className={cn(isInspectionCase ? 'h-full min-h-0 p-3' : 'p-4', isInspectionCase ? '' : isFieldTripRoute ? 'pb-6' : 'pb-28')}>
          <Outlet />
        </div>
      </main>

      {/* Floating Action Button */}
      {showFab && (
        <button
          onClick={() => navigate(mp('/manifiestos/nuevo'))}
          className="fixed right-4 bottom-24 w-14 h-14 bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-30 hover:bg-primary-800"
          aria-label="Nuevo manifiesto"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Active Trip Banner — floats above bottom nav for TRANSPORTISTA */}
      {isTransportista && activeTripId && !location.pathname.includes('/transporte/viaje/') && (
        <button
          onClick={() => navigate(mp(`/transporte/viaje/${activeTripId}`))}
          className="fixed left-3 right-3 bottom-[76px] z-40 flex min-h-[56px] items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-3 text-white shadow-xl active:scale-[0.99]"
          aria-label="Volver al viaje en curso"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Navigation size={20} />
          </div>
          <span className="flex-1 text-left text-sm font-black">Viaje en curso</span>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </button>
      )}

      {/* Bottom Navigation */}
      {!isInspectionCase && <nav className="fixed bottom-0 left-0 right-0 bottom-nav-polished safe-area-bottom z-40">
        <div className="flex items-center justify-around safe-bottom">
          {bottomNavItems.map((item) => (
            <NavItem 
              key={item.to} 
              to={item.to} 
              icon={item.icon} 
              label={item.label}
              badge={item.badge}
            />
          ))}
        </div>
      </nav>}

      {/* PWA Install Modal (appears after 45s of use) */}
      {!isInspectionRoute && <InstallPWAModal />}

      {/* Side Menu Drawer */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            className="fixed top-0 left-0 bottom-0 w-[min(300px,85vw)] bg-white z-50 animate-slide-in-left flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className={`p-4 border-b ${config.bgColor} bg-opacity-10`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <SitrepMark size={40} />
                  <div>
                    <h2 className="font-bold text-neutral-900">SITREP</h2>
                    <p className={`text-xs ${config.color} font-medium`}>{config.label}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg"
                  aria-label="Cerrar menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* User Info */}
              <div className={`flex items-center gap-3 p-3 ${config.bgColor} bg-opacity-10 rounded-xl`}>
                <div className={`w-12 h-12 ${config.bgColor} rounded-full flex items-center justify-center text-white font-bold`}>
                  {currentUser.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{currentUser.nombre}</p>
                  <p className="text-xs text-neutral-500">{currentUser.sector}</p>
                </div>
              </div>
            </div>

            {/* Drawer Menu Items — scrollable on mobile */}
            <div
              role="navigation"
              aria-label="Menú de la aplicación"
              className="flex-1 overflow-y-auto p-2"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
            >
              <div className="space-y-1">
                {mainItems.map((item) => (
                  <MenuItem 
                    key={item.to}
                    to={item.to} 
                    icon={item.icon} 
                    label={item.label} 
                    badge={item.badge}
                    onClick={() => setIsMenuOpen(false)}
                  />
                ))}
              </div>

              {adminItems.length > 0 && (
                <>
                  <div className="border-t border-neutral-100 my-2" />
                  <p className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase">
                    {isAdmin ? 'Administración' : 'Opciones'}
                  </p>
                  <div className="space-y-1">
                    {adminItems.map((item) => (
                      <MenuItem 
                        key={item.to}
                        to={item.to} 
                        icon={item.icon} 
                        label={item.label}
                        onClick={() => setIsMenuOpen(false)}
                      />
                    ))}
                  </div>
                </>
              )}

              {toolsItems.length > 0 && (
                <>
                  <div className="border-t border-neutral-100 my-2" />
                  <p className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase">
                    Herramientas
                  </p>
                  <div className="space-y-1">
                    {toolsItems.map((item) => (
                      <MenuItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => setIsMenuOpen(false)}
                      />
                    ))}
                    <a
                      href="/manual/"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-neutral-600 hover:bg-neutral-100"
                    >
                      <BookOpen size={20} />
                      <span className="flex-1 font-medium">Manual</span>
                      <ChevronRight size={16} className="text-neutral-400" />
                    </a>
                  </div>
                </>
              )}

              {/* Switching is an ADMIN tool, never a role selector for an actor. */}
              {isAdmin && <>
                <div className="border-t border-neutral-100 my-2" />
                <div className="px-2">
                <NavLink
                  to={mp('/switch-user')}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                >
                  <SwitchCamera size={18} />
                  <span>Ver como otro usuario</span>
                </NavLink>
                </div>
              </>}

              <div className="border-t border-neutral-100 my-2" />
              <div className="space-y-1">
                <MenuItem
                  to={mp('/configuracion')}
                  icon={<Settings size={20} />}
                  label="Configuración"
                  onClick={() => setIsMenuOpen(false)}
                />
                <MenuItem
                  to={mp('/mi-perfil')}
                  icon={<User size={20} />}
                  label="Mi Perfil"
                  onClick={() => setIsMenuOpen(false)}
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-neutral-100 bg-white safe-area-bottom space-y-2">
              <InstallPWAButton />
              <button
                onClick={async () => { setIsMenuOpen(false); await logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-error-600 hover:bg-error-50 rounded-xl transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
              <div className="pt-2 flex justify-center">
                <img src="/logo-mendoza.webp" alt="Gobierno de Mendoza" className="h-8 w-auto opacity-50" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ========================================
// MENU ITEM
// ========================================
interface MenuItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ to, icon, label, badge, onClick }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700',
        isActive 
          ? 'bg-primary-50 text-primary-900'
          : 'text-neutral-600 hover:bg-neutral-100'
      )}
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 bg-error-700 text-white text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-neutral-400" />
    </NavLink>
  );
};

export default MobileLayout;

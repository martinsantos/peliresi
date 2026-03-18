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
  QrCode,
  Plus,
  SwitchCamera,
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
  Navigation
} from 'lucide-react';
import { Badge } from '../components/ui/BadgeV2';
import { NotificationBell } from '../components/NotificationBell';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';
import { SWUpdateBanner } from '../components/SWUpdateBanner';
import { InstallPWAButton } from '../components/InstallPWAButton';
import { InstallPWAModal } from '../components/InstallPWAModal';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { useActiveTripRecovery } from '../hooks/useActiveTripRecovery';
import { useOfflineSync } from '../hooks/useOfflineSync';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// ROLE CONFIG
// ========================================
const roleConfig: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  ADMIN: { label: 'Admin', color: 'text-primary-600', bgColor: 'bg-primary-500' },
  GENERADOR: { label: 'Generador', color: 'text-purple-600', bgColor: 'bg-purple-500' },
  TRANSPORTISTA: { label: 'Transportista', color: 'text-orange-600', bgColor: 'bg-orange-500' },
  OPERADOR: { label: 'Operador', color: 'text-blue-600', bgColor: 'bg-blue-500' },
  AUDITOR: { label: 'Auditor', color: 'text-info-600', bgColor: 'bg-info-500' },
  ADMIN_TRANSPORTISTA: { label: 'Adm. Transportistas', color: 'text-slate-600', bgColor: 'bg-slate-500' },
  ADMIN_GENERADOR: { label: 'Adm. Generadores', color: 'text-green-600', bgColor: 'bg-green-600' },
  ADMIN_OPERADOR: { label: 'Adm. Operadores', color: 'text-teal-600', bgColor: 'bg-teal-500' },
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
  roleColor?: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, isActive, roleColor = 'text-primary-600' }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive: active }) => cn(
        'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] min-h-[48px] transition-colors',
        active || isActive
          ? roleColor
          : 'text-neutral-400'
      )}
    >
      <div className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
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
  const { currentUser, users, switchUser, logout, isAdmin, isGenerador, isTransportista, isOperador, isLoading, isDemo } = useAuth();
  const mp = useMobilePrefix();

  // Recover active trip from API after reinstall/crash
  useActiveTripRecovery();

  // Auto-sync data to IndexedDB for offline use
  useOfflineSync();

  const config = currentUser ? roleConfig[currentUser.rol] : roleConfig.ADMIN;

  // Track active trip for TRANSPORTISTA
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
    items.push({
      to: isTransportista ? mp('/transporte/perfil') : mp('/manifiestos'),
      icon: isTransportista ? <Truck size={22} /> : <FileText size={22} />,
      label: isTransportista ? 'Mis Viajes' : 'Manifiestos',
    });

    if (isAdmin || isTransportista) {
      items.push({ to: mp('/centro-control'), icon: <MapPin size={22} />, label: 'Control' });
    } else {
      items.push({ to: mp('/reportes'), icon: <BarChart3 size={22} />, label: 'Reportes' });
    }

    if (isAdmin) {
      items.push({ to: mp('/actores'), icon: <Users size={22} />, label: 'Actores' });
    } else {
      items.push({ to: mp('/alertas'), icon: <Bell size={22} />, label: 'Alertas', badge: 3 });
    }

    return items;
  }, [currentUser?.rol, mp]);

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

    if (isAdmin || isTransportista) {
      items.push({ to: mp('/centro-control'), icon: <LayoutDashboard size={20} />, label: 'Centro de Control', section: 'main' });
    }

    if (isAdmin) {
      items.push({ to: mp('/actores'), icon: <Users size={20} />, label: 'Actores', section: 'main' });
    }

    items.push({ to: mp('/reportes'), icon: <BarChart3 size={20} />, label: 'Reportes', section: 'main' });
    items.push({ to: mp('/alertas'), icon: <Bell size={20} />, label: 'Alertas', badge: 3, section: 'main' });

    // Admin section
    if (isAdmin) {
      items.push({ to: mp('/admin/usuarios'), icon: <User size={20} />, label: 'Usuarios', section: 'admin' });
      items.push({ to: mp('/admin/generadores'), icon: <Factory size={20} />, label: 'Generadores', section: 'admin' });
      items.push({ to: mp('/admin/operadores'), icon: <FlaskConical size={20} />, label: 'Operadores', section: 'admin' });
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
  }, [currentUser?.rol, mp, activeTripId]);

  // Separar items por sección
  const mainItems = menuItems.filter(i => i.section === 'main');
  const adminItems = menuItems.filter(i => i.section === 'admin');
  const toolsItems = menuItems.filter(i => i.section === 'tools');

  // Early return AFTER all hooks
  if (isLoading || !currentUser) return null;

  // Título según la ruta actual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Inicio';
    if (path.includes('/manifiestos/nuevo')) return 'Nuevo Manifiesto';
    if (path.includes('/manifiestos')) return isTransportista ? 'Mis Viajes' : 'Manifiestos';
    if (path.includes('/transporte/perfil')) return 'Mis Viajes';
    if (path.includes('/transporte/viaje')) return 'Viaje en Curso';
    if (path.includes('/tracking')) return 'Tracking';
    if (path.includes('/actores')) return 'Actores';
    if (path.includes('/reportes')) return 'Reportes';
    if (path.includes('/alertas')) return 'Alertas';
    if (path.includes('/configuracion')) return 'Configuración';
    if (path.includes('/mi-perfil')) return 'Mi Perfil';
    if (path.includes('/notificaciones')) return 'Notificaciones';
    if (path.includes('/estadisticas')) return 'Estadísticas';
    if (path.includes('/escaner-qr')) return 'Escanear QR';
    if (path.includes('/ayuda')) return 'Ayuda';
    if (path.includes('/switch-user')) return 'Cambiar Usuario';
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

  // Determinar si mostrar FAB
  const showFab = location.pathname.includes('/manifiestos') && !location.pathname.includes('/nuevo') && (isAdmin || isGenerador);

  const handleSwitchUser = (userId: number | string) => {
    if (userId === currentUser.id) return;
    switchUser(Number(userId));
    // Brief delay so the user sees the menu update before it closes
    setTimeout(() => setIsMenuOpen(false), 200);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F8F8F6] flex flex-col tap-transparent">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="bg-amber-500 text-white text-center text-xs sm:text-sm py-1 font-medium sticky top-0 z-50">
          Modo Demo — Los datos no son reales
        </div>
      )}

      {/* Connectivity indicator - always visible at top */}
      <ConnectivityIndicator />

      {/* SW update banner - shown when new version available */}
      <SWUpdateBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 sidebar-polished safe-area-top">
        <div className="flex items-center justify-between h-14 px-4 safe-top">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 text-white/80 hover:bg-white/10 rounded-xl transition-colors touch-target"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-white">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de rol */}
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/20 text-white">
              {config.label}
            </span>
            <NotificationBell basePath={mp('')} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 pb-24">
          <Outlet />
        </div>
      </main>

      {/* Floating Action Button */}
      {showFab && (
        <button
          onClick={() => navigate(mp('/manifiestos/nuevo'))}
          className={`fixed right-4 bottom-24 w-14 h-14 ${config.bgColor} text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all z-30 hover-glow animate-scale-in-bounce`}
        >
          <Plus size={28} />
        </button>
      )}

      {/* Active Trip Banner — floats above bottom nav for TRANSPORTISTA */}
      {isTransportista && activeTripId && !location.pathname.includes('/transporte/viaje/') && (
        <button
          onClick={() => navigate(mp(`/transporte/viaje/${activeTripId}`))}
          className="fixed left-2 right-2 bottom-[68px] z-40 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg animate-pulse-subtle"
        >
          <Navigation size={20} className="shrink-0" />
          <span className="flex-1 text-sm font-semibold text-left">Viaje en Curso</span>
          <ChevronRight size={18} className="shrink-0 opacity-70" />
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bottom-nav-polished safe-area-bottom z-40">
        <div className="flex items-center justify-around safe-bottom">
          {bottomNavItems.map((item) => (
            <NavItem 
              key={item.to} 
              to={item.to} 
              icon={item.icon} 
              label={item.label}
              badge={item.badge}
              roleColor={config.color}
            />
          ))}
        </div>
      </nav>

      {/* PWA Install Modal (appears after 45s of use) */}
      <InstallPWAModal />

      {/* Side Menu Drawer */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            className="fixed top-0 left-0 bottom-0 w-[300px] bg-white z-50 animate-slide-in-left flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className={`p-4 border-b ${config.bgColor} bg-opacity-10`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center`}>
                    <QrCode size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-neutral-900">SITREP</h2>
                    <p className={`text-xs ${config.color} font-medium`}>{config.label}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg"
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
                    activeColor={config.color}
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
                        activeColor={config.color}
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
                        activeColor={config.color}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* User Switcher en Menu */}
              <div className="border-t border-neutral-100 my-2" />
              <p className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase">
                Cambiar Usuario
              </p>
              <div className="space-y-1 px-2">
                {users.slice(0, 5).map((user) => {
                  const userConfig = roleConfig[user.rol];
                  const isCurrent = user.id === currentUser.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSwitchUser(user.id)}
                      disabled={isCurrent}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left',
                        isCurrent
                          ? `${userConfig.bgColor} bg-opacity-20`
                          : 'hover:bg-neutral-100'
                      )}
                    >
                      <div className={`w-8 h-8 ${userConfig.bgColor} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCurrent ? userConfig.color : 'text-neutral-700'}`}>
                          {user.nombre}
                        </p>
                      </div>
                      {isCurrent && <div className={`w-2 h-2 ${userConfig.bgColor} rounded-full`} />}
                    </button>
                  );
                })}
                <NavLink
                  to={mp('/switch-user')}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <SwitchCamera size={18} />
                  <span className="text-sm font-medium">Ver todos los usuarios</span>
                </NavLink>
              </div>

              <div className="border-t border-neutral-100 my-2" />
              <div className="space-y-1">
                <MenuItem
                  to={mp('/configuracion')}
                  icon={<Settings size={20} />}
                  label="Configuración"
                  onClick={() => setIsMenuOpen(false)}
                  activeColor={config.color}
                />
                <MenuItem
                  to={mp('/mi-perfil')}
                  icon={<User size={20} />}
                  label="Mi Perfil"
                  onClick={() => setIsMenuOpen(false)}
                  activeColor={config.color}
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-neutral-100 bg-white safe-area-bottom space-y-2">
              <InstallPWAButton />
              <button
                onClick={() => { logout(); setIsMenuOpen(false); navigate('/login'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-error-600 hover:bg-error-50 rounded-xl transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
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
  activeColor?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ to, icon, label, badge, onClick, activeColor = 'text-primary-600' }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
        isActive 
          ? `${activeColor.replace('text-', 'bg-').replace('600', '50')} ${activeColor}` 
          : 'text-neutral-600 hover:bg-neutral-100'
      )}
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 bg-error-500 text-white text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-neutral-400" />
    </NavLink>
  );
};

export default MobileLayout;

/**
 * SITREP v6 - Main Layout
 * =======================
 * Layout principal con sidebar y header - Adaptado por rol
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GlobalSearchPanel } from '../components/GlobalSearchPanel';
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Settings,
  Search,
  Menu,
  X,
  User,
  ChevronDown,
  LogOut,
  Leaf,
  Command,
  Users,
  BarChart3,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Upload,
  Truck,
  FlaskConical,
  Factory,
  Building2,
  SwitchCamera,
  QrCode,
  HelpCircle,
  BookOpen,
  FileCheck,
} from 'lucide-react';
import { Button } from '../components/ui/ButtonV2';
import { Badge } from '../components/ui/BadgeV2';
import { UserSwitcher } from '../components/ui/UserSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';
import { OnboardingTour, resetOnboardingTour } from '../components/OnboardingTour';
import { DemoAppOnboarding } from '../components/DemoAppOnboarding';
import { useAuth } from '../contexts/AuthContext';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

// ========================================
// COMPONENT
// ========================================
export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, isAdmin, isGenerador, isTransportista, isOperador, isAdminTransportista, isAdminGenerador, isAdminOperador, canAccess, isLoading, impersonationData, exitImpersonation } = useAuth();

  // Guard: show loading or redirect if no user
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Will be handled by router redirect, but guard against null access
    return null;
  }

  // Configuración de colores según rol (para header badges)
  const roleStyles = (() => {
    switch (currentUser.rol) {
      case 'ADMIN':
        return { badge: 'primary' as const };
      case 'GENERADOR':
        return { badge: 'purple' as const };
      case 'TRANSPORTISTA':
        return { badge: 'orange' as const };
      case 'OPERADOR':
        return { badge: 'green' as const };
      default:
        return { badge: 'neutral' as const };
    }
  })();

  // Items de navegacion segun rol
  const navItems = (() => {
    const items = [];
    
    // Dashboard para todos
    items.push({ path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' });
    
    // Centro de Control para Admin, Transportista, Admin Transportista y Admin Operador
    if (isAdmin || isTransportista || isAdminTransportista || isAdminOperador) {
      items.push({ path: '/centro-control', icon: Command, label: 'Centro de Control' });
    }

    // Manifiestos para todos
    items.push({ path: '/manifiestos', icon: FileText, label: 'Manifiestos' });
    
    // Usuarios del sistema solo para Admin
    if (isAdmin) {
      items.push({ path: '/admin/usuarios', icon: Users, label: 'Usuarios' });
    }
    
    // Reportes para todos excepto algunos casos
    items.push({ path: '/reportes', icon: BarChart3, label: 'Reportes' });
    
    // Alertas para todos
    items.push({ path: '/alertas', icon: AlertTriangle, label: 'Alertas' });
    
    return items;
  })();

  // Items de administración según rol
  const adminItems = useMemo(() => {
    const items = [];

    if (isAdmin) {
      items.push({ path: '/admin/actores',                icon: Building2,    label: 'Actores' });
      items.push({ path: '/admin/actores/generadores',    icon: Factory,      label: 'Admin Generadores' });
      items.push({ path: '/admin/actores/operadores',     icon: FlaskConical, label: 'Admin Operadores' });
      items.push({ path: '/admin/actores/transportistas', icon: Truck,        label: 'Admin Transporte' });
      items.push({ path: '/admin/solicitudes',            icon: FileCheck,    label: 'Solicitudes' });
      items.push({ path: '/admin/residuos',               icon: FlaskConical, label: 'Catálogo Residuos' });
      items.push({ path: '/admin/tratamientos',           icon: BarChart3,    label: 'Tratamientos' });
      items.push({ path: '/admin/blockchain',              icon: ShieldCheck,  label: 'Certificación Blockchain' });
      items.push({ path: '/admin/auditoria',              icon: Shield,       label: 'Auditoría' });
      items.push({ path: '/admin/carga-masiva',           icon: Upload,       label: 'Carga Masiva' });
    } else if (isAdminGenerador) {
      items.push({ path: '/admin/actores/generadores',    icon: Factory,      label: 'Mis Generadores' });
      items.push({ path: '/admin/residuos',               icon: FlaskConical, label: 'Catálogo Residuos' });
      items.push({ path: '/admin/blockchain',              icon: ShieldCheck,  label: 'Certificación Blockchain' });
      items.push({ path: '/admin/carga-masiva',           icon: Upload,       label: 'Carga Masiva' });
    } else if (isAdminTransportista) {
      items.push({ path: '/admin/actores/transportistas', icon: Truck,        label: 'Mis Transportistas' });
      items.push({ path: '/admin/vehiculos',              icon: Truck,        label: 'Vehículos' });
      items.push({ path: '/admin/blockchain',              icon: ShieldCheck,  label: 'Certificación Blockchain' });
      items.push({ path: '/admin/carga-masiva',           icon: Upload,       label: 'Carga Masiva' });
    } else if (isAdminOperador) {
      items.push({ path: '/admin/actores/operadores',     icon: FlaskConical, label: 'Mis Operadores' });
      items.push({ path: '/admin/tratamientos',           icon: BarChart3,    label: 'Tratamientos' });
      items.push({ path: '/admin/blockchain',              icon: ShieldCheck,  label: 'Certificación Blockchain' });
      items.push({ path: '/admin/carga-masiva',           icon: Upload,       label: 'Carga Masiva' });
    } else if (isTransportista) {
      items.push({ path: '/admin/vehiculos',              icon: Truck,        label: 'Mis Vehículos' });
    }

    return items;
  }, [isAdmin, isAdminGenerador, isAdminTransportista, isAdminOperador, isTransportista]);

  // Get current page title
  const currentPage = navItems.find(item => item.path === location.pathname)?.label || 
    adminItems.find(item => item.path === location.pathname)?.label || 'SITREP';

  return (
    <div className={`h-screen bg-[#F8F8F6] flex flex-col overflow-hidden ${impersonationData ? 'pt-10' : ''}`}>
      {/* Impersonation banner — amber bar above everything */}
      {impersonationData && (
        <ImpersonationBanner
          user={impersonationData.impersonatedUser}
          onExit={exitImpersonation}
        />
      )}

      {/* Connectivity indicator - always visible at top */}
      <ConnectivityIndicator />

      <div className="flex flex-1 min-h-0">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50
          w-64 h-screen sidebar-polished border-r border-[#164D32]
          flex flex-col
          transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/15">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1B5E3C] bg-white mr-3">
            <Leaf size={20} />
          </div>
          <div>
            <span className="font-bold text-lg text-white">SITREP</span>
            <span className="text-xs font-medium ml-1 text-white/60">{currentUser.rol}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto sidebar-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Custom isActive: match path prefix (for /actores/operadores/:id to highlight Actores)
            const isItemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  font-medium text-sm transition-all duration-200
                  ${isItemActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon size={20} />
                {item.label}
              </NavLink>
            );
          })}
          
          {/* Admin Section - Solo si hay items */}
          {adminItems.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/15">
              <p className="px-3 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                {isAdmin ? 'Administración' : 'Opciones'}
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                // Custom isActive check: match path prefix for admin routes (to handle /admin/operadores/:id)
                const isItemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl
                      font-medium text-sm transition-all duration-200
                      ${isItemActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <Icon size={20} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          )}
          
          {/* User Switcher en Sidebar */}
          <div className="mt-6 pt-6 border-t border-white/15">
            <p className="px-3 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              Acceso Rápido
            </p>
            <NavLink
              to="/switch-user"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-200
                ${isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <SwitchCamera size={20} />
              Cambiar Usuario
            </NavLink>
          </div>
          
          {/* Configuración y Ayuda al final */}
          <div className="mt-2">
            <NavLink
              to="/configuracion"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-200
                ${isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Settings size={20} />
              Configuración
            </NavLink>
            <NavLink
              to="/ayuda"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-200
                ${isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <HelpCircle size={20} />
              Ayuda
            </NavLink>
            <a
              href="/manual/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <BookOpen size={20} />
              Manual
            </a>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/15">
          {/* Indicador de rol actual */}
          <div className="mb-3 px-3 py-2 rounded-xl bg-white/10 border border-white/15">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm bg-white text-[#1B5E3C]">
                {currentUser.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white truncate">{currentUser.nombre}</p>
                <p className="text-xs text-white/60">{currentUser.sector}</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/15 text-white">
                <User size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm text-white">Mi Cuenta</p>
                <p className="text-xs text-white/50">{currentUser.email}</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-white/40 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* User dropdown - stays white since it floats */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg py-2 animate-scale-in">
                <NavLink to="/mi-perfil" className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                  <User size={16} />
                  Mi Perfil
                </NavLink>
                <NavLink to="/switch-user" className="w-full flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50">
                  <SwitchCamera size={16} />
                  Cambiar Usuario
                </NavLink>
                <button
                  onClick={() => { navigate('/configuracion'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Settings size={16} />
                  Configuración
                </button>
                <div className="border-t border-neutral-100 my-2" />
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error-600 hover:bg-error-50"
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 header-polished flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-xl font-semibold text-neutral-900">{currentPage}</h1>
            
            {/* Badge de rol actual */}
            <Badge 
              variant="soft" 
              color={roleStyles.badge}
              className="hidden sm:inline-flex"
            >
              {currentUser.rol}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Global search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center bg-neutral-100 hover:bg-neutral-200 rounded-xl px-4 py-2 gap-2 transition-colors w-52"
            >
              <Search size={18} className="text-neutral-400 shrink-0" />
              <span className="text-sm text-neutral-400 flex-1 text-left">Buscar...</span>
              <kbd className="hidden lg:flex items-center text-[10px] text-neutral-400 bg-white rounded px-1.5 py-0.5 border border-neutral-200 font-mono">
                ⌘K
              </kbd>
            </button>

            {searchOpen && <GlobalSearchPanel onClose={() => setSearchOpen(false)} />}

            {/* Help / Tour restart */}
            <button
              onClick={() => {
                resetOnboardingTour();
                setShowTour(true);
              }}
              className="p-2 rounded-xl text-neutral-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Ver tour de ayuda"
              aria-label="Ver tour de ayuda"
            >
              <HelpCircle size={20} />
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* User Switcher Dropdown */}
            <UserSwitcher variant="dropdown" onSwitch={() => navigate('/dashboard')} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 lg:px-8 pb-4 lg:pb-8 overflow-auto bg-[#FAFAF8]">
          <Outlet />
        </main>
      </div>
      </div>

      {/* Onboarding Tour */}
      <OnboardingTour
        forceShow={showTour}
        onComplete={() => setShowTour(false)}
      />

      {/* Role-specific welcome modal */}
      <DemoAppOnboarding />
    </div>
  );
};

export default MainLayout;

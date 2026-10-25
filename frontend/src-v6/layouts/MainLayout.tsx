import { workspaceNavigation, workspaceTitle, workspaceSectionPath, workspaceRoleLabel, isActorWorkspace } from '../utils/workspaceNavigation';
import { TrainingBanner } from '../components/TrainingBanner';
/**
 * SITREP v6 - Main Layout
 * =======================
 * Layout principal con sidebar y header - Adaptado por rol
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { currentNavigationItem } from '../utils/navigationSelection';
import { inspectionContextLabel } from '../utils/inspectionContextLabel';
import { GlobalSearchPanel } from '../components/GlobalSearchPanel';
import { Settings, Search, Menu, X, User, ChevronDown, LogOut, SwitchCamera, HelpCircle, BookOpen,  } from 'lucide-react';
import { Button } from '../components/ui/ButtonV2';
import { Badge } from '../components/ui/BadgeV2';
import { UserSwitcher } from '../components/ui/UserSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { SitrepMark, SitrepWordmark } from '../components/SitrepMark';
import { NotificacionesPoller } from '../components/NotificacionesPoller';
import { ToastContainer } from '../components/ui/Toast';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';
import { SWUpdateBanner } from '../components/SWUpdateBanner';
import CompanyContextBar from '../components/CompanyContextBar';

import { OnboardingTour, resetOnboardingTour } from '../components/OnboardingTour';
import { DemoAppOnboarding } from '../components/DemoAppOnboarding';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { ImpersonationBanner } from '../components/ImpersonationBanner';

import { SupportBubble } from '../components/SupportBubble';
import { ApplicantLayout } from './ApplicantLayout';
import { AttentionBadge } from '../components/AttentionBadge';
import { useAttentionCounts } from '../hooks/useAttentionCounts';

// ========================================
// COMPONENT
// ========================================
export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const closeSidebar = () => { setSidebarOpen(false); menuTrigger.current?.focus(); };
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSidebarOpen(false); menuTrigger.current?.focus(); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);
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
  useEffect(() => { setSidebarOpen(false); setUserMenuOpen(false); }, [location.pathname]);
  const isInspectionCase = /\/inspecciones\/[^/]+/.test(location.pathname);
  const isActorInspection = /^\/(?:(?:app|mobile)\/)?(?:mis-inspecciones|requerimientos)(?:\/|$)/.test(location.pathname);
  const inlineSupport = isActorWorkspace(location.pathname) || /^(?:\/(?:app|mobile))?\/dashboard\/?$/.test(location.pathname) || isInspectionCase || isActorInspection || /^\/(?:(?:app|mobile)\/)?(?:mi-solicitud|empresas|manifiestos(?:\/[^/]+(?:\/adendas)?)?|transporte\/(?:viaje\/[^/]+|cargas|perfil))\/?$/.test(location.pathname);
  const navigate = useNavigate();
  const { currentUser, logout, isAdmin, isGenerador, isTransportista, isOperador, isAdminTransportista, isAdminGenerador, isAdminOperador, canAccess, isLoading, isRestricted } = useAuth();
  const { impersonationData, exitImpersonation } = useImpersonation();
  const attention = useAttentionCounts();

  const navigation = useMemo(() => workspaceNavigation(currentUser), [currentUser]);
  const adminItems = navigation.filter(item => item.section === 'admin');
  const toolsItems = navigation.filter(item => item.section === 'tools');

  // Guard: show loading or redirect if no user
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <SitrepMark size={40} className="motion-safe:animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Will be handled by router redirect, but guard against null access
    return null;
  }

  if (isRestricted) return <ApplicantLayout />;

  // Configuración de colores según rol (para header badges)
  const inspectionLabel = inspectionContextLabel(currentUser, location.pathname);
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

  const navItems = navigation.filter(item => item.section === 'main');
  const currentItem = currentNavigationItem(workspaceSectionPath(location.pathname, currentUser, location.state), navigation);
  const currentPage = workspaceTitle(location.pathname);

  return (
    <div data-app-shell className="h-dvh bg-[#F8F8F6] flex flex-col overflow-hidden">
      <NotificacionesPoller />
      {/* Impersonation banner — amber bar above everything */}
      {currentUser?.training && !impersonationData && <TrainingBanner user={currentUser} />}
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
          w-64 h-full shrink-0 sidebar-polished border-r border-[#164D32]
          flex flex-col
          transition-transform duration-300 ease-out
          ${sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="min-h-16 flex items-center gap-2 px-4 lg:px-6 border-b border-neutral-200 bg-white">
          <SitrepMark size={36} className="shrink-0 lg:mr-1" />
          <div className="min-w-0 flex-1">
            <SitrepWordmark className="font-bold text-lg" />
            <span title={`Rol base: ${currentUser.rol}`} className="block break-words text-xs font-medium text-neutral-600 lg:inline lg:ml-1">{inspectionLabel ?? workspaceRoleLabel(currentUser.rol)}</span>
          </div>
          <button type="button" aria-label="Cerrar menú" onClick={closeSidebar}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 lg:hidden">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Navegación principal" className="flex-1 py-4 px-3 space-y-1 overflow-y-auto sidebar-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isItemActive = currentItem?.path === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isItemActive ? 'page' : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-xl
                  font-medium text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                  ${isItemActive
                    ? 'bg-white/20 text-white hover:text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon size={20} />
                {item.label}
              </Link>
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
                const isItemActive = currentItem?.path === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isItemActive ? 'page' : undefined}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-xl
                      font-medium text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                      ${isItemActive
                        ? 'bg-white/20 text-white hover:text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <Icon size={20} />
                    {item.label}
                    {item.path === '/admin/solicitudes' && <AttentionBadge count={attention.applicationPending} />}
                  </Link>
                );
              })}
            </div>
          )}
          
          {/* Only ADMIN can request a temporary view of another user. */}
          {isAdmin && !currentUser?.training && <div className="mt-6 pt-6 border-t border-white/15">
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
                  ? 'bg-white/20 text-white hover:text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <SwitchCamera size={20} />
              Ver como otro usuario
            </NavLink>
          </div>}
          
          <div className="mt-4 border-t border-white/15 pt-4">
            {toolsItems.map(item => <NavLink key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={({isActive}) => 'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium '+(isActive?'bg-white/20 text-white hover:text-white':'text-white/70 hover:bg-white/10 hover:text-white')}>
              <item.icon size={20} aria-hidden="true"/>{item.label}{item.path==='/soporte'&&<AttentionBadge count={attention.support}/>}
            </NavLink>)}
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
                {currentUser.sector&&currentUser.sector!==currentUser.nombre&&<p className="text-xs text-white/60">{currentUser.sector}</p>}
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
                  Mi perfil
                </NavLink>
                {isAdmin && !currentUser?.training && <NavLink to="/switch-user" className="w-full flex items-center gap-2 px-4 py-2 text-sm text-primary-800 hover:bg-primary-50">
                  <SwitchCamera size={16} />
                  Ver como otro usuario
                </NavLink>}
                <button
                  onClick={() => { navigate('/configuracion'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Settings size={16} />
                  Configuración
                </button>
                <div className="border-t border-neutral-100 my-2" />
                <button
                  onClick={() => { void logout(); navigate('/login', { replace: true, state: null }); }}
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Header */}
        <header className="h-16 shrink-0 min-w-0 header-polished flex items-center justify-between gap-2 lg:gap-4 px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-4">
            <Button
              variant="ghost"
              size="base"
              className="shrink-0 lg:hidden"
              ref={menuTrigger}
              aria-label="Abrir menú"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 sm:flex-row sm:items-center sm:justify-start sm:gap-4">
              <h1 title={currentPage} className="min-w-0 whitespace-normal break-words text-base leading-5 sm:truncate sm:text-xl sm:leading-normal font-semibold text-neutral-900">{currentPage}</h1>

              {/* Badge de rol actual */}
              <Badge
                variant="soft"
                color={inspectionLabel ? 'primary' : roleStyles.badge}
                className="max-w-full self-start whitespace-normal break-words py-0.5 sm:py-1 sm:shrink-0 sm:self-auto"
                aria-label="Función actual"
                title={`Rol base: ${currentUser.rol}`}
              >
                {inspectionLabel ?? workspaceRoleLabel(currentUser.rol)}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {/* Global search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar en SITREP"
              className="hidden h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-100 px-3 transition-colors hover:bg-neutral-200 md:flex lg:w-52 lg:justify-start lg:px-4"
            >
              <Search size={18} className="text-neutral-400 shrink-0" />
              <span className="hidden flex-1 text-left text-sm text-neutral-400 lg:block">Buscar...</span>
              <kbd className="hidden lg:flex items-center text-[10px] text-neutral-400 bg-white rounded px-1.5 py-0.5 border border-neutral-200 font-mono">
                ⌘K
              </kbd>
            </button>

            {searchOpen && <GlobalSearchPanel onClose={() => setSearchOpen(false)} />}

            {/* Help / Tour restart */}
            {inlineSupport ? <SupportBubble inline hidden={sidebarOpen || searchOpen || showTour} /> : <button
              onClick={() => {
                resetOnboardingTour();
                setShowTour(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Ver tour de ayuda"
              aria-label="Ver tour de ayuda"
            >
              <HelpCircle size={20} />
            </button>}

            {/* Notifications */}
            <NotificationBell />

            {/* User Switcher Dropdown */}
            <div className="hidden sm:block"><UserSwitcher variant="dropdown" onSwitch={() => navigate('/dashboard')} /></div>
          </div>
        </header>

        <SWUpdateBanner />
        <CompanyContextBar />
        <ToastContainer />

        {/* Keep absolutely positioned field controls inside this scroll container. */}
        <main className={'relative min-h-0 min-w-0 flex-1 bg-[#FAFAF8] ' + (isInspectionCase ? 'overflow-clip p-4 lg:px-8' : 'overflow-auto [scrollbar-gutter:stable] px-4 lg:px-8 lg:pb-8 ' + (inlineSupport ? 'pb-4' : 'pb-12')) + ' pt-4'}>
          <Outlet />
        </main>

        {/* Footer — on phones keep its text clear of the floating help button. */}
        <footer className={'border-t border-neutral-100 bg-white pl-4 pr-16 sm:px-4 py-2.5 items-center justify-center gap-3 shrink-0 ' + (/\/inspecciones\/[^/]+/.test(location.pathname) ? 'hidden' : 'flex')}>
          <img src="/logo-mendoza.webp" alt="Gobierno de Mendoza" className="h-6 w-auto opacity-60" />
          <span className="text-xs text-neutral-400">Provincia de Mendoza — SITREP v6</span>
        </footer>
      </div>
      </div>

      {/* Onboarding Tour */}
      <OnboardingTour
        forceShow={showTour}
        onComplete={() => setShowTour(false)}
      />

      {/* Role-specific welcome modal */}
      <DemoAppOnboarding />
      {!inlineSupport && <SupportBubble hidden={sidebarOpen || searchOpen || showTour} />}
    </div>
  );
};

export default MainLayout;

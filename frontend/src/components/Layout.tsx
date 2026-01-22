import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// ELIMINADO: preferenciasService causaba loop infinito con error 401
// import { preferenciasService, type PreferenciasUsuario } from '../services/preferencias.service';
type PreferenciasUsuario = { mostrarTourInicio: boolean; ultimaVersionTour: string | null };
import {
    LayoutDashboard,
    FileText,
    MapPin,
    Settings,
    LogOut,
    Menu,
    X,
    Truck,
    Building2,
    Factory,
    Shield,
    ChevronDown,
    User,
    BarChart3,
    Users,
    Bell,
    QrCode,
    HelpCircle,
    Activity,
    Command
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import QRScanner from './QRScanner';
// COMENTADO: Componentes deshabilitados por overlay bloqueante
// import OnboardingTour from './OnboardingTour';
// import ContextualHelp from './ContextualHelp';
import ProfileSwitcher from './ProfileSwitcher';
import { demoService } from '../services/demo.service';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, logout, loading, effectiveRole, effectiveRoleName, effectiveUserName, demoProfile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    // COMENTADO: Estados de componentes deshabilitados
    const [_showTour, _setShowTour] = useState(false);
    const [_showContextualHelp, _setShowContextualHelp] = useState(false);
    const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
    // demoProfileActive ahora viene del context (demoProfile !== null)
    const [_preferencias, _setPreferencias] = useState<PreferenciasUsuario | null>(null);
    const [_prefsLoaded, _setPrefsLoaded] = useState(false);

    // ELIMINADO COMPLETAMENTE: preferenciasService causaba loop infinito
    // La carga de preferencias fue removida para evitar el crash RESULT_CODE_KILLED_BAD_MESSAGE

    // COMENTADO: TOUR - Puede bloquear interacción
    // useEffect(() => {
    //     if (location.pathname === '/dashboard' && prefsLoaded && preferencias?.mostrarTourInicio) {
    //         const timer = setTimeout(() => setShowTour(true), 800);
    //         return () => clearTimeout(timer);
    //     }
    // }, [location.pathname, prefsLoaded, preferencias?.mostrarTourInicio]);

    // COMENTADO: AYUDA CONTEXTUAL - Bloquea interacción con overlay
    // useEffect(() => {
    //     const helpShown = localStorage.getItem('contextualHelpShown');
    //     if (!helpShown && location.pathname === '/dashboard') {
    //         const timer = setTimeout(() => {
    //             setShowContextualHelp(true);
    //             localStorage.setItem('contextualHelpShown', 'true');
    //         }, 2000);
    //         return () => clearTimeout(timer);
    //     }
    // }, [location.pathname]);

    // ELIMINADO: Funciones de tour deshabilitadas (preferenciasService eliminado)
    const _handleStartTour = async () => {
        localStorage.removeItem('tourCompleted');
        // preferenciasService.reactivarTour() - ELIMINADO
        _setPreferencias(prev => prev ? { ...prev, mostrarTourInicio: true } : null);
        navigate('/dashboard');
        setTimeout(() => _setShowTour(true), 300);
    };

    // Función _handleCompleteTour eliminada - no se usa

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Fix 7: Memoizar getRolIcon para evitar crear JSX nuevo en cada render
    const rolIcon = useMemo(() => {
        switch (effectiveRole) {
            case 'ADMIN':
                return <Shield size={20} />;
            case 'GENERADOR':
                return <Factory size={20} />;
            case 'TRANSPORTISTA':
                return <Truck size={20} />;
            case 'OPERADOR':
                return <Building2 size={20} />;
            default:
                return <User size={20} />;
        }
    }, [effectiveRole]);

    const getRolLabel = () => {
        // Usar effectiveRoleName del context (ya calculado)
        return effectiveRoleName || effectiveRole || '';
    };

    // Título Dashboard dinámico por rol (SINCRONIZADO con APP)
    const getDashboardLabel = (): string => {
        switch (effectiveRole) {
            case 'ADMIN': return 'Dashboard';
            case 'GENERADOR': return 'Mis Manifiestos';
            case 'TRANSPORTISTA': return 'Mis Viajes';
            case 'OPERADOR': return 'Recepciones';
            default: return 'Dashboard';
        }
    };

    // Menú diferenciado por rol (usa effectiveRole para demo)
    const getNavItems = () => {
        const baseItems = [
            { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: getDashboardLabel() },
        ];

        switch (effectiveRole) {
            case 'ADMIN':
                return [
                    ...baseItems,
                    { path: '/admin/centro-control', icon: <Command size={20} />, label: 'Centro de Control' },
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Manifiestos' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Tracking GPS' },
                    { path: '/admin/usuarios-panel', icon: <User size={20} />, label: 'Usuarios' },
                    { path: '/admin/logs', icon: <Shield size={20} />, label: 'Auditoria' },
                    { path: '/admin/actividad', icon: <Activity size={20} />, label: 'Timeline' },
                    { path: '/alertas', icon: <Bell size={20} />, label: 'Alertas' },
                    { path: '/actores', icon: <Users size={20} />, label: 'Actores' },
                    // Admin Sectorial
                    { path: '/admin/generadores', icon: <Factory size={20} />, label: 'Admin Generadores' },
                    { path: '/admin/transportistas', icon: <Truck size={20} />, label: 'Admin Transportistas' },
                    { path: '/admin/operadores', icon: <Building2 size={20} />, label: 'Admin Operadores' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes' },
                    { path: '/configuracion', icon: <Settings size={20} />, label: 'Config' },
                ];
            case 'ADMIN_TRANSPORTISTAS':
                return [
                    ...baseItems,
                    { path: '/admin/transportistas', icon: <Truck size={20} />, label: 'Mi Panel' },
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Manifiestos' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Tracking GPS' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes' },
                ];
            case 'ADMIN_OPERADORES':
                return [
                    ...baseItems,
                    { path: '/admin/operadores', icon: <Building2 size={20} />, label: 'Mi Panel' },
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Manifiestos' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes' },
                ];
            case 'ADMIN_GENERADORES':
                return [
                    ...baseItems,
                    { path: '/admin/generadores', icon: <Factory size={20} />, label: 'Mi Panel' },
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Manifiestos' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes' },
                ];
            case 'GENERADOR':
                return [
                    ...baseItems,
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Mis Manifiestos' },
                    { path: '/manifiestos/nuevo', icon: <FileText size={20} />, label: 'Nuevo Manifiesto' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Seguimiento' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Mis Reportes' },
                ];
            case 'TRANSPORTISTA':
                return [
                    ...baseItems,
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Viajes Asignados' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Mi Ruta GPS' },
                    { path: '/demo-app', icon: <Truck size={20} />, label: 'App Movil' },
                ];
            case 'OPERADOR':
                return [
                    ...baseItems,
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Recepciones' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Llegadas Hoy' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes Planta' },
                ];
            default:
                return baseItems;
        }
    };

    // Fix 6: Memoizar navItems para evitar crear arrays nuevos en cada render
    const navItems = useMemo(() => getNavItems(), [effectiveRole]);

    // Loading state while auth is initializing
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="logo-icon" style={{ width: 64, height: 64, color: '#10b981' }}>
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M12 20L18 26L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <span>Cargando SITREP...</span>
            </div>
        );
    }

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <div className="logo-icon">
                            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M12 20L18 26L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8 20C8 13.373 13.373 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M32 20C32 26.627 26.627 32 20 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div className="logo-text">
                            <span className="logo-title">SITREP</span>
                            <span className="logo-subtitle">Residuos Peligrosos</span>
                        </div>
                    </div>
                    <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {rolIcon}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user?.nombre} {user?.apellido}</span>
                            <span className="user-role">{getRolLabel()}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="main-wrapper">
                {/* Header */}
                <header className="header">
                    <button className="menu-button" onClick={() => setSidebarOpen(true)}>
                        <Menu size={24} />
                    </button>

                    <div className="header-content">
                        <h1 className="page-title">
                            {navItems.find(item => item.path === location.pathname)?.label || 'Sistema'}
                        </h1>
                    </div>

                    <div className="header-actions">
                        {/* Contextual Help Button */}
                        <button
                            className="header-icon-btn"
                            onClick={() => _setShowContextualHelp(true)}
                            title="Ayuda contextual"
                        >
                            <HelpCircle size={20} />
                        </button>

                        {/* Tour Button */}
                        <button
                            className="header-icon-btn help-btn"
                            onClick={_handleStartTour}
                            title="Ver tour guiado"
                        >
                            ??
                        </button>

                        {/* QR Scanner Button */}
                        <button
                            className="header-icon-btn"
                            onClick={() => setQrScannerOpen(true)}
                            title="Escanear QR"
                        >
                            <QrCode size={20} />
                        </button>

                        {/* Notifications */}
                        <NotificationBell />

                        {/* User Menu */}
                        <div className="user-menu">
                            <button
                                className="user-menu-trigger"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                            >
                                <div className="user-menu-avatar">
                                    {rolIcon}
                                </div>
                                <span className="user-menu-name">{effectiveUserName}</span>
                                <ChevronDown size={16} />
                            </button>

                            {userMenuOpen && (
                                <div className="user-menu-dropdown">
                                    <div className="user-menu-header">
                                        <strong>{effectiveUserName}</strong>
                                        <span>{effectiveRoleName}</span>
                                        {demoProfile && <span className="demo-indicator">MODO DEMO</span>}
                                    </div>
                                    <div className="user-menu-divider" />
                                    <Link
                                        to="/mi-perfil"
                                        className="user-menu-item"
                                        onClick={() => setUserMenuOpen(false)}
                                    >
                                        <User size={16} />
                                        <span>Mi Perfil</span>
                                    </Link>
                                    <div className="user-menu-divider" />
                                    <div className="user-menu-section">
                                        <span className="user-menu-section-title">Modo Demo:</span>
                                        <button
                                            className={`user-menu-item demo-profile-btn ${demoProfile ? 'active' : ''}`}
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                setProfileSwitcherOpen(true);
                                            }}
                                        >
                                            <Users size={16} />
                                            <span>Cambiar Perfil</span>
                                            {demoProfile && <span className="demo-badge">DEMO</span>}
                                        </button>
                                        {demoProfile && (
                                            <button
                                                className="user-menu-item"
                                                onClick={() => {
                                                    demoService.clearProfile();
                                                    setUserMenuOpen(false);
                                                }}
                                            >
                                                <X size={16} />
                                                <span>Volver a mi perfil</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="user-menu-divider" />
                                    <button className="user-menu-item" onClick={handleLogout}>
                                        <LogOut size={16} />
                                        <span>Cerrar sesión</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="main-content">
                    {children}
                </main>
            </div>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* QR Scanner Modal */}
            {qrScannerOpen && (
                <QRScanner onClose={() => setQrScannerOpen(false)} />
            )}

            {/* COMENTADO: Onboarding Tour - puede causar overlay
            <OnboardingTour
                userRole={user?.rol as 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR'}
                isOpen={showTour}
                onComplete={handleCompleteTour}
            />
            */}

            {/* COMENTADO: Contextual Help - puede causar overlay
            <ContextualHelp
                isActive={showContextualHelp}
                onClose={() => _setShowContextualHelp(false)}
            />
            */}

            {/* Profile Switcher - Restaurado */}
            <ProfileSwitcher
                isOpen={profileSwitcherOpen}
                onClose={() => setProfileSwitcherOpen(false)}
                onProfileChanged={() => {
                    // El estado se actualiza automáticamente via evento en AuthContext
                }}
            />
        </div>
    );
};

export default Layout;


import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { preferenciasService, type PreferenciasUsuario } from '../services/preferencias.service';
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
import OnboardingTour from './OnboardingTour';
import ContextualHelp from './ContextualHelp';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, logout, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [showTour, setShowTour] = useState(false);
    const [showContextualHelp, setShowContextualHelp] = useState(false);
    const [switchingProfile, setSwitchingProfile] = useState(false);
    const [preferencias, setPreferencias] = useState<PreferenciasUsuario | null>(null);
    const [prefsLoaded, setPrefsLoaded] = useState(false);

    // Usuarios de prueba para cambio rápido de perfil
    const PROFILE_USERS = [
        { email: 'admin@dgfa.mendoza.gov.ar', label: 'Administrador SITREP', icon: Shield, rol: 'ADMIN' },
        { email: 'quimica.mendoza@industria.com', label: 'Generador', icon: Factory, rol: 'GENERADOR' },
        { email: 'transportes.andes@logistica.com', label: 'Transportista', icon: Truck, rol: 'TRANSPORTISTA' },
        { email: 'tratamiento.residuos@planta.com', label: 'Operador', icon: Building2, rol: 'OPERADOR' }
    ];

    // Cambiar perfil haciendo login real con el backend
    const handleSwitchProfile = useCallback(async (email: string) => {
        setSwitchingProfile(true);
        setUserMenuOpen(false);
        try {
            await authService.login(email, 'password');
            window.location.href = '/dashboard';
        } catch (err) {
            console.error('Error cambiando perfil:', err);
            alert('Error al cambiar perfil. Verifique las credenciales.');
        } finally {
            setSwitchingProfile(false);
        }
    }, []);

    // Cargar preferencias del usuario al iniciar
    useEffect(() => {
        const loadPreferencias = async () => {
            if (user?.id) {
                try {
                    const prefs = await preferenciasService.getMisPreferencias();
                    setPreferencias(prefs);
                } catch (error) {
                    console.error('Error cargando preferencias:', error);
                    setPreferencias({ mostrarTourInicio: false, ultimaVersionTour: null });
                }
                setPrefsLoaded(true);
            }
        };
        loadPreferencias();
    }, [user?.id]);

    // TOUR: Solo se muestra si el usuario tiene habilitada la preferencia
    useEffect(() => {
        if (location.pathname === '/dashboard' && prefsLoaded && preferencias?.mostrarTourInicio) {
            const timer = setTimeout(() => setShowTour(true), 800);
            return () => clearTimeout(timer);
        }
    }, [location.pathname, prefsLoaded, preferencias?.mostrarTourInicio]);

    // AYUDA CONTEXTUAL: Solo la primera vez
    useEffect(() => {
        const helpShown = localStorage.getItem('contextualHelpShown');
        if (!helpShown && location.pathname === '/dashboard') {
            const timer = setTimeout(() => {
                setShowContextualHelp(true);
                localStorage.setItem('contextualHelpShown', 'true');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname]);

    const handleStartTour = async () => {
        localStorage.removeItem('tourCompleted');
        // Reactivar el tour en preferencias si estaba desactivado
        try {
            await preferenciasService.reactivarTour();
            setPreferencias(prev => prev ? { ...prev, mostrarTourInicio: true } : null);
        } catch (error) {
            console.error('Error reactivando tour:', error);
        }
        navigate('/dashboard');
        setTimeout(() => setShowTour(true), 300);
    };

    const handleCompleteTour = async () => {
        setShowTour(false);
        // Desactivar el tour en preferencias al completarlo
        try {
            await preferenciasService.skipTour('1.0.0');
            setPreferencias(prev => prev ? { ...prev, mostrarTourInicio: false } : null);
        } catch (error) {
            console.error('Error desactivando tour:', error);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const getRolIcon = () => {
        switch (user?.rol) {
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
    };

    const getRolLabel = () => {
        switch (user?.rol) {
            case 'ADMIN':
                return 'Administrador SITREP';
            case 'ADMIN_TRANSPORTISTAS':
                return 'Admin Transportistas';
            case 'ADMIN_OPERADORES':
                return 'Admin Operadores';
            case 'ADMIN_GENERADORES':
                return 'Admin Generadores';
            case 'GENERADOR':
                return 'Generador de Residuos';
            case 'TRANSPORTISTA':
                return 'Transportista';
            case 'OPERADOR':
                return 'Operador de Tratamiento';
            default:
                return user?.rol;
        }
    };

    // Título Dashboard dinámico por rol (SINCRONIZADO con APP)
    const getDashboardLabel = (): string => {
        switch (user?.rol) {
            case 'ADMIN': return 'Dashboard';
            case 'GENERADOR': return 'Mis Manifiestos';
            case 'TRANSPORTISTA': return 'Mis Viajes';
            case 'OPERADOR': return 'Recepciones';
            default: return 'Dashboard';
        }
    };

    // Menú diferenciado por rol
    const getNavItems = () => {
        const baseItems = [
            { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: getDashboardLabel() },
        ];

        switch (user?.rol) {
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

    const navItems = getNavItems();

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
                            {getRolIcon()}
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
                            onClick={() => setShowContextualHelp(true)}
                            title="Ayuda contextual"
                        >
                            <HelpCircle size={20} />
                        </button>

                        {/* Tour Button */}
                        <button
                            className="header-icon-btn help-btn"
                            onClick={handleStartTour}
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
                                    {getRolIcon()}
                                </div>
                                <span className="user-menu-name">{user?.nombre}</span>
                                <ChevronDown size={16} />
                            </button>

                            {userMenuOpen && (
                                <div className="user-menu-dropdown">
                                    <div className="user-menu-header">
                                        <strong>{user?.nombre} {user?.apellido}</strong>
                                        <span>{user?.email}</span>
                                    </div>
                                    <div className="user-menu-divider" />
                                    <div className="user-menu-section">
                                        <span className="user-menu-section-title">Cambiar perfil:</span>
                                        {PROFILE_USERS.map((profile) => {
                                            const IconComponent = profile.icon;
                                            const isCurrentUser = user?.email === profile.email;
                                            return (
                                                <button
                                                    key={profile.email}
                                                    className={`user-menu-item ${isCurrentUser ? 'active' : ''}`}
                                                    onClick={() => !isCurrentUser && handleSwitchProfile(profile.email)}
                                                    disabled={isCurrentUser || switchingProfile}
                                                >
                                                    <IconComponent size={16} />
                                                    <span>{profile.label}</span>
                                                    {isCurrentUser && <span className="current-badge">Actual</span>}
                                                </button>
                                            );
                                        })}
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

            {/* Onboarding Tour */}
            <OnboardingTour
                userRole={user?.rol as 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR'}
                isOpen={showTour}
                onComplete={handleCompleteTour}
            />

            {/* Contextual Help */}
            <ContextualHelp
                isActive={showContextualHelp}
                onClose={() => setShowContextualHelp(false)}
            />
        </div>
    );
};

export default Layout;


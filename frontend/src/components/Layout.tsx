import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    Upload,
    QrCode,
    HelpCircle
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

    // TOUR: Siempre se muestra al cargar el dashboard
    useEffect(() => {
        if (location.pathname === '/dashboard') {
            const timer = setTimeout(() => setShowTour(true), 800);
            return () => clearTimeout(timer);
        }
    }, [location.pathname]);

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

    const handleStartTour = () => {
        localStorage.removeItem('tourCompleted');
        navigate('/dashboard');
        setTimeout(() => setShowTour(true), 300);
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

    // Menú diferenciado por rol
    const getNavItems = () => {
        const baseItems = [
            { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        ];

        switch (user?.rol) {
            case 'ADMIN':
                return [
                    ...baseItems,
                    { path: '/manifiestos', icon: <FileText size={20} />, label: 'Manifiestos' },
                    { path: '/tracking', icon: <MapPin size={20} />, label: 'Tracking GPS' },
                    { path: '/reportes', icon: <BarChart3 size={20} />, label: 'Reportes' },
                    { path: '/actores', icon: <Users size={20} />, label: 'Gestión Actores' },
                    { path: '/alertas', icon: <Bell size={20} />, label: 'Configurar Alertas' },
                    { path: '/carga-masiva', icon: <Upload size={20} />, label: 'Carga Masiva' },
                    { path: '/configuracion', icon: <Settings size={20} />, label: 'Configuración' },
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
                    { path: '/demo-app', icon: <Truck size={20} />, label: 'App Móvil' },
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
                                        <button
                                            className="user-menu-item"
                                            onClick={() => {
                                                localStorage.setItem('user', JSON.stringify({ id: '1', email: 'admin@example.com', nombre: 'Admin', apellido: 'Demo', rol: 'ADMIN' }));
                                                window.location.reload();
                                            }}
                                        >
                                            <Shield size={16} />
                                            <span>Administrador SITREP</span>
                                        </button>
                                        <button
                                            className="user-menu-item"
                                            onClick={() => {
                                                localStorage.setItem('user', JSON.stringify({ id: '2', email: 'generador@example.com', nombre: 'Generador', apellido: 'Demo', rol: 'GENERADOR' }));
                                                window.location.reload();
                                            }}
                                        >
                                            <Factory size={16} />
                                            <span>Generador</span>
                                        </button>
                                        <button
                                            className="user-menu-item"
                                            onClick={() => {
                                                localStorage.setItem('user', JSON.stringify({ id: '3', email: 'transportista@example.com', nombre: 'Transportista', apellido: 'Demo', rol: 'TRANSPORTISTA' }));
                                                window.location.reload();
                                            }}
                                        >
                                            <Truck size={16} />
                                            <span>Transportista</span>
                                        </button>
                                        <button
                                            className="user-menu-item"
                                            onClick={() => {
                                                localStorage.setItem('user', JSON.stringify({ id: '4', email: 'operador@example.com', nombre: 'Operador', apellido: 'Demo', rol: 'OPERADOR' }));
                                                window.location.reload();
                                            }}
                                        >
                                            <Building2 size={16} />
                                            <span>Operador</span>
                                        </button>
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
                onComplete={() => setShowTour(false)}
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


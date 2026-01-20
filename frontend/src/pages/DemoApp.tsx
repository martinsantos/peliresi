import React, { useState } from 'react';
import MobileApp from './MobileApp';
import {
    ArrowLeft, Smartphone, Zap, WifiOff, QrCode, MapPin, Bell, Users,
    FileText, Truck, Factory, Building2, Plus, Eye, Navigation, UserCircle,
    ListChecks, Settings, ChevronRight, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import InstallPWAButton from '../components/InstallPWAButton';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
// import DemoAppOnboarding from '../components/DemoAppOnboarding'; // COMENTADO: Bloquea interacción
import './DemoApp.css';

// Pantallas por rol con casos de uso
const roleScreens = {
    ADMIN: {
        icon: <Users size={20} />,
        color: '#8b5cf6',
        label: 'Administrador',
        screens: [
            { name: 'Dashboard', desc: 'Estadísticas generales del sistema', icon: <ListChecks size={16} /> },
            { name: 'Manifiestos', desc: 'Lista de todos los manifiestos', icon: <FileText size={16} /> },
            { name: 'Tracking GPS', desc: 'Mapa de transportes activos', icon: <MapPin size={16} /> },
            { name: 'Gestión Actores', desc: 'Administrar generadores, transportistas, operadores', icon: <Users size={16} /> },
            { name: 'Alertas', desc: 'Notificaciones y alertas del sistema', icon: <Bell size={16} /> },
            { name: 'Perfil', desc: 'Configuración de cuenta', icon: <Settings size={16} /> },
        ]
    },
    GENERADOR: {
        icon: <Factory size={20} />,
        color: '#10b981',
        label: 'Generador',
        screens: [
            { name: 'Dashboard', desc: 'Resumen de manifiestos propios', icon: <ListChecks size={16} /> },
            { name: 'Nuevo Manifiesto', desc: 'Crear nuevo manifiesto digital', icon: <Plus size={16} /> },
            { name: 'Mis Manifiestos', desc: 'Historial de manifiestos generados', icon: <FileText size={16} /> },
            { name: 'Escanear QR', desc: 'Verificar manifiesto escaneando código', icon: <QrCode size={16} /> },
            { name: 'Alertas', desc: 'Notificaciones de mis manifiestos', icon: <Bell size={16} /> },
            { name: 'Perfil', desc: 'Mis datos y configuración', icon: <UserCircle size={16} /> },
        ]
    },
    TRANSPORTISTA: {
        icon: <Truck size={20} />,
        color: '#f59e0b',
        label: 'Transportista',
        screens: [
            { name: 'Dashboard', desc: 'Viajes pendientes y activos', icon: <ListChecks size={16} /> },
            { name: 'Escanear QR', desc: 'Escanear manifiesto para iniciar viaje', icon: <QrCode size={16} /> },
            { name: 'Viaje Activo', desc: 'Seguimiento GPS del viaje actual', icon: <Navigation size={16} /> },
            { name: 'Confirmar Retiro', desc: 'Registrar retiro de carga con GPS', icon: <MapPin size={16} /> },
            { name: 'Confirmar Entrega', desc: 'Registrar entrega en destino', icon: <Building2 size={16} /> },
            { name: 'Historial', desc: 'Viajes completados', icon: <Eye size={16} /> },
        ]
    },
    OPERADOR: {
        icon: <Building2 size={20} />,
        color: '#3b82f6',
        label: 'Operador',
        screens: [
            { name: 'Dashboard', desc: 'Cargas entrantes y recibidas', icon: <ListChecks size={16} /> },
            { name: 'Escanear QR', desc: 'Escanear manifiesto al recibir carga', icon: <QrCode size={16} /> },
            { name: 'Confirmar Recepción', desc: 'Registrar recepción con pesaje', icon: <Building2 size={16} /> },
            { name: 'Tratamiento', desc: 'Registrar tratamiento realizado', icon: <Settings size={16} /> },
            { name: 'Certificados', desc: 'Generar certificado de tratamiento', icon: <FileText size={16} /> },
            { name: 'Historial', desc: 'Manifiestos procesados', icon: <Eye size={16} /> },
        ]
    }
};

const DemoApp: React.FC = () => {
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    // COMENTADO: Onboarding bloquea interacción con overlay
    // const [showOnboarding, setShowOnboarding] = useState(() => {
    //     return localStorage.getItem('demoAppOnboardingCompleted') !== 'true';
    // });
    // const handleOnboardingComplete = () => {
    //     setShowOnboarding(false);
    // };
    // const handleShowOnboarding = () => {
    //     setShowOnboarding(true);
    // };

    return (
        <div className="demo-page">
            {/* COMENTADO: Demo App Onboarding - bloquea interacción
            <DemoAppOnboarding
                isOpen={showOnboarding}
                onComplete={handleOnboardingComplete}
            />
            */}

            {/* Top Bar */}
            <div className="demo-topbar">
                <Link to="/dashboard" className="back-link">
                    <ArrowLeft size={18} />
                    <span>Volver al Dashboard Web</span>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* COMENTADO: Botón de tour - onboarding deshabilitado
                    <button
                        onClick={handleShowOnboarding}
                        className="help-tour-btn"
                        title="Ver Tour de Funcionalidades"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            color: '#10b981',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <HelpCircle size={16} />
                        Ver Tour
                    </button>
                    */}
                    <ConnectivityIndicator size="small" showLabel={true} />
                </div>
            </div>

            {/* Main Demo Area */}
            <div className="demo-wrapper">
                {/* Phone Mockup */}
                <div className="phone-mockup">
                    <div className="phone-notch">
                        <div className="phone-camera"></div>
                    </div>
                    <div className="phone-screen">
                        <MobileApp />
                    </div>
                    <div className="phone-home-indicator"></div>
                </div>

                {/* Info Panel - Enhanced with All Screens */}
                <div className="info-panel">
                    <div className="info-header">
                        <div className="info-badge">
                            <Zap size={16} />
                            <span>PWA</span>
                        </div>
                        <h1>App Móvil PWA</h1>
                        <p className="subtitle">Sistema de Trazabilidad de Residuos Peligrosos</p>
                    </div>

                    {/* Features Grid */}
                    <div className="features-grid">
                        <div className="feature-card">
                            <WifiOff size={24} color="#3b82f6" />
                            <span>Modo Offline</span>
                        </div>
                        <div className="feature-card">
                            <QrCode size={24} color="#10b981" />
                            <span>Escaneo QR</span>
                        </div>
                        <div className="feature-card">
                            <MapPin size={24} color="#f59e0b" />
                            <span>GPS Real</span>
                        </div>
                        <div className="feature-card">
                            <Bell size={24} color="#ec4899" />
                            <span>Push</span>
                        </div>
                    </div>

                    {/* Screens by Role - Expandable */}
                    <div className="roles-section">
                        <h3 className="section-title">
                            <Smartphone size={18} />
                            Pantallas por Rol
                        </h3>

                        {Object.entries(roleScreens).map(([roleKey, role]) => (
                            <div key={roleKey} className="role-accordion">
                                <button
                                    className={`role-header ${expandedRole === roleKey ? 'expanded' : ''}`}
                                    onClick={() => setExpandedRole(expandedRole === roleKey ? null : roleKey)}
                                    style={{ borderLeftColor: role.color }}
                                >
                                    <div className="role-info">
                                        <span className="role-icon" style={{ background: `${role.color}20`, color: role.color }}>
                                            {role.icon}
                                        </span>
                                        <span className="role-name">{role.label}</span>
                                        <span className="screen-count">{role.screens.length} pantallas</span>
                                    </div>
                                    {expandedRole === roleKey ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>

                                {expandedRole === roleKey && (
                                    <div className="screens-list">
                                        {role.screens.map((screen, idx) => (
                                            <div key={idx} className="screen-item">
                                                <span className="screen-icon" style={{ color: role.color }}>
                                                    {screen.icon}
                                                </span>
                                                <div className="screen-info">
                                                    <strong>{screen.name}</strong>
                                                    <span>{screen.desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Install Button */}
                    <InstallPWAButton variant="card" />

                    <div className="demo-hint">
                        <p>💡 Selecciona un rol en el teléfono para probar sus pantallas</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoApp;

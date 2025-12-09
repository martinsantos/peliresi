import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
    Truck, MapPin, Users, BarChart3, Scale,
    QrCode, Shield, Factory, Building2, Smartphone,
    ClipboardCheck, Zap, AlertTriangle, WifiOff, Settings,
    Download, Plus, Eye, Navigation, Wifi
} from 'lucide-react';
import './DemoAppOnboarding.css';

interface DemoSlide {
    id: string;
    role: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'ALL';
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    color: string;
    animationType: 'dashboard' | 'form' | 'qr' | 'map' | 'list' | 'alert' | 'sync';
}

// Slides para todos los roles
const demoSlides: DemoSlide[] = [
    // Bienvenida
    {
        id: 'welcome', role: 'ALL',
        title: '¡Bienvenido a la App Móvil!', subtitle: 'Demo Interactiva',
        description: 'Esta demo muestra las funcionalidades móviles para cada rol del sistema de trazabilidad.',
        icon: <Smartphone />, features: ['4 Roles', 'Offline', 'GPS'],
        color: '#10b981', animationType: 'dashboard'
    },

    // ADMIN
    {
        id: 'admin-dashboard', role: 'ADMIN',
        title: 'Dashboard Admin', subtitle: '🛡️ Administrador DGFA',
        description: 'Vista ejecutiva con KPIs en tiempo real. Estadísticas de manifiestos, transportes activos y alertas.',
        icon: <Shield />, features: ['KPIs', 'Estadísticas', 'Alertas'],
        color: '#10b981', animationType: 'dashboard'
    },
    {
        id: 'admin-monitoring', role: 'ADMIN',
        title: 'Monitoreo GPS', subtitle: '🛡️ Administrador DGFA',
        description: 'Mapa interactivo con ubicación de todos los transportes activos. Actualización cada 30 segundos.',
        icon: <MapPin />, features: ['Mapa vivo', 'Rutas', 'Alertas'],
        color: '#ef4444', animationType: 'map'
    },
    {
        id: 'admin-actors', role: 'ADMIN',
        title: 'Gestión de Actores', subtitle: '🛡️ Administrador DGFA',
        description: 'Administra generadores, transportistas y operadores. Asigna roles y permisos.',
        icon: <Users />, features: ['CRUD', 'Roles', 'Permisos'],
        color: '#8b5cf6', animationType: 'list'
    },
    {
        id: 'admin-reports', role: 'ADMIN',
        title: 'Reportes y Auditoría', subtitle: '🛡️ Administrador DGFA',
        description: 'Informes estadísticos y log de auditoría. Exporta en PDF, CSV o XML.',
        icon: <BarChart3 />, features: ['Reportes', 'Auditoría', 'Export'],
        color: '#3b82f6', animationType: 'dashboard'
    },

    // GENERADOR
    {
        id: 'gen-dashboard', role: 'GENERADOR',
        title: 'Mi Panel', subtitle: '🏭 Generador de Residuos',
        description: 'Resumen de manifiestos: borradores, pendientes, en tránsito y completados.',
        icon: <Factory />, features: ['Mis Stats', 'Acciones', 'Alertas'],
        color: '#3b82f6', animationType: 'dashboard'
    },
    {
        id: 'gen-create', role: 'GENERADOR',
        title: 'Nuevo Manifiesto', subtitle: '🏭 Generador de Residuos',
        description: 'Crea manifiestos desde el móvil. Selecciona residuo, transportista y operador.',
        icon: <Plus />, features: ['Formulario', 'Catálogo', 'Firma'],
        color: '#10b981', animationType: 'form'
    },
    {
        id: 'gen-sign', role: 'GENERADOR',
        title: 'Firma Electrónica', subtitle: '🏭 Generador de Residuos',
        description: 'Firma en pantalla táctil. Genera QR único para seguimiento.',
        icon: <ClipboardCheck />, features: ['Touch', 'QR', 'Notifica'],
        color: '#8b5cf6', animationType: 'form'
    },
    {
        id: 'gen-track', role: 'GENERADOR',
        title: 'Seguimiento', subtitle: '🏭 Generador de Residuos',
        description: 'Consulta ubicación del transporte en tiempo real. Timeline de eventos.',
        icon: <Eye />, features: ['GPS', 'Timeline', 'Alertas'],
        color: '#f59e0b', animationType: 'map'
    },

    // TRANSPORTISTA
    {
        id: 'trans-dashboard', role: 'TRANSPORTISTA',
        title: 'Mis Viajes', subtitle: '🚛 Transportista',
        description: 'Lista de manifiestos asignados. Ordenados por urgencia y fecha.',
        icon: <Truck />, features: ['Pendientes', 'Urgentes', 'Rutas'],
        color: '#f59e0b', animationType: 'list'
    },
    {
        id: 'trans-offline', role: 'TRANSPORTISTA',
        title: 'Modo Offline', subtitle: '🚛 Transportista',
        description: 'Funciona 100% sin conexión. Datos cifrados. Sincroniza al reconectar.',
        icon: <WifiOff />, features: ['Sin red', 'Cifrado', 'Auto-sync'],
        color: '#64748b', animationType: 'sync'
    },
    {
        id: 'trans-pickup', role: 'TRANSPORTISTA',
        title: 'Confirmar Retiro', subtitle: '🚛 Transportista',
        description: 'Verifica bultos, captura GPS, obtiene firma del generador en pantalla.',
        icon: <ClipboardCheck />, features: ['GPS', 'Firma', 'Foto'],
        color: '#10b981', animationType: 'form'
    },
    {
        id: 'trans-gps', role: 'TRANSPORTISTA',
        title: 'Tracking GPS Activo', subtitle: '🚛 Transportista',
        description: 'Tracking automático durante el viaje. Registra ruta completa.',
        icon: <Navigation />, features: ['Auto-track', 'Ruta', 'ETA'],
        color: '#ef4444', animationType: 'map'
    },
    {
        id: 'trans-incident', role: 'TRANSPORTISTA',
        title: 'Registrar Incidentes', subtitle: '🚛 Transportista',
        description: 'Documenta accidentes o desvíos con fotos y GPS. Alerta inmediata a DGFA.',
        icon: <AlertTriangle />, features: ['Fotos', 'GPS', 'Alerta'],
        color: '#dc2626', animationType: 'alert'
    },
    {
        id: 'trans-delivery', role: 'TRANSPORTISTA',
        title: 'Confirmar Entrega', subtitle: '🚛 Transportista',
        description: 'Registra llegada, verifica GPS, escanea QR del operador.',
        icon: <CheckCircle2 />, features: ['GPS', 'QR', 'Firma'],
        color: '#10b981', animationType: 'qr'
    },

    // OPERADOR
    {
        id: 'op-dashboard', role: 'OPERADOR',
        title: 'Cargas Entrantes', subtitle: '🏢 Operador de Tratamiento',
        description: 'Lista de transportes en camino. ETA y preparación anticipada.',
        icon: <Building2 />, features: ['Esperados', 'ETA', 'Alerta'],
        color: '#8b5cf6', animationType: 'list'
    },
    {
        id: 'op-qr', role: 'OPERADOR',
        title: 'Recepción QR', subtitle: '🏢 Operador de Tratamiento',
        description: 'Escanea QR en garita. Valida offline contra lista de esperados.',
        icon: <QrCode />, features: ['Scan', 'Offline', 'Valida'],
        color: '#10b981', animationType: 'qr'
    },
    {
        id: 'op-weight', role: 'OPERADOR',
        title: 'Registro de Pesaje', subtitle: '🏢 Operador de Tratamiento',
        description: 'Ingresa peso real de báscula. Compara con declarado automáticamente.',
        icon: <Scale />, features: ['Peso', 'Compara', 'Alerta'],
        color: '#f59e0b', animationType: 'form'
    },
    {
        id: 'op-treatment', role: 'OPERADOR',
        title: 'Registrar Tratamiento', subtitle: '🏢 Operador de Tratamiento',
        description: 'Selecciona método de tratamiento autorizado. Valida compatibilidad.',
        icon: <Settings />, features: ['Método', 'Validación', 'Fecha'],
        color: '#6366f1', animationType: 'form'
    },
    {
        id: 'op-close', role: 'OPERADOR',
        title: 'Cerrar y Certificar', subtitle: '🏢 Operador de Tratamiento',
        description: 'Firma de cierre final. Genera certificado de disposición automáticamente.',
        icon: <Download />, features: ['Firma', 'Certificado', 'PDF'],
        color: '#10b981', animationType: 'form'
    },

    // Final
    {
        id: 'complete', role: 'ALL',
        title: '¡Demo Completa!', subtitle: 'Sistema Listo',
        description: 'Has visto todas las funcionalidades móviles. La app funciona offline y sincroniza automáticamente.',
        icon: <Zap />, features: ['4 Roles', 'Offline', 'PWA'],
        color: '#10b981', animationType: 'dashboard'
    }
];

// Animación de preview según tipo
const AnimatedPreview: React.FC<{ type: string; color: string }> = ({ type, color }) => {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % 3);
        }, 1500);
        return () => clearInterval(timer);
    }, []);

    const style = { borderColor: color };

    switch (type) {
        case 'dashboard':
            return (
                <div className="demo-preview demo-preview-dashboard" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-stats">
                        <div className={`preview-stat ${frame === 0 ? 'active' : ''}`} style={{ background: `${color}20` }}></div>
                        <div className={`preview-stat ${frame === 1 ? 'active' : ''}`} style={{ background: `${color}20` }}></div>
                        <div className={`preview-stat ${frame === 2 ? 'active' : ''}`} style={{ background: `${color}20` }}></div>
                    </div>
                    <div className="preview-chart">
                        <div className="chart-bar" style={{ height: `${40 + frame * 15}%`, background: color }}></div>
                        <div className="chart-bar" style={{ height: `${60 - frame * 10}%`, background: `${color}80` }}></div>
                        <div className="chart-bar" style={{ height: `${50 + frame * 5}%`, background: `${color}60` }}></div>
                    </div>
                </div>
            );
        case 'form':
            return (
                <div className="demo-preview demo-preview-form" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-fields">
                        <div className={`preview-field ${frame >= 0 ? 'filled' : ''}`}></div>
                        <div className={`preview-field ${frame >= 1 ? 'filled' : ''}`}></div>
                        <div className={`preview-field ${frame >= 2 ? 'filled' : ''}`}></div>
                    </div>
                    <div className="preview-button" style={{ background: color }}>
                        <CheckCircle2 size={16} />
                    </div>
                </div>
            );
        case 'qr':
            return (
                <div className="demo-preview demo-preview-qr" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-scanner">
                        <div className="scanner-frame" style={{ borderColor: color }}>
                            <div className={`scanner-line ${frame > 0 ? 'scanning' : ''}`} style={{ background: color }}></div>
                            <QrCode size={40} style={{ color: `${color}40` }} />
                        </div>
                    </div>
                    <div className={`preview-result ${frame === 2 ? 'show' : ''}`} style={{ background: `${color}20` }}>
                        <CheckCircle2 size={16} style={{ color }} />
                    </div>
                </div>
            );
        case 'map':
            return (
                <div className="demo-preview demo-preview-map" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-map-container">
                        <div className="map-grid">
                            {[...Array(9)].map((_, i) => (
                                <div key={i} className="map-cell"></div>
                            ))}
                        </div>
                        <div className={`map-marker`} style={{
                            background: color,
                            transform: `translate(${frame * 20}px, ${frame * -10}px)`
                        }}>
                            <MapPin size={12} />
                        </div>
                        <div className="map-route" style={{
                            background: `linear-gradient(90deg, ${color}, transparent)`,
                            width: `${30 + frame * 20}%`
                        }}></div>
                    </div>
                </div>
            );
        case 'list':
            return (
                <div className="demo-preview demo-preview-list" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-list-items">
                        <div className={`list-item ${frame === 0 ? 'highlight' : ''}`}>
                            <div className="item-icon" style={{ background: `${color}30` }}></div>
                            <div className="item-lines">
                                <div className="item-line"></div>
                                <div className="item-line short"></div>
                            </div>
                        </div>
                        <div className={`list-item ${frame === 1 ? 'highlight' : ''}`}>
                            <div className="item-icon" style={{ background: `${color}30` }}></div>
                            <div className="item-lines">
                                <div className="item-line"></div>
                                <div className="item-line short"></div>
                            </div>
                        </div>
                        <div className={`list-item ${frame === 2 ? 'highlight' : ''}`}>
                            <div className="item-icon" style={{ background: `${color}30` }}></div>
                            <div className="item-lines">
                                <div className="item-line"></div>
                                <div className="item-line short"></div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 'alert':
            return (
                <div className="demo-preview demo-preview-alert" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className={`preview-alert-box ${frame > 0 ? 'pulse' : ''}`} style={{ borderColor: color }}>
                        <AlertTriangle size={24} style={{ color }} className={frame === 1 ? 'shake' : ''} />
                        <div className="alert-text"></div>
                    </div>
                    <div className="preview-alert-actions">
                        <div className="alert-btn" style={{ background: `${color}30` }}></div>
                        <div className="alert-btn" style={{ background: color }}></div>
                    </div>
                </div>
            );
        case 'sync':
            return (
                <div className="demo-preview demo-preview-sync" style={style}>
                    <div className="preview-header" style={{ background: color }}>
                        <div className="preview-title-bar"></div>
                    </div>
                    <div className="preview-sync-container">
                        <div className={`sync-icon ${frame === 0 ? 'offline' : 'online'}`}>
                            {frame === 0 ? <WifiOff size={32} /> : <Wifi size={32} style={{ color }} />}
                        </div>
                        <div className="sync-status" style={{ color: frame === 0 ? '#64748b' : color }}>
                            {frame === 0 ? 'Offline' : frame === 1 ? 'Conectando...' : 'Sincronizado'}
                        </div>
                        <div className={`sync-progress ${frame >= 1 ? 'active' : ''}`}>
                            <div className="sync-bar" style={{
                                width: frame === 0 ? '0%' : frame === 1 ? '50%' : '100%',
                                background: color
                            }}></div>
                        </div>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

interface DemoAppOnboardingProps {
    isOpen: boolean;
    onComplete: () => void;
}

const DemoAppOnboarding: React.FC<DemoAppOnboardingProps> = ({ isOpen, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const currentSlide = demoSlides[currentIndex];
    const progress = ((currentIndex + 1) / demoSlides.length) * 100;

    const handleNext = () => {
        if (currentIndex < demoSlides.length - 1) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex(currentIndex + 1);
                setIsAnimating(false);
            }, 300);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex(currentIndex - 1);
                setIsAnimating(false);
            }, 300);
        }
    };

    const handleComplete = () => {
        localStorage.setItem('demoAppOnboardingCompleted', 'true');
        onComplete();
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return '#10b981';
            case 'GENERADOR': return '#3b82f6';
            case 'TRANSPORTISTA': return '#f59e0b';
            case 'OPERADOR': return '#8b5cf6';
            default: return '#10b981';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="demo-onboarding-overlay">
            <div className="demo-onboarding-container">
                {/* Close button */}
                <button className="demo-onboarding-close" onClick={handleComplete}>
                    <X size={20} />
                </button>

                {/* Progress bar */}
                <div className="demo-onboarding-progress">
                    <div
                        className="demo-onboarding-progress-bar"
                        style={{ width: `${progress}%`, background: currentSlide.color }}
                    />
                </div>

                {/* Role indicator */}
                {currentSlide.role !== 'ALL' && (
                    <div
                        className="demo-onboarding-role"
                        style={{ background: `${getRoleColor(currentSlide.role)}20`, color: getRoleColor(currentSlide.role) }}
                    >
                        {currentSlide.role === 'ADMIN' && '🛡️ ADMIN'}
                        {currentSlide.role === 'GENERADOR' && '🏭 GENERADOR'}
                        {currentSlide.role === 'TRANSPORTISTA' && '🚛 TRANSPORTISTA'}
                        {currentSlide.role === 'OPERADOR' && '🏢 OPERADOR'}
                    </div>
                )}

                {/* Content */}
                <div className={`demo-onboarding-content ${isAnimating ? 'animating' : ''}`}>
                    {/* Animated Preview */}
                    <div className="demo-onboarding-preview">
                        <AnimatedPreview type={currentSlide.animationType} color={currentSlide.color} />
                    </div>

                    {/* Icon */}
                    <div className="demo-onboarding-icon" style={{ background: `${currentSlide.color}20`, color: currentSlide.color }}>
                        {currentSlide.icon}
                    </div>

                    {/* Text */}
                    <h2 className="demo-onboarding-title">{currentSlide.title}</h2>
                    <p className="demo-onboarding-subtitle" style={{ color: currentSlide.color }}>
                        {currentSlide.subtitle}
                    </p>
                    <p className="demo-onboarding-description">{currentSlide.description}</p>

                    {/* Features */}
                    <div className="demo-onboarding-features">
                        {currentSlide.features.map((feature, i) => (
                            <span key={i} className="demo-feature-tag" style={{ background: `${currentSlide.color}15`, color: currentSlide.color }}>
                                {feature}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Navigation */}
                <div className="demo-onboarding-nav">
                    <button
                        className="demo-nav-btn demo-nav-prev"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                    >
                        <ChevronLeft size={20} />
                        Anterior
                    </button>

                    <span className="demo-nav-counter">
                        {currentIndex + 1} / {demoSlides.length}
                    </span>

                    <button
                        className="demo-nav-btn demo-nav-next"
                        onClick={handleNext}
                        style={{ background: currentSlide.color }}
                    >
                        {currentIndex === demoSlides.length - 1 ? 'Finalizar' : 'Siguiente'}
                        {currentIndex === demoSlides.length - 1 ? <Sparkles size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DemoAppOnboarding;

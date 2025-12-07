import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
    FileText, Truck, MapPin, Users, BarChart3, Scale,
    Bell, QrCode, Shield, Factory, Building2,
    ClipboardCheck, Zap, MousePointer2
} from 'lucide-react';
import './OnboardingTour.css';

// Mini UI Animation Component
const MiniAnimation: React.FC<{ type: string; color: string }> = ({ type, color }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStep(s => (s + 1) % 4);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // Diferentes animaciones según el tipo
    const renderAnimation = () => {
        switch (type) {
            case 'dashboard':
                return (
                    <div className="mini-ui">
                        <div className="mini-sidebar">
                            <div className="mini-menu-item active" />
                            <div className="mini-menu-item" />
                            <div className="mini-menu-item" />
                        </div>
                        <div className="mini-content">
                            <div className="mini-stats">
                                <div className={`mini-stat ${step === 0 ? 'highlight' : ''}`} style={{ background: `${color}33` }} />
                                <div className={`mini-stat ${step === 1 ? 'highlight' : ''}`} style={{ background: `${color}33` }} />
                                <div className={`mini-stat ${step === 2 ? 'highlight' : ''}`} style={{ background: `${color}33` }} />
                                <div className={`mini-stat ${step === 3 ? 'highlight' : ''}`} style={{ background: `${color}33` }} />
                            </div>
                            <div className="mini-chart" style={{ borderColor: color }} />
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'manifiestos':
                return (
                    <div className="mini-ui">
                        <div className="mini-header">
                            <div className="mini-title" />
                            <div className={`mini-btn ${step === 0 ? 'clicked' : ''}`} style={{ background: color }}>+</div>
                        </div>
                        <div className="mini-table">
                            <div className={`mini-row ${step === 1 ? 'highlight' : ''}`}>
                                <div className="mini-cell" /><div className="mini-cell" /><div className="mini-cell status" style={{ background: `${color}44` }} />
                            </div>
                            <div className={`mini-row ${step === 2 ? 'highlight' : ''}`}>
                                <div className="mini-cell" /><div className="mini-cell" /><div className="mini-cell status" />
                            </div>
                            <div className={`mini-row ${step === 3 ? 'highlight' : ''}`}>
                                <div className="mini-cell" /><div className="mini-cell" /><div className="mini-cell status" />
                            </div>
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'tracking':
                return (
                    <div className="mini-ui mini-map">
                        <div className="mini-map-bg">
                            <div className="mini-road h" />
                            <div className="mini-road v" />
                            <div className={`mini-truck ${step}`} style={{ background: color }}>
                                <Truck size={12} />
                            </div>
                            <div className="mini-pin origin" />
                            <div className="mini-pin dest" style={{ background: color }} />
                        </div>
                        <div className="mini-map-panel">
                            <div className={`mini-transport ${step === 0 ? 'active' : ''}`} style={{ borderColor: step === 0 ? color : 'transparent' }} />
                            <div className={`mini-transport ${step === 2 ? 'active' : ''}`} style={{ borderColor: step === 2 ? color : 'transparent' }} />
                        </div>
                        <MousePointer2 className={`mini-cursor map-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'actores':
                return (
                    <div className="mini-ui">
                        <div className="mini-tabs">
                            <div className={`mini-tab ${step === 0 ? 'active' : ''}`} style={step === 0 ? { borderColor: color } : {}}>Gen</div>
                            <div className={`mini-tab ${step === 1 ? 'active' : ''}`} style={step === 1 ? { borderColor: color } : {}}>Trans</div>
                            <div className={`mini-tab ${step === 2 ? 'active' : ''}`} style={step === 2 ? { borderColor: color } : {}}>Op</div>
                        </div>
                        <div className="mini-cards">
                            <div className={`mini-card ${step === 3 ? 'highlight' : ''}`}>
                                <div className="mini-avatar" style={{ background: `${color}44` }} />
                                <div className="mini-card-text" />
                            </div>
                            <div className="mini-card">
                                <div className="mini-avatar" style={{ background: `${color}44` }} />
                                <div className="mini-card-text" />
                            </div>
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'alertas':
                return (
                    <div className="mini-ui">
                        <div className="mini-alert-config">
                            <div className={`mini-toggle ${step === 0 ? 'on' : ''}`} style={{ background: step === 0 ? color : '#444' }}>
                                <div className="mini-toggle-dot" />
                            </div>
                            <div className="mini-alert-text" />
                        </div>
                        <div className="mini-alert-config">
                            <div className={`mini-toggle ${step === 1 ? 'on' : ''}`} style={{ background: step === 1 ? color : '#444' }}>
                                <div className="mini-toggle-dot" />
                            </div>
                            <div className="mini-alert-text" />
                        </div>
                        <div className={`mini-notification ${step === 2 || step === 3 ? 'show' : ''}`} style={{ background: `${color}22`, borderColor: color }}>
                            <Bell size={14} style={{ color }} />
                            <div className="mini-notif-text" />
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'reportes':
                return (
                    <div className="mini-ui">
                        <div className="mini-filters">
                            <div className={`mini-select ${step === 0 ? 'open' : ''}`} style={{ borderColor: step === 0 ? color : '#444' }} />
                            <div className={`mini-select ${step === 1 ? 'open' : ''}`} style={{ borderColor: step === 1 ? color : '#444' }} />
                            <div className={`mini-btn-sm ${step === 2 ? 'clicked' : ''}`} style={{ background: color }}>Gen</div>
                        </div>
                        <div className={`mini-chart-bar ${step === 3 ? 'animate' : ''}`}>
                            <div className="bar" style={{ background: color, height: '60%' }} />
                            <div className="bar" style={{ background: color, height: '80%' }} />
                            <div className="bar" style={{ background: color, height: '40%' }} />
                            <div className="bar" style={{ background: color, height: '90%' }} />
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'crear':
            case 'firmar':
                return (
                    <div className="mini-ui mini-form">
                        <div className={`mini-input ${step === 0 ? 'focus' : ''}`} style={{ borderColor: step === 0 ? color : '#444' }}>
                            <div className="mini-input-text typing" />
                        </div>
                        <div className={`mini-input ${step === 1 ? 'focus' : ''}`} style={{ borderColor: step === 1 ? color : '#444' }}>
                            <div className="mini-dropdown" style={{ background: `${color}22` }} />
                        </div>
                        <div className={`mini-input ${step === 2 ? 'focus' : ''}`} style={{ borderColor: step === 2 ? color : '#444' }} />
                        <div className={`mini-submit ${step === 3 ? 'clicked' : ''}`} style={{ background: color }}>
                            {type === 'firmar' ? <ClipboardCheck size={14} /> : <FileText size={14} />}
                        </div>
                        <MousePointer2 className={`mini-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            case 'qr':
                return (
                    <div className="mini-ui mini-qr">
                        <div className={`mini-qr-frame ${step === 1 || step === 2 ? 'scanning' : ''}`} style={{ borderColor: color }}>
                            <div className="mini-qr-code">
                                <QrCode size={40} style={{ color: step >= 2 ? color : '#666' }} />
                            </div>
                            <div className={`mini-scan-line ${step === 1 ? 'active' : ''}`} style={{ background: color }} />
                        </div>
                        <div className={`mini-qr-result ${step === 3 ? 'show' : ''}`} style={{ background: `${color}22`, borderColor: color }}>
                            <CheckCircle2 size={16} style={{ color }} />
                        </div>
                        <MousePointer2 className={`mini-cursor qr-cursor step-${step}`} style={{ color }} />
                    </div>
                );

            default:
                return (
                    <div className="mini-ui mini-welcome">
                        <div className="mini-logo" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
                            <Shield size={24} />
                        </div>
                        <div className="mini-welcome-lines">
                            <div className="mini-line" style={{ width: '80%' }} />
                            <div className="mini-line" style={{ width: '60%' }} />
                            <div className="mini-line" style={{ width: '40%' }} />
                        </div>
                        <div className={`mini-start-btn ${step === 2 || step === 3 ? 'pulse' : ''}`} style={{ background: color }}>
                            →
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="mini-animation-container">
            {renderAnimation()}
        </div>
    );
};

interface TourSlide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    color: string;
    animationType: string;
}

// Slides para cada rol
const slidesAdmin: TourSlide[] = [
    {
        id: 'welcome',
        title: '¡Bienvenido al Sistema DGFA!',
        subtitle: 'Trazabilidad de Residuos Peligrosos',
        description: 'Sistema integral para gestionar el ciclo completo de residuos peligrosos según Ley 24.051.',
        icon: <Shield />,
        features: ['Gestión digital completa', 'Trazabilidad en tiempo real', 'Cumplimiento normativo'],
        color: '#10b981',
        animationType: 'welcome',
    },
    {
        id: 'dashboard',
        title: 'Dashboard Ejecutivo',
        subtitle: 'Vista general del sistema',
        description: 'Panel de control con métricas actualizadas automáticamente cada 5 minutos.',
        icon: <BarChart3 />,
        features: ['KPIs en tiempo real', 'Manifiestos por estado', 'Actividad reciente'],
        color: '#3b82f6',
        animationType: 'dashboard',
    },
    {
        id: 'manifiestos',
        title: 'Gestión de Manifiestos',
        subtitle: 'Documentos de trazabilidad',
        description: 'Consulta, filtra y supervisa todos los manifiestos. Timeline completo de cada documento.',
        icon: <FileText />,
        features: ['Listado filtrable', 'Estados en tiempo real', 'Descarga PDF con QR'],
        color: '#8b5cf6',
        animationType: 'manifiestos',
    },
    {
        id: 'tracking',
        title: 'Tracking GPS',
        subtitle: 'Monitoreo en tiempo real',
        description: 'Mapa interactivo con ubicación de transportes activos. Actualización cada 30 segundos.',
        icon: <MapPin />,
        features: ['Mapa en vivo', 'ETA automático', 'Detección de desvíos'],
        color: '#f59e0b',
        animationType: 'tracking',
    },
    {
        id: 'actores',
        title: 'Gestión de Actores',
        subtitle: 'Usuarios del sistema',
        description: 'Administra Generadores, Transportistas y Operadores habilitados.',
        icon: <Users />,
        features: ['CRUD completo', 'Roles y permisos', 'Estado de habilitación'],
        color: '#ec4899',
        animationType: 'actores',
    },
    {
        id: 'alertas',
        title: 'Sistema de Alertas',
        subtitle: 'Notificaciones automáticas',
        description: 'Configura reglas para alertas: vencimientos, desvíos, tiempos excesivos.',
        icon: <Bell />,
        features: ['Reglas personalizables', 'Email y push', 'Historial de alertas'],
        color: '#ef4444',
        animationType: 'alertas',
    },
    {
        id: 'reportes',
        title: 'Reportes Estadísticos',
        subtitle: 'Análisis y exportación',
        description: 'Genera informes por período, tipo de residuo, actor o zona geográfica.',
        icon: <BarChart3 />,
        features: ['Reportes personalizados', 'Exportación PDF/CSV', 'Gráficos interactivos'],
        color: '#14b8a6',
        animationType: 'reportes',
    },
    {
        id: 'complete',
        title: '¡Tour Completado!',
        subtitle: 'Listo para comenzar',
        description: 'Ya conoces todas las funciones. Botón "?" disponible para repetir el tour.',
        icon: <CheckCircle2 />,
        features: ['Soporte disponible', 'Documentación completa', 'Actualizaciones continuas'],
        color: '#10b981',
        animationType: 'welcome',
    },
];

const slidesGenerador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Generador!', subtitle: 'Gestiona tus residuos peligrosos',
        description: 'Declara y gestiona tus residuos mediante manifiestos electrónicos con firma digital.',
        icon: <Factory />, features: ['Manifiestos digitales', 'Firma electrónica', 'Seguimiento en tiempo real'],
        color: '#10b981', animationType: 'welcome',
    },
    {
        id: 'crear', title: 'Crear Manifiesto', subtitle: 'Declaración de residuos',
        description: 'Selecciona tipo de residuo, cantidad, transportista y operador destino.',
        icon: <FileText />, features: ['Catálogo Ley 24.051', 'Datos precargados', 'QR automático'],
        color: '#3b82f6', animationType: 'crear',
    },
    {
        id: 'firmar', title: 'Firma Digital', subtitle: 'Validez legal',
        description: 'Al firmar, se genera código QR único y el transportista es notificado al instante.',
        icon: <ClipboardCheck />, features: ['Firma electrónica', 'Código QR único', 'Notificación push'],
        color: '#8b5cf6', animationType: 'firmar',
    },
    {
        id: 'seguimiento', title: 'Seguimiento GPS', subtitle: 'Ubicación en tiempo real',
        description: 'Visualiza en mapa la ubicación del transporte durante todo el viaje.',
        icon: <MapPin />, features: ['Mapa interactivo', 'ETA estimado', 'Historial de ruta'],
        color: '#f59e0b', animationType: 'tracking',
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Tu primer manifiesto',
        description: 'Al firmar un manifiesto, el transportista será notificado automáticamente.',
        icon: <CheckCircle2 />, features: ['Soporte disponible', 'Notificaciones activas', 'Certificados automáticos'],
        color: '#10b981', animationType: 'welcome',
    },
];

const slidesTransportista: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Transportista!', subtitle: 'Gestiona retiros y entregas',
        description: 'La app funciona OFFLINE y sincroniza automáticamente al recuperar conexión.',
        icon: <Truck />, features: ['Modo offline', 'GPS automático', 'Sincronización'],
        color: '#10b981', animationType: 'welcome',
    },
    {
        id: 'asignados', title: 'Manifiestos Asignados', subtitle: 'Pendientes de retiro',
        description: 'Lista de manifiestos asignados con dirección, tipo de residuo y fecha límite.',
        icon: <FileText />, features: ['Lista ordenada', 'Direcciones claras', 'Fechas límite'],
        color: '#3b82f6', animationType: 'manifiestos',
    },
    {
        id: 'qr', title: 'Escaneo QR', subtitle: 'Verificación rápida',
        description: 'Escanea el código QR del manifiesto para carga rápida y verificación.',
        icon: <QrCode />, features: ['Lectura instantánea', 'Verificación', 'Modo manual'],
        color: '#8b5cf6', animationType: 'qr',
    },
    {
        id: 'tracking', title: 'Durante el Transporte', subtitle: 'Tracking automático',
        description: 'Tu ubicación se registra automáticamente. Puedes registrar paradas o incidentes.',
        icon: <MapPin />, features: ['GPS continuo', 'Registro de paradas', 'Alertas de desvío'],
        color: '#f59e0b', animationType: 'tracking',
    },
    {
        id: 'complete', title: '¡Listo para la Ruta!', subtitle: 'Modo offline disponible',
        description: 'La app funciona sin conexión. Los datos se sincronizan al recuperar señal.',
        icon: <Zap />, features: ['Sin internet', 'Sincronización', 'Datos seguros'],
        color: '#10b981', animationType: 'welcome',
    },
];

const slidesOperador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Operador!', subtitle: 'Recepción y tratamiento',
        description: 'Gestiona la recepción, pesaje y tratamiento de residuos en tu planta.',
        icon: <Building2 />, features: ['Recepción digital', 'Pesaje registrado', 'Certificados'],
        color: '#10b981', animationType: 'welcome',
    },
    {
        id: 'entrantes', title: 'Manifiestos Entrantes', subtitle: 'En camino a tu planta',
        description: 'Visualiza transportes en camino con generador, tipo de residuo y ETA.',
        icon: <Truck />, features: ['ETA estimado', 'Datos completos', 'Preparación anticipada'],
        color: '#3b82f6', animationType: 'manifiestos',
    },
    {
        id: 'qr', title: 'Recepción con QR', subtitle: 'Escaneo al llegar',
        description: 'Escanea el QR del manifiesto. Funciona OFFLINE contra lista de "Esperados".',
        icon: <QrCode />, features: ['Escaneo rápido', 'Validación offline', 'Lista esperados'],
        color: '#8b5cf6', animationType: 'qr',
    },
    {
        id: 'pesaje', title: 'Registro de Pesaje', subtitle: 'Peso en báscula',
        description: 'Ingresa el peso real. El sistema compara con lo declarado automáticamente.',
        icon: <Scale />, features: ['Comparación automática', 'Diferencia %', 'Justificación'],
        color: '#f59e0b', animationType: 'crear',
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Certificados automáticos',
        description: 'Cada cierre genera certificado para el generador. Trazabilidad completa.',
        icon: <CheckCircle2 />, features: ['Certificados', 'Historial', 'Reportes'],
        color: '#10b981', animationType: 'welcome',
    },
];

interface OnboardingTourProps {
    userRole: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    onComplete: () => void;
    isOpen: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ userRole, onComplete, isOpen }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [direction, setDirection] = useState<'next' | 'prev'>('next');

    const getSlides = () => {
        switch (userRole) {
            case 'ADMIN': return slidesAdmin;
            case 'GENERADOR': return slidesGenerador;
            case 'TRANSPORTISTA': return slidesTransportista;
            case 'OPERADOR': return slidesOperador;
            default: return slidesAdmin;
        }
    };

    const slides = getSlides();
    const slide = slides[currentSlide];
    const progress = ((currentSlide + 1) / slides.length) * 100;

    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            setIsVisible(false);
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setDirection('next');
            setCurrentSlide(currentSlide + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setDirection('prev');
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('tourCompleted', 'true');
        setTimeout(onComplete, 300);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isVisible) return;
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') handleComplete();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, currentSlide]);

    if (!isOpen) return null;

    return (
        <div className={`tour-modal ${isVisible ? 'visible' : ''}`}>
            <div className="tour-progress">
                <div className="tour-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <button className="tour-close" onClick={handleComplete}><X size={24} /></button>
            <div className="tour-step-indicator">{currentSlide + 1} / {slides.length}</div>

            <div className={`tour-content ${direction}`} key={currentSlide}>
                {/* Animation Preview */}
                <MiniAnimation type={slide.animationType} color={slide.color} />

                {/* Icon */}
                <div className="tour-icon" style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}88)` }}>
                    {slide.icon}
                </div>

                <h1 className="tour-title">{slide.title}</h1>
                <h2 className="tour-subtitle" style={{ color: slide.color }}>{slide.subtitle}</h2>
                <p className="tour-description">{slide.description}</p>

                <div className="tour-features">
                    {slide.features.map((feature, idx) => (
                        <div key={idx} className="tour-feature" style={{ borderColor: `${slide.color}66` }}>
                            <CheckCircle2 size={16} style={{ color: slide.color }} />
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="tour-dots">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        className={`tour-dot ${idx === currentSlide ? 'active' : ''} ${idx < currentSlide ? 'completed' : ''}`}
                        onClick={() => { setDirection(idx > currentSlide ? 'next' : 'prev'); setCurrentSlide(idx); }}
                        style={idx === currentSlide ? { background: slide.color } : {}}
                    />
                ))}
            </div>

            <div className="tour-nav">
                <button className="tour-btn tour-btn-secondary" onClick={handlePrev} disabled={currentSlide === 0}>
                    <ChevronLeft size={20} /> Anterior
                </button>
                <button className="tour-btn tour-btn-skip" onClick={handleComplete}>Saltar</button>
                <button
                    className="tour-btn tour-btn-primary"
                    onClick={handleNext}
                    style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)` }}
                >
                    {currentSlide === slides.length - 1 ? (<>¡Comenzar! <Sparkles size={20} /></>) : (<>Siguiente <ChevronRight size={20} /></>)}
                </button>
            </div>
        </div>
    );
};

export default OnboardingTour;

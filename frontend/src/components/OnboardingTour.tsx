import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
    FileText, Truck, MapPin, Users, BarChart3, Scale,
    Bell, QrCode, Shield, Factory, Building2,
    ClipboardCheck, Zap, MousePointer2, AlertTriangle
} from 'lucide-react';
import './OnboardingTour.css';

// Realistic UI Preview Component - Faithful to actual system
const SystemPreview: React.FC<{ type: string }> = ({ type }) => {
    const [animStep, setAnimStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setAnimStep(s => (s + 1) % 4);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const renderPreview = () => {
        switch (type) {
            case 'dashboard':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Dashboard</span>
                            <div className="preview-user">Admin</div>
                        </div>
                        <div className="preview-content">
                            <div className="preview-welcome">Bienvenido, Administrador!</div>
                            <div className="preview-stats">
                                <div className={`preview-stat ${animStep === 0 ? 'active' : ''}`}>
                                    <div className="stat-icon" style={{ background: '#3b82f6' }}>📄</div>
                                    <div className="stat-value">70</div>
                                    <div className="stat-label">TOTAL MANIFIESTOS</div>
                                </div>
                                <div className={`preview-stat ${animStep === 1 ? 'active' : ''}`}>
                                    <div className="stat-icon" style={{ background: '#f59e0b' }}>📝</div>
                                    <div className="stat-value">4</div>
                                    <div className="stat-label">EN BORRADOR</div>
                                </div>
                                <div className={`preview-stat ${animStep === 2 ? 'active' : ''}`}>
                                    <div className="stat-icon" style={{ background: '#8b5cf6' }}>🚛</div>
                                    <div className="stat-value">4</div>
                                    <div className="stat-label">EN TRÁNSITO</div>
                                </div>
                                <div className={`preview-stat ${animStep === 3 ? 'active' : ''}`}>
                                    <div className="stat-icon" style={{ background: '#10b981' }}>✅</div>
                                    <div className="stat-value">40</div>
                                    <div className="stat-label">COMPLETADOS</div>
                                </div>
                            </div>
                            <div className="preview-pointer" style={{
                                top: `${65 + animStep * 0}px`,
                                left: `${30 + animStep * 75}px`
                            }}>
                                <MousePointer2 size={20} />
                            </div>
                        </div>
                    </div>
                );

            case 'manifiestos':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Manifiestos</span>
                            <button className="preview-btn-new">+ Nuevo</button>
                        </div>
                        <div className="preview-content">
                            <div className="preview-filters">
                                <div className="preview-search">🔍 Buscar...</div>
                                <div className="preview-filter">Estado ▼</div>
                            </div>
                            <div className="preview-table">
                                <div className="preview-table-header">
                                    <span>NÚMERO</span><span>GENERADOR</span><span>ESTADO</span><span>FECHA</span>
                                </div>
                                <div className={`preview-table-row ${animStep === 0 ? 'highlight' : ''}`}>
                                    <span>M-2024-001002</span>
                                    <span>Industrias...</span>
                                    <span className="status-badge transit">En Tránsito</span>
                                    <span>07/12/24</span>
                                </div>
                                <div className={`preview-table-row ${animStep === 1 ? 'highlight' : ''}`}>
                                    <span>M-2024-001012</span>
                                    <span>Química SA</span>
                                    <span className="status-badge pending">Pendiente</span>
                                    <span>06/12/24</span>
                                </div>
                                <div className={`preview-table-row ${animStep === 2 ? 'highlight' : ''}`}>
                                    <span>M-2024-001007</span>
                                    <span>Petroquím...</span>
                                    <span className="status-badge complete">Tratado</span>
                                    <span>05/12/24</span>
                                </div>
                            </div>
                            <div className="preview-pointer" style={{
                                top: `${95 + animStep * 28}px`,
                                left: '45px'
                            }}>
                                <MousePointer2 size={20} />
                            </div>
                        </div>
                    </div>
                );

            case 'tracking':
                return (
                    <div className="preview-screen preview-map">
                        <div className="preview-header">
                            <span className="preview-title">Tracking GPS</span>
                            <span className="preview-live">● EN VIVO</span>
                        </div>
                        <div className="preview-content map-content">
                            <div className="map-area">
                                <div className="map-grid" />
                                <div className={`truck-marker ${animStep}`}>
                                    <Truck size={16} />
                                </div>
                                <div className="location-pin origin">A</div>
                                <div className="location-pin dest">B</div>
                                <div className="route-line" />
                            </div>
                            <div className="map-sidebar">
                                <div className="sidebar-title">Transportes Activos (4)</div>
                                <div className={`transport-item ${animStep === 0 ? 'active' : ''}`}>
                                    <span className="transport-dot" />
                                    <span>M-2024-001002</span>
                                </div>
                                <div className={`transport-item ${animStep === 1 ? 'active' : ''}`}>
                                    <span className="transport-dot" />
                                    <span>M-2024-001012</span>
                                </div>
                                <div className={`transport-item ${animStep === 2 ? 'active' : ''}`}>
                                    <span className="transport-dot" />
                                    <span>M-2024-001007</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'actores':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Gestión de Actores</span>
                        </div>
                        <div className="preview-content">
                            <div className="preview-tabs">
                                <div className={`preview-tab ${animStep === 0 ? 'active' : ''}`}>Generadores</div>
                                <div className={`preview-tab ${animStep === 1 ? 'active' : ''}`}>Transportistas</div>
                                <div className={`preview-tab ${animStep === 2 ? 'active' : ''}`}>Operadores</div>
                            </div>
                            <div className="preview-cards">
                                <div className={`preview-card ${animStep === 3 ? 'highlight' : ''}`}>
                                    <div className="card-avatar">🏭</div>
                                    <div className="card-info">
                                        <div className="card-name">Industrias Mendoza SA</div>
                                        <div className="card-detail">CUIT: 30-70123456-7</div>
                                    </div>
                                    <div className="card-status active">Habilitado</div>
                                </div>
                                <div className="preview-card">
                                    <div className="card-avatar">🏭</div>
                                    <div className="card-info">
                                        <div className="card-name">Química del Sur SRL</div>
                                        <div className="card-detail">CUIT: 30-70234567-8</div>
                                    </div>
                                    <div className="card-status active">Habilitado</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'alertas':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Sistema de Alertas</span>
                        </div>
                        <div className="preview-content">
                            <div className="alert-rules">
                                <div className={`alert-rule ${animStep === 0 ? 'highlight' : ''}`}>
                                    <div className="rule-toggle on" />
                                    <div className="rule-info">
                                        <div className="rule-name">Tiempo de retiro excesivo</div>
                                        <div className="rule-desc">Más de 48 horas sin retirar</div>
                                    </div>
                                </div>
                                <div className={`alert-rule ${animStep === 1 ? 'highlight' : ''}`}>
                                    <div className="rule-toggle on" />
                                    <div className="rule-info">
                                        <div className="rule-name">Desvío de ruta</div>
                                        <div className="rule-desc">Más de 5km de desvío</div>
                                    </div>
                                </div>
                            </div>
                            <div className={`alert-notification ${animStep >= 2 ? 'show' : ''}`}>
                                <AlertTriangle size={16} className="alert-icon" />
                                <span>Nueva alerta: Desvío de 8.5km detectado</span>
                            </div>
                        </div>
                    </div>
                );

            case 'reportes':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Reportes Estadísticos</span>
                        </div>
                        <div className="preview-content">
                            <div className="report-filters">
                                <div className={`report-select ${animStep === 0 ? 'focus' : ''}`}>
                                    Período: Último mes ▼
                                </div>
                                <div className={`report-select ${animStep === 1 ? 'focus' : ''}`}>
                                    Tipo: Todos ▼
                                </div>
                                <button className={`report-btn ${animStep === 2 ? 'clicked' : ''}`}>
                                    Generar
                                </button>
                            </div>
                            <div className={`chart-container ${animStep === 3 ? 'animate' : ''}`}>
                                <div className="chart-bar" style={{ height: '60%', background: '#3b82f6' }} />
                                <div className="chart-bar" style={{ height: '80%', background: '#8b5cf6' }} />
                                <div className="chart-bar" style={{ height: '45%', background: '#10b981' }} />
                                <div className="chart-bar" style={{ height: '90%', background: '#f59e0b' }} />
                                <div className="chart-bar" style={{ height: '70%', background: '#ec4899' }} />
                            </div>
                        </div>
                    </div>
                );

            case 'qr':
                return (
                    <div className="preview-screen preview-qr">
                        <div className="preview-header">
                            <span className="preview-title">Escanear QR</span>
                        </div>
                        <div className="preview-content qr-content">
                            <div className={`qr-frame ${animStep === 1 ? 'scanning' : ''} ${animStep >= 2 ? 'success' : ''}`}>
                                <QrCode size={60} />
                                {animStep === 1 && <div className="scan-line" />}
                            </div>
                            {animStep >= 2 && (
                                <div className="qr-result">
                                    <CheckCircle2 size={20} className="success-icon" />
                                    <span>M-2024-001002 verificado</span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'form':
                return (
                    <div className="preview-screen">
                        <div className="preview-header">
                            <span className="preview-title">Nuevo Manifiesto</span>
                        </div>
                        <div className="preview-content form-content">
                            <div className={`form-field ${animStep === 0 ? 'focus' : ''}`}>
                                <label>Tipo de Residuo</label>
                                <div className="form-select">Y1 - Residuos clínicos ▼</div>
                            </div>
                            <div className={`form-field ${animStep === 1 ? 'focus' : ''}`}>
                                <label>Cantidad (kg)</label>
                                <div className="form-input typing">150</div>
                            </div>
                            <div className={`form-field ${animStep === 2 ? 'focus' : ''}`}>
                                <label>Transportista</label>
                                <div className="form-select">Transportes Andes SRL ▼</div>
                            </div>
                            <button className={`form-submit ${animStep === 3 ? 'clicked' : ''}`}>
                                <ClipboardCheck size={16} /> Firmar y Enviar
                            </button>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="preview-screen preview-welcome">
                        <div className="preview-logo">
                            <Shield size={40} />
                        </div>
                        <div className="preview-welcome-title">Sistema DGFA</div>
                        <div className="preview-welcome-sub">Trazabilidad de Residuos Peligrosos</div>
                        <div className="preview-welcome-features">
                            <span>✓ Manifiestos digitales</span>
                            <span>✓ Tracking GPS</span>
                            <span>✓ Firma electrónica</span>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="system-preview-container">
            <div className="preview-browser">
                <div className="browser-bar">
                    <div className="browser-dots">
                        <span className="dot red" />
                        <span className="dot yellow" />
                        <span className="dot green" />
                    </div>
                    <div className="browser-url">ultimamilla.com.ar/demoambiente</div>
                </div>
                {renderPreview()}
            </div>
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
    previewType: string;
}

const slidesAdmin: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido al Sistema DGFA!', subtitle: 'Trazabilidad de Residuos Peligrosos',
        description: 'Sistema integral para gestionar el ciclo completo de residuos peligrosos según Ley 24.051.',
        icon: <Shield />, features: ['Gestión digital completa', 'Trazabilidad en tiempo real', 'Cumplimiento normativo'],
        color: '#10b981', previewType: 'welcome',
    },
    {
        id: 'dashboard', title: 'Dashboard Ejecutivo', subtitle: 'Vista general del sistema',
        description: 'Panel de control con métricas actualizadas: manifiestos totales, estados y actividad reciente.',
        icon: <BarChart3 />, features: ['KPIs en tiempo real', 'Manifiestos por estado', 'Actividad reciente'],
        color: '#3b82f6', previewType: 'dashboard',
    },
    {
        id: 'manifiestos', title: 'Gestión de Manifiestos', subtitle: 'Documentos de trazabilidad',
        description: 'Consulta, filtra y supervisa todos los manifiestos. Click en cualquiera para ver el timeline.',
        icon: <FileText />, features: ['Listado con filtros', 'Estados en tiempo real', 'Descarga PDF con QR'],
        color: '#8b5cf6', previewType: 'manifiestos',
    },
    {
        id: 'tracking', title: 'Tracking GPS', subtitle: 'Monitoreo en tiempo real',
        description: 'Mapa interactivo con ubicación de transportes activos. Actualización cada 30 segundos.',
        icon: <MapPin />, features: ['Mapa en vivo', 'ETA automático', 'Detección de desvíos'],
        color: '#f59e0b', previewType: 'tracking',
    },
    {
        id: 'actores', title: 'Gestión de Actores', subtitle: 'Usuarios del sistema',
        description: 'Administra Generadores, Transportistas y Operadores habilitados por la DGFA.',
        icon: <Users />, features: ['CRUD completo', 'Roles y permisos', 'Estado de habilitación'],
        color: '#ec4899', previewType: 'actores',
    },
    {
        id: 'alertas', title: 'Sistema de Alertas', subtitle: 'Notificaciones automáticas',
        description: 'Configura reglas: vencimientos, desvíos de ruta, tiempos excesivos, diferencias de peso.',
        icon: <Bell />, features: ['Reglas personalizables', 'Email y push', 'Historial de alertas'],
        color: '#ef4444', previewType: 'alertas',
    },
    {
        id: 'reportes', title: 'Reportes Estadísticos', subtitle: 'Análisis y exportación',
        description: 'Genera informes por período, tipo de residuo, actor o zona geográfica. Exporta PDF/CSV.',
        icon: <BarChart3 />, features: ['Reportes personalizados', 'Gráficos interactivos', 'Exportación múltiple'],
        color: '#14b8a6', previewType: 'reportes',
    },
    {
        id: 'complete', title: '¡Tour Completado!', subtitle: 'Listo para comenzar',
        description: 'Ya conoces todas las funciones. El botón "?" está disponible para repetir el tour.',
        icon: <CheckCircle2 />, features: ['Soporte disponible', 'Documentación completa', 'Actualizaciones continuas'],
        color: '#10b981', previewType: 'welcome',
    },
];

const slidesGenerador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Generador!', subtitle: 'Gestiona tus residuos peligrosos',
        description: 'Declara y gestiona tus residuos mediante manifiestos electrónicos.',
        icon: <Factory />, features: ['Manifiestos digitales', 'Firma electrónica', 'Seguimiento GPS'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'form', title: 'Crear Manifiesto', subtitle: 'Declaración de residuos',
        description: 'Selecciona tipo de residuo, cantidad, transportista y operador destino.',
        icon: <FileText />, features: ['Catálogo Ley 24.051', 'Datos precargados', 'QR automático'],
        color: '#3b82f6', previewType: 'form'
    },
    {
        id: 'tracking', title: 'Seguimiento GPS', subtitle: 'Ubicación en tiempo real',
        description: 'Visualiza la ubicación del transporte durante todo el viaje.',
        icon: <MapPin />, features: ['Mapa interactivo', 'ETA estimado', 'Historial de ruta'],
        color: '#f59e0b', previewType: 'tracking'
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Tu primer manifiesto',
        description: 'Al firmar, el transportista será notificado automáticamente.',
        icon: <CheckCircle2 />, features: ['Notificaciones activas', 'Certificados automáticos', 'Soporte disponible'],
        color: '#10b981', previewType: 'welcome'
    },
];

const slidesTransportista: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Transportista!', subtitle: 'Gestiona retiros y entregas',
        description: 'La app funciona OFFLINE y sincroniza automáticamente.',
        icon: <Truck />, features: ['Modo offline', 'GPS automático', 'Sincronización'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'manifiestos', title: 'Manifiestos Asignados', subtitle: 'Pendientes de retiro',
        description: 'Lista con dirección, tipo de residuo y fecha límite.',
        icon: <FileText />, features: ['Lista ordenada', 'Direcciones claras', 'Fechas límite'],
        color: '#3b82f6', previewType: 'manifiestos'
    },
    {
        id: 'qr', title: 'Escaneo QR', subtitle: 'Verificación rápida',
        description: 'Escanea el código QR para carga rápida y verificación.',
        icon: <QrCode />, features: ['Lectura instantánea', 'Verificación', 'Modo manual'],
        color: '#8b5cf6', previewType: 'qr'
    },
    {
        id: 'tracking', title: 'Durante el Transporte', subtitle: 'Tracking automático',
        description: 'Tu ubicación se registra automáticamente durante el viaje.',
        icon: <MapPin />, features: ['GPS continuo', 'Registro de paradas', 'Alertas de desvío'],
        color: '#f59e0b', previewType: 'tracking'
    },
    {
        id: 'complete', title: '¡Listo para la Ruta!', subtitle: 'Modo offline disponible',
        description: 'La app funciona sin conexión. Sincroniza al recuperar señal.',
        icon: <Zap />, features: ['Sin internet', 'Sincronización', 'Datos seguros'],
        color: '#10b981', previewType: 'welcome'
    },
];

const slidesOperador: TourSlide[] = [
    {
        id: 'welcome', title: '¡Bienvenido, Operador!', subtitle: 'Recepción y tratamiento',
        description: 'Gestiona la recepción, pesaje y tratamiento en tu planta.',
        icon: <Building2 />, features: ['Recepción digital', 'Pesaje registrado', 'Certificados'],
        color: '#10b981', previewType: 'welcome'
    },
    {
        id: 'manifiestos', title: 'Manifiestos Entrantes', subtitle: 'En camino a tu planta',
        description: 'Visualiza transportes en camino con ETA estimado.',
        icon: <Truck />, features: ['ETA estimado', 'Datos completos', 'Preparación anticipada'],
        color: '#3b82f6', previewType: 'manifiestos'
    },
    {
        id: 'qr', title: 'Recepción con QR', subtitle: 'Escaneo al llegar',
        description: 'Escanea el QR del manifiesto. Funciona OFFLINE.',
        icon: <QrCode />, features: ['Escaneo rápido', 'Validación offline', 'Lista esperados'],
        color: '#8b5cf6', previewType: 'qr'
    },
    {
        id: 'form', title: 'Registro de Pesaje', subtitle: 'Peso en báscula',
        description: 'Ingresa el peso real. Compara automáticamente con lo declarado.',
        icon: <Scale />, features: ['Comparación automática', 'Diferencia %', 'Justificación'],
        color: '#f59e0b', previewType: 'form'
    },
    {
        id: 'complete', title: '¡Listo para Operar!', subtitle: 'Certificados automáticos',
        description: 'Cada cierre genera certificado para el generador.',
        icon: <CheckCircle2 />, features: ['Certificados', 'Historial', 'Reportes'],
        color: '#10b981', previewType: 'welcome'
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
        <div className={`tour-modal light ${isVisible ? 'visible' : ''}`}>
            <div className="tour-progress" style={{ background: `${slide.color}22` }}>
                <div className="tour-progress-fill" style={{ width: `${progress}%`, background: slide.color }} />
            </div>

            <button className="tour-close" onClick={handleComplete}><X size={24} /></button>
            <div className="tour-step-indicator">{currentSlide + 1} / {slides.length}</div>

            <div className={`tour-content ${direction}`} key={currentSlide}>
                {/* System Preview */}
                <SystemPreview type={slide.previewType} />

                {/* Text Content */}
                <div className="tour-text">
                    <div className="tour-icon" style={{ background: slide.color }}>
                        {slide.icon}
                    </div>
                    <h1 className="tour-title">{slide.title}</h1>
                    <h2 className="tour-subtitle" style={{ color: slide.color }}>{slide.subtitle}</h2>
                    <p className="tour-description">{slide.description}</p>

                    <div className="tour-features">
                        {slide.features.map((feature, idx) => (
                            <div key={idx} className="tour-feature" style={{ background: `${slide.color}15`, borderColor: `${slide.color}40` }}>
                                <CheckCircle2 size={16} style={{ color: slide.color }} />
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="tour-dots">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        className={`tour-dot ${idx === currentSlide ? 'active' : ''} ${idx < currentSlide ? 'completed' : ''}`}
                        onClick={() => { setDirection(idx > currentSlide ? 'next' : 'prev'); setCurrentSlide(idx); }}
                        style={idx === currentSlide ? { background: slide.color, boxShadow: `0 0 12px ${slide.color}` } : {}}
                    />
                ))}
            </div>

            <div className="tour-nav">
                <button className="tour-btn tour-btn-secondary" onClick={handlePrev} disabled={currentSlide === 0}>
                    <ChevronLeft size={20} /> Anterior
                </button>
                <button className="tour-btn tour-btn-skip" onClick={handleComplete}>Saltar tour</button>
                <button
                    className="tour-btn tour-btn-primary"
                    onClick={handleNext}
                    style={{ background: slide.color }}
                >
                    {currentSlide === slides.length - 1 ? (<>¡Comenzar! <Sparkles size={20} /></>) : (<>Siguiente <ChevronRight size={20} /></>)}
                </button>
            </div>
        </div>
    );
};

export default OnboardingTour;

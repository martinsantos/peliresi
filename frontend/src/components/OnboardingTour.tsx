import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
    FileText, Truck, MapPin, Users, BarChart3, Scale,
    Bell, Settings, QrCode, Shield, Factory, Building2,
    ClipboardCheck, AlertTriangle, Download, Zap
} from 'lucide-react';
import './OnboardingTour.css';

interface TourSlide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    color: string;
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
    },
    {
        id: 'dashboard',
        title: 'Dashboard Ejecutivo',
        subtitle: 'Vista general del sistema',
        description: 'Panel de control con métricas actualizadas automáticamente cada 5 minutos.',
        icon: <BarChart3 />,
        features: ['KPIs en tiempo real', 'Manifiestos por estado', 'Actividad reciente'],
        color: '#3b82f6',
    },
    {
        id: 'manifiestos',
        title: 'Gestión de Manifiestos',
        subtitle: 'Documentos de trazabilidad',
        description: 'Consulta, filtra y supervisa todos los manifiestos. Timeline completo de cada documento.',
        icon: <FileText />,
        features: ['Listado filtrable', 'Estados en tiempo real', 'Descarga PDF con QR'],
        color: '#8b5cf6',
    },
    {
        id: 'tracking',
        title: 'Tracking GPS',
        subtitle: 'Monitoreo en tiempo real',
        description: 'Mapa interactivo con ubicación de transportes activos. Actualización cada 30 segundos.',
        icon: <MapPin />,
        features: ['Mapa en vivo', 'ETA automático', 'Detección de desvíos'],
        color: '#f59e0b',
    },
    {
        id: 'actores',
        title: 'Gestión de Actores',
        subtitle: 'Usuarios del sistema',
        description: 'Administra Generadores, Transportistas y Operadores habilitados.',
        icon: <Users />,
        features: ['CRUD completo', 'Roles y permisos', 'Estado de habilitación'],
        color: '#ec4899',
    },
    {
        id: 'alertas',
        title: 'Sistema de Alertas',
        subtitle: 'Notificaciones automáticas',
        description: 'Configura reglas para alertas: vencimientos, desvíos, tiempos excesivos.',
        icon: <Bell />,
        features: ['Reglas personalizables', 'Email y push', 'Historial de alertas'],
        color: '#ef4444',
    },
    {
        id: 'reportes',
        title: 'Reportes Estadísticos',
        subtitle: 'Análisis y exportación',
        description: 'Genera informes por período, tipo de residuo, actor o zona geográfica.',
        icon: <BarChart3 />,
        features: ['Reportes personalizados', 'Exportación PDF/CSV/XML', 'Gráficos interactivos'],
        color: '#14b8a6',
    },
    {
        id: 'complete',
        title: '¡Tour Completado!',
        subtitle: 'Listo para comenzar',
        description: 'Ya conoces todas las funciones principales. Puedes volver a ver esta guía desde el botón "?" en cualquier momento.',
        icon: <CheckCircle2 />,
        features: ['Soporte disponible', 'Documentación completa', 'Actualizaciones continuas'],
        color: '#10b981',
    },
];

const slidesGenerador: TourSlide[] = [
    {
        id: 'welcome',
        title: '¡Bienvenido, Generador!',
        subtitle: 'Gestiona tus residuos peligrosos',
        description: 'Declara y gestiona tus residuos mediante manifiestos electrónicos con firma digital.',
        icon: <Factory />,
        features: ['Manifiestos digitales', 'Firma electrónica', 'Seguimiento en tiempo real'],
        color: '#10b981',
    },
    {
        id: 'crear',
        title: 'Crear Manifiesto',
        subtitle: 'Declaración de residuos',
        description: 'Selecciona tipo de residuo, cantidad, transportista y operador destino.',
        icon: <FileText />,
        features: ['Catálogo Ley 24.051', 'Datos precargados', 'QR automático'],
        color: '#3b82f6',
    },
    {
        id: 'asignar',
        title: 'Asignar Actores',
        subtitle: 'Transportista y Operador',
        description: 'Elige de la lista de actores habilitados compatibles con tu tipo de residuo.',
        icon: <Users />,
        features: ['Filtro por residuo', 'Verificación activa', 'Notificación automática'],
        color: '#8b5cf6',
    },
    {
        id: 'firmar',
        title: 'Firma Digital',
        subtitle: 'Validez legal',
        description: 'Al firmar, se genera código QR único y el transportista es notificado al instante.',
        icon: <ClipboardCheck />,
        features: ['Firma electrónica', 'Código QR único', 'Notificación push'],
        color: '#f59e0b',
    },
    {
        id: 'seguimiento',
        title: 'Seguimiento GPS',
        subtitle: 'Ubicación en tiempo real',
        description: 'Visualiza en mapa la ubicación del transporte durante todo el viaje.',
        icon: <MapPin />,
        features: ['Mapa interactivo', 'ETA estimado', 'Historial de ruta'],
        color: '#ec4899',
    },
    {
        id: 'historial',
        title: 'Historial y PDFs',
        subtitle: 'Registro completo',
        description: 'Accede al listado de manifiestos y descarga PDFs con todas las firmas.',
        icon: <Download />,
        features: ['Filtros avanzados', 'PDF descargable', 'Timeline de eventos'],
        color: '#14b8a6',
    },
    {
        id: 'complete',
        title: '¡Listo para Operar!',
        subtitle: 'Tu primer manifiesto',
        description: 'Al firmar un manifiesto, el transportista será notificado automáticamente.',
        icon: <CheckCircle2 />,
        features: ['Soporte disponible', 'Notificaciones activas', 'Certificados automáticos'],
        color: '#10b981',
    },
];

const slidesTransportista: TourSlide[] = [
    {
        id: 'welcome',
        title: '¡Bienvenido, Transportista!',
        subtitle: 'Gestiona retiros y entregas',
        description: 'La app funciona OFFLINE y sincroniza automáticamente al recuperar conexión.',
        icon: <Truck />,
        features: ['Modo offline', 'GPS automático', 'Sincronización'],
        color: '#10b981',
    },
    {
        id: 'asignados',
        title: 'Manifiestos Asignados',
        subtitle: 'Pendientes de retiro',
        description: 'Lista de manifiestos asignados con dirección, tipo de residuo y fecha límite.',
        icon: <FileText />,
        features: ['Lista ordenada', 'Direcciones claras', 'Fechas límite'],
        color: '#3b82f6',
    },
    {
        id: 'retiro',
        title: 'Confirmar Retiro',
        subtitle: 'En ubicación del generador',
        description: 'Registra el retiro con GPS, hora y firma en pantalla. Funciona 100% OFFLINE.',
        icon: <ClipboardCheck />,
        features: ['Captura GPS', 'Firma digital', 'Funciona offline'],
        color: '#8b5cf6',
    },
    {
        id: 'transporte',
        title: 'Durante el Transporte',
        subtitle: 'Tracking automático',
        description: 'Tu ubicación se registra automáticamente. Puedes registrar paradas o incidentes.',
        icon: <MapPin />,
        features: ['GPS continuo', 'Registro de paradas', 'Alertas de desvío'],
        color: '#f59e0b',
    },
    {
        id: 'incidentes',
        title: 'Registrar Incidentes',
        subtitle: 'Documentación de anomalías',
        description: 'Documenta accidentes, derrames o robos con descripción, fotos y GPS.',
        icon: <AlertTriangle />,
        features: ['Fotos adjuntas', 'Ubicación exacta', 'Alerta inmediata'],
        color: '#ef4444',
    },
    {
        id: 'entrega',
        title: 'Confirmar Entrega',
        subtitle: 'En destino del operador',
        description: 'Registra llegada, verifica GPS vs dirección destino, solicita confirmación.',
        icon: <CheckCircle2 />,
        features: ['Verificación GPS', 'Firma operador', 'Cierre parcial'],
        color: '#14b8a6',
    },
    {
        id: 'qr',
        title: 'Escaneo QR',
        subtitle: 'Verificación rápida',
        description: 'Escanea el código QR del manifiesto para carga rápida y verificación.',
        icon: <QrCode />,
        features: ['Lectura instantánea', 'Verificación', 'Modo manual'],
        color: '#ec4899',
    },
    {
        id: 'complete',
        title: '¡Listo para la Ruta!',
        subtitle: 'Modo offline disponible',
        description: 'La app funciona sin conexión. Los datos se sincronizan al recuperar señal.',
        icon: <Zap />,
        features: ['Sin internet', 'Sincronización', 'Datos seguros'],
        color: '#10b981',
    },
];

const slidesOperador: TourSlide[] = [
    {
        id: 'welcome',
        title: '¡Bienvenido, Operador!',
        subtitle: 'Recepción y tratamiento',
        description: 'Gestiona la recepción, pesaje y tratamiento de residuos en tu planta.',
        icon: <Building2 />,
        features: ['Recepción digital', 'Pesaje registrado', 'Certificados'],
        color: '#10b981',
    },
    {
        id: 'entrantes',
        title: 'Manifiestos Entrantes',
        subtitle: 'En camino a tu planta',
        description: 'Visualiza transportes en camino con generador, tipo de residuo y ETA.',
        icon: <Truck />,
        features: ['ETA estimado', 'Datos completos', 'Preparación anticipada'],
        color: '#3b82f6',
    },
    {
        id: 'recepcion',
        title: 'Recepción con QR',
        subtitle: 'Escaneo al llegar',
        description: 'Escanea el QR del manifiesto. Funciona OFFLINE contra lista de "Esperados".',
        icon: <QrCode />,
        features: ['Escaneo rápido', 'Validación offline', 'Lista esperados'],
        color: '#8b5cf6',
    },
    {
        id: 'pesaje',
        title: 'Registro de Pesaje',
        subtitle: 'Peso en báscula',
        description: 'Ingresa el peso real. El sistema compara con lo declarado automáticamente.',
        icon: <Scale />,
        features: ['Comparación automática', 'Diferencia %', 'Justificación'],
        color: '#f59e0b',
    },
    {
        id: 'tratamiento',
        title: 'Registrar Tratamiento',
        subtitle: 'Método aplicado',
        description: 'Documenta incineración, neutralización, encapsulamiento, etc.',
        icon: <Settings />,
        features: ['Métodos autorizados', 'Validación', 'Registro detallado'],
        color: '#ec4899',
    },
    {
        id: 'cierre',
        title: 'Cerrar Manifiesto',
        subtitle: 'Disposición final',
        description: 'Firma electrónica de cierre. Se genera certificado automático.',
        icon: <ClipboardCheck />,
        features: ['Firma digital', 'Certificado PDF', 'Notificación generador'],
        color: '#14b8a6',
    },
    {
        id: 'complete',
        title: '¡Listo para Operar!',
        subtitle: 'Certificados automáticos',
        description: 'Cada cierre genera certificado para el generador. Trazabilidad completa.',
        icon: <CheckCircle2 />,
        features: ['Certificados', 'Historial', 'Reportes'],
        color: '#10b981',
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
        return () => {
            document.body.style.overflow = '';
        };
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

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'Escape') handleComplete();
    };

    useEffect(() => {
        if (isVisible) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isVisible, currentSlide]);

    if (!isOpen) return null;

    return (
        <div className={`tour-modal ${isVisible ? 'visible' : ''}`}>
            {/* Progress bar */}
            <div className="tour-progress">
                <div className="tour-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            {/* Close button */}
            <button className="tour-close" onClick={handleComplete}>
                <X size={24} />
            </button>

            {/* Step indicator */}
            <div className="tour-step-indicator">
                {currentSlide + 1} / {slides.length}
            </div>

            {/* Main content */}
            <div className={`tour-content ${direction}`} key={currentSlide}>
                {/* Icon */}
                <div className="tour-icon" style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}88)` }}>
                    {slide.icon}
                </div>

                {/* Text */}
                <h1 className="tour-title">{slide.title}</h1>
                <h2 className="tour-subtitle">{slide.subtitle}</h2>
                <p className="tour-description">{slide.description}</p>

                {/* Features */}
                <div className="tour-features">
                    {slide.features.map((feature, idx) => (
                        <div key={idx} className="tour-feature" style={{ borderColor: `${slide.color}66` }}>
                            <CheckCircle2 size={16} style={{ color: slide.color }} />
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dots */}
            <div className="tour-dots">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        className={`tour-dot ${idx === currentSlide ? 'active' : ''} ${idx < currentSlide ? 'completed' : ''}`}
                        onClick={() => {
                            setDirection(idx > currentSlide ? 'next' : 'prev');
                            setCurrentSlide(idx);
                        }}
                        style={idx === currentSlide ? { background: slide.color } : {}}
                    />
                ))}
            </div>

            {/* Navigation */}
            <div className="tour-nav">
                <button
                    className="tour-btn tour-btn-secondary"
                    onClick={handlePrev}
                    disabled={currentSlide === 0}
                >
                    <ChevronLeft size={20} />
                    Anterior
                </button>

                <button className="tour-btn tour-btn-skip" onClick={handleComplete}>
                    Saltar
                </button>

                <button
                    className="tour-btn tour-btn-primary"
                    onClick={handleNext}
                    style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)` }}
                >
                    {currentSlide === slides.length - 1 ? (
                        <>
                            ¡Comenzar!
                            <Sparkles size={20} />
                        </>
                    ) : (
                        <>
                            Siguiente
                            <ChevronRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default OnboardingTour;

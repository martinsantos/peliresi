import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Target, Lightbulb,
    FileText, Truck, MapPin, Users, BarChart3, Scale, Play, RotateCcw, Eye, Zap
} from 'lucide-react';
import './OnboardingTour.css';

interface TourStep {
    id: string;
    title: string;
    content: string;
    target?: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: React.ReactNode;
    highlight?: string;
    action?: string;
    category?: string;
    navigateTo?: string; // Nueva prop para navegación
    waitForElement?: string; // Elemento a esperar después de navegar
    delay?: number; // Delay antes de mostrar el tooltip
}

// ==========================================
// TOUR ADMINISTRADOR - CON NAVEGACIÓN
// ==========================================
const tourStepsAdmin: TourStep[] = [
    {
        id: 'welcome',
        title: '🎉 Bienvenido al Sistema DGFA',
        content: 'Te guiaremos por todas las funciones del sistema con una experiencia interactiva. ¡Preparate para conocer el poder de la trazabilidad digital!',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    {
        id: 'dashboard-stats',
        title: '📊 Panel de Control en Tiempo Real',
        content: 'Métricas actualizadas automáticamente: manifiestos totales, borradores, en tránsito y completados. Un vistazo a toda la operación.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        highlight: 'Indicadores clave (KPIs)',
        category: 'Dashboard',
        navigateTo: '/dashboard',
    },
    {
        id: 'go-manifiestos',
        title: '📄 Vamos a ver los Manifiestos',
        content: 'El corazón del sistema. Aquí se gestionan todos los documentos de trazabilidad. ¡Te llevamos allí!',
        position: 'center',
        icon: <Zap className="step-icon-zap" />,
        category: 'Navegación',
        action: 'Navegando a Manifiestos...',
    },
    {
        id: 'manifiestos-list',
        title: '📋 Listado de Manifiestos',
        content: 'Vista completa de todos los manifiestos del sistema. Filtra por estado, fecha, generador o transportista. Click en cualquiera para ver el detalle.',
        target: '.manifiestos-table, .recent-list, .card',
        position: 'bottom',
        icon: <FileText />,
        highlight: 'Tabla de manifiestos con filtros',
        category: 'Manifiestos',
        navigateTo: '/manifiestos',
        delay: 500,
    },
    {
        id: 'go-tracking',
        title: '🗺️ Vamos al Mapa en Tiempo Real',
        content: 'Visualiza la ubicación GPS de todos los transportes activos. ¡Es impresionante!',
        position: 'center',
        icon: <MapPin className="step-icon-map" />,
        category: 'Navegación',
        action: 'Navegando al Tracking GPS...',
    },
    {
        id: 'tracking-map',
        title: '📍 Monitoreo GPS en Vivo',
        content: 'Mapa interactivo con la ubicación de cada transporte. Actualización cada 30 segundos. Detecta desvíos de ruta automáticamente.',
        target: '.tracking-content, .map-container, .card',
        position: 'right',
        icon: <MapPin />,
        highlight: 'Transportes activos en tiempo real',
        category: 'Tracking',
        navigateTo: '/tracking',
        delay: 500,
    },
    {
        id: 'go-actores',
        title: '👥 Gestión de Actores del Sistema',
        content: 'Administra Generadores, Transportistas y Operadores habilitados.',
        position: 'center',
        icon: <Users />,
        category: 'Navegación',
    },
    {
        id: 'actores-list',
        title: '🏢 Actores Habilitados',
        content: 'Crea usuarios, asigna roles y permisos. Ve el estado de habilitación de cada actor en la cadena de trazabilidad.',
        target: '.actors-grid, .card, table',
        position: 'bottom',
        icon: <Users />,
        highlight: 'Generadores, Transportistas, Operadores',
        category: 'Actores',
        navigateTo: '/actores',
        delay: 500,
    },
    {
        id: 'go-reportes',
        title: '📈 Reportes y Estadísticas',
        content: 'Genera informes personalizables para análisis y cumplimiento normativo.',
        position: 'center',
        icon: <BarChart3 />,
        category: 'Navegación',
    },
    {
        id: 'reportes-view',
        title: '📊 Centro de Reportes',
        content: 'Reportes por período, tipo de residuo, actor o zona geográfica. Exporta en PDF, CSV o XML.',
        target: '.reports-container, .card, .stats',
        position: 'bottom',
        icon: <BarChart3 />,
        highlight: 'Exportación multi-formato',
        category: 'Reportes',
        navigateTo: '/reportes',
        delay: 500,
    },
    {
        id: 'final-dashboard',
        title: '🏠 Regresando al Dashboard',
        content: 'Volvemos al panel principal para culminar el recorrido.',
        position: 'center',
        icon: <Target />,
        category: 'Final',
        navigateTo: '/dashboard',
        delay: 300,
    },
    {
        id: 'tour-complete',
        title: '🎊 ¡Tour Completado!',
        content: 'Ya conoces todas las funciones principales. El botón "Ayuda" está siempre disponible para repetir este tour. ¡Manos a la obra!',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
        category: 'Completado',
    },
];

// ==========================================
// TOUR GENERADOR - CON NAVEGACIÓN
// ==========================================
const tourStepsGenerador: TourStep[] = [
    {
        id: 'welcome',
        title: '🏭 Bienvenido, Generador',
        content: 'Este tour te mostrará cómo gestionar tus residuos peligrosos de manera digital y segura.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    {
        id: 'dashboard-gen',
        title: '📊 Tu Panel de Control',
        content: 'Aquí ves el resumen de todos tus manifiestos: cuántos están pendientes, en tránsito y completados.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        highlight: 'Tus estadísticas personales',
        category: 'Dashboard',
        navigateTo: '/dashboard',
    },
    {
        id: 'nuevo-btn',
        title: '➕ Crear Nuevo Manifiesto',
        content: 'Este es el botón más importante. Desde aquí inicias la declaración de un nuevo envío de residuos.',
        target: '.btn-nuevo-manifiesto, [href*="nuevo"]',
        position: 'bottom',
        icon: <FileText />,
        action: 'Click aquí para crear',
        category: 'Creación',
    },
    {
        id: 'go-form',
        title: '📝 Vamos al Formulario',
        content: 'Te mostramos cómo se ve el formulario de creación de manifiestos.',
        position: 'center',
        icon: <Zap className="step-icon-zap" />,
        category: 'Navegación',
    },
    {
        id: 'form-view',
        title: '📋 Formulario de Manifiesto',
        content: 'Aquí seleccionas: tipo de residuo, cantidad, transportista habilitado y operador destino. Tus datos ya están precargados.',
        target: 'form, .form-container, .card',
        position: 'right',
        icon: <FileText />,
        highlight: 'Campos del manifiesto',
        category: 'Creación',
        navigateTo: '/manifiestos/nuevo',
        delay: 500,
    },
    {
        id: 'go-historial',
        title: '📚 Tu Historial',
        content: 'Veamos el listado completo de tus manifiestos.',
        position: 'center',
        icon: <Eye />,
        category: 'Navegación',
    },
    {
        id: 'historial-view',
        title: '📋 Historial de Manifiestos',
        content: 'Todos tus manifiestos con su estado actual. Puedes filtrar, buscar y descargar PDFs.',
        target: '.manifiestos-table, table, .card',
        position: 'bottom',
        icon: <FileText />,
        highlight: 'Filtros y descarga PDF',
        category: 'Historial',
        navigateTo: '/manifiestos',
        delay: 500,
    },
    {
        id: 'back-dashboard',
        title: '🏠 Volviendo al Inicio',
        content: 'Regresamos al Dashboard.',
        position: 'center',
        icon: <Target />,
        navigateTo: '/dashboard',
        delay: 300,
    },
    {
        id: 'complete-gen',
        title: '✅ ¡Listo para Operar!',
        content: 'Ya sabes cómo crear y gestionar manifiestos. Al firmar, el transportista es notificado automáticamente. ¡Éxitos!',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

// ==========================================
// TOUR TRANSPORTISTA - CON NAVEGACIÓN
// ==========================================
const tourStepsTransportista: TourStep[] = [
    {
        id: 'welcome',
        title: '🚛 Bienvenido, Transportista',
        content: 'Te mostramos cómo gestionar retiros y entregas con tracking GPS y modo offline.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    {
        id: 'dashboard-trans',
        title: '📊 Tus Estadísticas',
        content: 'Manifiestos asignados, en tránsito y completados. Todo en un vistazo.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        category: 'Dashboard',
        navigateTo: '/dashboard',
    },
    {
        id: 'go-manifiestos',
        title: '📋 Veamos tus Asignaciones',
        content: 'Los manifiestos que tienes pendientes de retiro.',
        position: 'center',
        icon: <Truck />,
        category: 'Navegación',
    },
    {
        id: 'asignados-view',
        title: '📦 Manifiestos Pendientes',
        content: 'Lista de retiros asignados con dirección, tipo de residuo y fecha límite. Click para ver detalle.',
        target: '.manifiestos-table, table, .card',
        position: 'bottom',
        icon: <FileText />,
        highlight: 'Pendientes de retiro',
        category: 'Asignados',
        navigateTo: '/manifiestos',
        delay: 500,
    },
    {
        id: 'go-tracking',
        title: '📍 Tu Ubicación en Tiempo Real',
        content: 'Veamos el mapa de tracking GPS.',
        position: 'center',
        icon: <MapPin className="step-icon-map" />,
        category: 'Navegación',
    },
    {
        id: 'tracking-trans',
        title: '🗺️ Tracking GPS',
        content: 'Durante el transporte, tu ubicación se registra automáticamente. El generador y operador pueden seguirte en tiempo real.',
        target: '.tracking-content, .map-container, .card',
        position: 'right',
        icon: <MapPin />,
        highlight: 'Tu posición en el mapa',
        category: 'GPS',
        navigateTo: '/tracking',
        delay: 500,
    },
    {
        id: 'back-dashboard',
        title: '🏠 Volviendo al Inicio',
        content: 'Regresamos al Dashboard.',
        position: 'center',
        icon: <Target />,
        navigateTo: '/dashboard',
        delay: 300,
    },
    {
        id: 'complete-trans',
        title: '✅ ¡Listo para la Ruta!',
        content: 'La app funciona OFFLINE. Los datos se sincronizan al recuperar conexión. ¡Buen viaje!',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

// ==========================================
// TOUR OPERADOR - CON NAVEGACIÓN
// ==========================================
const tourStepsOperador: TourStep[] = [
    {
        id: 'welcome',
        title: '♻️ Bienvenido, Operador',
        content: 'Te mostramos cómo gestionar recepción, pesaje y tratamiento de residuos.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
        category: 'Inicio',
    },
    {
        id: 'dashboard-op',
        title: '📊 Tu Panel de Operaciones',
        content: 'Entregas en camino, pendientes de recepción y procesadas.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <BarChart3 />,
        category: 'Dashboard',
        navigateTo: '/dashboard',
    },
    {
        id: 'go-manifiestos',
        title: '🚚 Veamos las Entregas',
        content: 'Manifiestos que vienen en camino a tu planta.',
        position: 'center',
        icon: <Truck />,
        category: 'Navegación',
    },
    {
        id: 'entrantes-view',
        title: '📦 Manifiestos Entrantes',
        content: 'Lista de transportes en camino con ETA estimado. Prepara la recepción con anticipación.',
        target: '.manifiestos-table, table, .card',
        position: 'bottom',
        icon: <FileText />,
        highlight: 'En camino a tu planta',
        category: 'Recepción',
        navigateTo: '/manifiestos',
        delay: 500,
    },
    {
        id: 'process-info',
        title: '⚖️ Proceso de Recepción',
        content: 'Al llegar el transporte: 1) Escanea QR, 2) Pesa en báscula, 3) Firma recepción, 4) Registra tratamiento, 5) Cierra manifiesto.',
        position: 'center',
        icon: <Scale />,
        highlight: '5 pasos para cerrar el ciclo',
        category: 'Proceso',
    },
    {
        id: 'back-dashboard',
        title: '🏠 Volviendo al Inicio',
        content: 'Regresamos al Dashboard.',
        position: 'center',
        icon: <Target />,
        navigateTo: '/dashboard',
        delay: 300,
    },
    {
        id: 'complete-op',
        title: '✅ ¡Listo para Operar!',
        content: 'Cada cierre genera certificado automático. El generador recibe notificación de disposición final. ¡Éxitos!',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

interface OnboardingTourProps {
    userRole: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    onComplete: () => void;
    isOpen: boolean;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ userRole, onComplete, isOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(isOpen);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [isTransitioning, setIsTransitioning] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const getTourSteps = useCallback(() => {
        switch (userRole) {
            case 'ADMIN': return tourStepsAdmin;
            case 'GENERADOR': return tourStepsGenerador;
            case 'TRANSPORTISTA': return tourStepsTransportista;
            case 'OPERADOR': return tourStepsOperador;
            default: return tourStepsAdmin;
        }
    }, [userRole]);

    const steps = getTourSteps();
    const step = steps[currentStep];

    // Buscar elemento con fallbacks
    const findElement = useCallback((selector: string): Element | null => {
        if (!selector) return null;
        const selectors = selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }, []);

    const updateTargetPosition = useCallback(() => {
        if (!step?.target || isTransitioning) {
            setTargetRect(null);
            return;
        }

        const element = findElement(step.target);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 12;
            setTargetRect({
                top: rect.top - padding + window.scrollY,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
            });

            // Auto-scroll al elemento si no es visible
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setTargetRect(null);
        }
    }, [step, isTransitioning, findElement]);

    const updateTooltipPosition = useCallback(() => {
        if (!targetRect || !tooltipRef.current || step?.position === 'center') {
            setTooltipStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            });
            return;
        }

        const tooltip = tooltipRef.current.getBoundingClientRect();
        const gap = 20;
        let style: React.CSSProperties = { position: 'fixed' };
        const scrollY = window.scrollY;

        switch (step?.position) {
            case 'right':
                style.top = Math.max(20, Math.min(
                    targetRect.top - scrollY + targetRect.height / 2 - tooltip.height / 2,
                    window.innerHeight - tooltip.height - 20
                ));
                style.left = Math.min(targetRect.left + targetRect.width + gap, window.innerWidth - tooltip.width - 20);
                break;
            case 'left':
                style.top = targetRect.top - scrollY + targetRect.height / 2 - tooltip.height / 2;
                style.left = Math.max(20, targetRect.left - tooltip.width - gap);
                break;
            case 'bottom':
                style.top = Math.min(targetRect.top - scrollY + targetRect.height + gap, window.innerHeight - tooltip.height - 20);
                style.left = Math.max(20, Math.min(
                    targetRect.left + targetRect.width / 2 - tooltip.width / 2,
                    window.innerWidth - tooltip.width - 20
                ));
                break;
            case 'top':
                style.top = Math.max(20, targetRect.top - scrollY - tooltip.height - gap);
                style.left = targetRect.left + targetRect.width / 2 - tooltip.width / 2;
                break;
        }

        setTooltipStyle(style);
    }, [targetRect, step]);

    // Navegar al paso
    const navigateToStep = useCallback(async (stepIndex: number) => {
        const targetStep = steps[stepIndex];
        if (targetStep?.navigateTo && location.pathname !== targetStep.navigateTo) {
            setIsTransitioning(true);
            navigate(targetStep.navigateTo);

            // Esperar a que la navegación complete
            await new Promise(resolve => setTimeout(resolve, targetStep.delay || 400));
            setIsTransitioning(false);
        }
    }, [steps, navigate, location.pathname]);

    useEffect(() => {
        setShowTour(isOpen);
        if (isOpen) {
            setCurrentStep(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (showTour && !isTransitioning) {
            const timer = setTimeout(() => {
                updateTargetPosition();
                setTimeout(updateTooltipPosition, 100);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showTour, currentStep, isTransitioning, updateTargetPosition, updateTooltipPosition, location.pathname]);

    useEffect(() => {
        const handleResize = () => {
            updateTargetPosition();
            updateTooltipPosition();
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize);
        };
    }, [updateTargetPosition, updateTooltipPosition]);

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            const nextStep = currentStep + 1;
            await navigateToStep(nextStep);
            setCurrentStep(nextStep);
        } else {
            handleComplete();
        }
    };

    const handlePrev = async () => {
        if (currentStep > 0) {
            const prevStep = currentStep - 1;
            await navigateToStep(prevStep);
            setCurrentStep(prevStep);
        }
    };

    const handleComplete = () => {
        setShowTour(false);
        localStorage.setItem('tourCompleted', 'true');
        navigate('/dashboard');
        onComplete();
    };

    const handleRestart = () => {
        setCurrentStep(0);
        navigate('/dashboard');
    };

    if (!showTour) return null;

    const isCenter = !step?.target || step.position === 'center' || !findElement(step.target || '');
    const progress = ((currentStep + 1) / steps.length) * 100;

    return createPortal(
        <div className={`onboarding - overlay ${isTransitioning ? 'transitioning' : ''} `}>
            {/* SVG Mask para spotlight */}
            {!isTransitioning && (
                <svg className="onboarding-mask" width="100%" height="100%">
                    <defs>
                        <mask id="spotlight-mask">
                            <rect width="100%" height="100%" fill="white" />
                            {targetRect && (
                                <rect
                                    x={targetRect.left}
                                    y={targetRect.top}
                                    width={targetRect.width}
                                    height={targetRect.height}
                                    rx="16"
                                    fill="black"
                                    className="spotlight-cutout"
                                />
                            )}
                        </mask>
                    </defs>
                    <rect
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.92)"
                        mask="url(#spotlight-mask)"
                    />
                </svg>
            )}

            {/* Pantalla de transición */}
            {isTransitioning && (
                <div className="transition-screen">
                    <div className="transition-loader">
                        <Zap className="transition-icon" />
                    </div>
                    <p className="transition-text">Navegando...</p>
                </div>
            )}

            {/* Spotlight ring animado */}
            {targetRect && !isTransitioning && (
                <div
                    className="spotlight-ring"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            {/* Progress bar superior */}
            <div className="tour-progress-bar">
                <div className="tour-progress-fill" style={{ width: `${progress}% ` }} />
            </div>

            {/* Tooltip */}
            {!isTransitioning && (
                <div
                    ref={tooltipRef}
                    className={`onboarding - tooltip ${isCenter ? 'tooltip-center' : ''} tooltip - ${step?.position} `}
                    style={tooltipStyle}
                >
                    {!isCenter && <div className={`tooltip - arrow arrow - ${step?.position} `} />}

                    {/* Header */}
                    <div className="tooltip-header">
                        <div className="tooltip-icon-wrapper">
                            {step?.icon || <Lightbulb />}
                        </div>
                        <div className="tooltip-meta">
                            <div className="tooltip-step-indicator">
                                Paso {currentStep + 1} de {steps.length}
                            </div>
                            {step?.category && (
                                <div className="tooltip-category">{step.category}</div>
                            )}
                        </div>
                        <div className="tooltip-controls">
                            <button
                                className="tooltip-control-btn"
                                onClick={handleRestart}
                                title="Reiniciar tour"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button className="tooltip-close" onClick={handleComplete}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="tooltip-content">
                        <h3 className="tooltip-title">{step?.title}</h3>
                        <p className="tooltip-description">{step?.content}</p>

                        {step?.highlight && (
                            <div className="tooltip-highlight">
                                <Eye size={14} />
                                <span>{step.highlight}</span>
                            </div>
                        )}

                        {step?.action && (
                            <div className="tooltip-action-hint">
                                <Play size={14} />
                                <span>{step.action}</span>
                            </div>
                        )}
                    </div>

                    {/* Mini progress dots */}
                    <div className="tooltip-progress">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`progress - dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''} `}
                            />
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="tooltip-footer">
                        <button className="tooltip-skip" onClick={handleComplete}>
                            Salir del tour
                        </button>
                        <div className="tooltip-nav">
                            {currentStep > 0 && (
                                <button className="tooltip-btn tooltip-btn-secondary" onClick={handlePrev}>
                                    <ChevronLeft size={18} />
                                    Anterior
                                </button>
                            )}
                            <button className="tooltip-btn tooltip-btn-primary" onClick={handleNext}>
                                {currentStep === steps.length - 1 ? (
                                    <>
                                        ¡Comenzar!
                                        <CheckCircle2 size={18} />
                                    </>
                                ) : step?.navigateTo ? (
                                    <>
                                        Ir allí
                                        <Zap size={18} />
                                    </>
                                ) : (
                                    <>
                                        Siguiente
                                        <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default OnboardingTour;

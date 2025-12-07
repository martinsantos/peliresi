import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Target, Lightbulb } from 'lucide-react';
import './OnboardingTour.css';

interface TourStep {
    id: string;
    title: string;
    content: string;
    target?: string; // CSS selector
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: React.ReactNode;
    highlight?: string;
    action?: string;
}

const tourStepsAdmin: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenido al Sistema de Trazabilidad',
        content: 'Este sistema permite gestionar el ciclo completo de residuos peligrosos: desde su generación hasta la disposición final. Te guiaremos por las funciones principales.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
    },
    {
        id: 'sidebar',
        title: 'Menú de Navegación',
        content: 'Desde aquí accedes a todos los módulos del sistema: Manifiestos, Tracking GPS, Reportes, Alertas y más.',
        target: '.sidebar',
        position: 'right',
        icon: <Target />,
        highlight: 'Menú lateral izquierdo',
        action: 'Explora las opciones del menú',
    },
    {
        id: 'stats',
        title: 'Panel de Estadísticas',
        content: 'Visualiza métricas en tiempo real: manifiestos totales, en borrador, en tránsito y completados.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <Lightbulb />,
        highlight: 'Indicadores clave',
    },
    {
        id: 'tracking',
        title: 'Tracking GPS en Tiempo Real',
        content: 'Monitorea la ubicación exacta de todos los transportes activos en el mapa interactivo.',
        target: '[href*="tracking"]',
        position: 'right',
        icon: <Target />,
        action: 'Click para ver el mapa',
    },
    {
        id: 'actores',
        title: 'Gestión de Actores',
        content: 'Administra Generadores, Transportistas y Operadores habilitados en el sistema.',
        target: '[href*="actores"]',
        position: 'right',
        icon: <Target />,
    },
    {
        id: 'complete',
        title: '¡Todo Listo!',
        content: 'Ya conoces las funciones principales. Puedes volver a ver esta guía desde el botón "Ayuda" en cualquier momento.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

const tourStepsGenerador: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenido, Generador',
        content: 'Desde este panel puedes crear manifiestos electrónicos para declarar tus residuos peligrosos.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
    },
    {
        id: 'nuevo',
        title: 'Crear Nuevo Manifiesto',
        content: 'Haz click aquí para crear un nuevo manifiesto. Selecciona residuo, transportista y operador destino.',
        target: '.btn-nuevo-manifiesto',
        position: 'bottom',
        icon: <Target />,
        action: 'Click para comenzar',
    },
    {
        id: 'stats',
        title: 'Tus Estadísticas',
        content: 'Ve el resumen de tus manifiestos: borradores, en tránsito y completados.',
        target: '.stats-grid',
        position: 'bottom',
        icon: <Lightbulb />,
    },
    {
        id: 'manifiestos',
        title: 'Historial de Manifiestos',
        content: 'Consulta todos tus manifiestos, descarga PDFs y realiza seguimiento.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <Target />,
    },
    {
        id: 'complete',
        title: '¡Listo para Comenzar!',
        content: 'Al firmar un manifiesto, el transportista será notificado automáticamente.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

const tourStepsTransportista: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenido, Transportista',
        content: 'Gestiona los retiros y entregas de residuos peligrosos asignados a tu empresa.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
    },
    {
        id: 'manifiestos',
        title: 'Manifiestos Asignados',
        content: 'Ve los manifiestos pendientes de retiro que te han sido asignados.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <Target />,
    },
    {
        id: 'tracking',
        title: 'Tracking GPS',
        content: 'Tu ubicación se registra automáticamente durante el transporte para trazabilidad completa.',
        target: '[href*="tracking"]',
        position: 'right',
        icon: <Lightbulb />,
    },
    {
        id: 'complete',
        title: '¡Listo para Operar!',
        content: 'La app funciona offline. Los datos se sincronizan al recuperar conexión.',
        position: 'center',
        icon: <CheckCircle2 className="step-icon-success" />,
    },
];

const tourStepsOperador: TourStep[] = [
    {
        id: 'welcome',
        title: 'Bienvenido, Operador',
        content: 'Gestiona la recepción, pesaje y tratamiento de residuos peligrosos en tu planta.',
        position: 'center',
        icon: <Sparkles className="step-icon-sparkle" />,
    },
    {
        id: 'manifiestos',
        title: 'Manifiestos Entrantes',
        content: 'Ve los transportes en camino a tu planta con ETA estimado.',
        target: '[href*="manifiestos"]',
        position: 'right',
        icon: <Target />,
    },
    {
        id: 'complete',
        title: '¡Listo para Operar!',
        content: 'Escanea QR para recepción rápida. Cada cierre genera certificado automático.',
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
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(isOpen);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
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

    // Calcular posición del elemento target
    const updateTargetPosition = useCallback(() => {
        if (!step?.target) {
            setTargetRect(null);
            return;
        }

        const element = document.querySelector(step.target);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 8;
            setTargetRect({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
            });
        }
    }, [step]);

    // Calcular posición del tooltip
    const updateTooltipPosition = useCallback(() => {
        if (!targetRect || !tooltipRef.current) {
            // Centrado
            setTooltipStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            });
            return;
        }

        const tooltip = tooltipRef.current;
        const tooltipRect = tooltip.getBoundingClientRect();
        const gap = 16;
        let style: React.CSSProperties = {};

        switch (step?.position) {
            case 'right':
                style = {
                    top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
                    left: targetRect.left + targetRect.width + gap,
                };
                break;
            case 'left':
                style = {
                    top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
                    left: targetRect.left - tooltipRect.width - gap,
                };
                break;
            case 'bottom':
                style = {
                    top: targetRect.top + targetRect.height + gap,
                    left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
                };
                break;
            case 'top':
                style = {
                    top: targetRect.top - tooltipRect.height - gap,
                    left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
                };
                break;
            default:
                style = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                };
        }

        // Bounds checking
        if (typeof style.left === 'number' && style.left < 20) style.left = 20;
        if (typeof style.top === 'number' && style.top < 20) style.top = 20;

        setTooltipStyle(style);
    }, [targetRect, step]);

    useEffect(() => {
        setShowTour(isOpen);
        if (isOpen) setCurrentStep(0);
    }, [isOpen]);

    useEffect(() => {
        if (showTour) {
            updateTargetPosition();
            const timer = setTimeout(updateTooltipPosition, 50);
            return () => clearTimeout(timer);
        }
    }, [showTour, currentStep, updateTargetPosition, updateTooltipPosition]);

    useEffect(() => {
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition);
        return () => {
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition);
        };
    }, [updateTargetPosition]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        setShowTour(false);
        localStorage.setItem('tourCompleted', 'true');
        onComplete();
    };

    if (!showTour) return null;

    const isCenter = !step?.target || step.position === 'center';

    return createPortal(
        <div className="onboarding-overlay">
            {/* SVG Mask para el spotlight */}
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
                                rx="12"
                                fill="black"
                                className="spotlight-cutout"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Spotlight ring animado */}
            {targetRect && (
                <div
                    className="spotlight-ring"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                />
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`onboarding-tooltip ${isCenter ? 'tooltip-center' : ''} tooltip-${step?.position}`}
                style={tooltipStyle}
            >
                {/* Flecha */}
                {!isCenter && <div className={`tooltip-arrow arrow-${step?.position}`} />}

                {/* Header con icono */}
                <div className="tooltip-header">
                    <div className="tooltip-icon-wrapper">
                        {step?.icon || <Lightbulb />}
                    </div>
                    <div className="tooltip-step-indicator">
                        Paso {currentStep + 1} de {steps.length}
                    </div>
                    <button className="tooltip-close" onClick={handleComplete}>
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido */}
                <div className="tooltip-content">
                    <h3 className="tooltip-title">{step?.title}</h3>
                    <p className="tooltip-description">{step?.content}</p>

                    {step?.action && (
                        <div className="tooltip-action-hint">
                            <Target size={14} />
                            <span>{step.action}</span>
                        </div>
                    )}
                </div>

                {/* Progress dots */}
                <div className="tooltip-progress">
                    {steps.map((_, idx) => (
                        <button
                            key={idx}
                            className={`progress-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
                            onClick={() => setCurrentStep(idx)}
                        />
                    ))}
                </div>

                {/* Footer con botones */}
                <div className="tooltip-footer">
                    <button className="tooltip-skip" onClick={handleComplete}>
                        Omitir tour
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
                                    Comenzar
                                    <CheckCircle2 size={18} />
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
        </div>,
        document.body
    );
};

export default OnboardingTour;

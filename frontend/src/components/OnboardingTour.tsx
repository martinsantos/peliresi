import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle, CheckCircle } from 'lucide-react';

interface TourStep {
    id: string;
    title: string;
    content: string;
    target?: string; // CSS selector del elemento a destacar
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    highlight?: string;
}

const tourStepsAdmin: TourStep[] = [
    {
        id: 'welcome',
        title: '👋 Bienvenido al Sistema de Trazabilidad',
        content: 'Este sistema permite gestionar el ciclo completo de residuos peligrosos: desde su generación hasta la disposición final.',
        position: 'center',
    },
    {
        id: 'dashboard',
        title: '📊 Dashboard Ejecutivo',
        content: 'Aquí verá métricas en tiempo real: manifiestos activos, en tránsito, completados y alertas pendientes.',
        target: '.dashboard-metrics',
        position: 'bottom',
        highlight: 'Panel de indicadores',
    },
    {
        id: 'sidebar',
        title: '📋 Menú de Navegación',
        content: 'Acceda a Manifiestos, Tracking GPS, Gestión de Actores, Alertas y Reportes desde el menú lateral.',
        target: '.sidebar',
        position: 'right',
        highlight: 'Menú lateral',
    },
    {
        id: 'tracking',
        title: '🗺️ Monitoreo en Tiempo Real',
        content: 'En "Tracking" puede ver la ubicación GPS de todos los transportes activos en el mapa.',
        target: '[href*="tracking"]',
        position: 'right',
        highlight: 'Opción Tracking',
    },
    {
        id: 'actores',
        title: '👥 Gestión de Actores',
        content: 'Administre Generadores, Transportistas y Operadores habilitados desde "Actores".',
        target: '[href*="actores"]',
        position: 'right',
        highlight: 'Opción Actores',
    },
    {
        id: 'done',
        title: '✅ ¡Listo para Comenzar!',
        content: 'Puede volver a ver esta guía en cualquier momento desde el ícono de ayuda (?)',
        position: 'center',
    },
];

const tourStepsGenerador: TourStep[] = [
    {
        id: 'welcome',
        title: '🏭 Bienvenido, Generador',
        content: 'Desde aquí puede crear manifiestos electrónicos para declarar sus residuos peligrosos.',
        position: 'center',
    },
    {
        id: 'dashboard',
        title: '📊 Su Panel de Control',
        content: 'Vea el resumen de sus manifiestos: borradores, en tránsito y completados.',
        target: '.dashboard-metrics',
        position: 'bottom',
        highlight: 'Contadores de manifiestos',
    },
    {
        id: 'nuevo',
        title: '➕ Crear Nuevo Manifiesto',
        content: 'Click en "Nuevo Manifiesto" para declarar un nuevo envío de residuos peligrosos.',
        target: '.btn-nuevo-manifiesto',
        position: 'bottom',
        highlight: 'Botón Nuevo Manifiesto',
    },
    {
        id: 'manifiestos',
        title: '📋 Historial de Manifiestos',
        content: 'Consulte todos sus manifiestos, filtre por estado y descargue PDFs.',
        target: '[href*="manifiestos"]',
        position: 'right',
        highlight: 'Opción Manifiestos',
    },
    {
        id: 'done',
        title: '✅ ¡Listo para Comenzar!',
        content: 'Recuerde: al firmar un manifiesto, el transportista será notificado automáticamente.',
        position: 'center',
    },
];

const tourStepsTransportista: TourStep[] = [
    {
        id: 'welcome',
        title: '🚛 Bienvenido, Transportista',
        content: 'Aquí gestiona los retiros y entregas de residuos peligrosos asignados a su empresa.',
        position: 'center',
    },
    {
        id: 'asignados',
        title: '📋 Manifiestos Asignados',
        content: 'Vea los manifiestos pendientes de retiro que le han sido asignados.',
        target: '.dashboard-metrics',
        position: 'bottom',
        highlight: 'Lista de manifiestos',
    },
    {
        id: 'retiro',
        title: '✅ Confirmar Retiro',
        content: 'Al retirar la carga, confirme el retiro. El sistema captura GPS y hora automáticamente.',
        position: 'center',
    },
    {
        id: 'tracking',
        title: '📍 Tracking GPS',
        content: 'Durante el transporte, su ubicación se registra para trazabilidad completa.',
        target: '[href*="tracking"]',
        position: 'right',
        highlight: 'Opción Tracking',
    },
    {
        id: 'done',
        title: '✅ ¡Listo para Operar!',
        content: 'Recuerde: la app funciona offline. Los datos se sincronizan al recuperar conexión.',
        position: 'center',
    },
];

const tourStepsOperador: TourStep[] = [
    {
        id: 'welcome',
        title: '♻️ Bienvenido, Operador',
        content: 'Aquí gestiona la recepción, pesaje y tratamiento de residuos peligrosos.',
        position: 'center',
    },
    {
        id: 'entrantes',
        title: '🚚 Manifiestos Entrantes',
        content: 'Vea los transportes en camino a su planta con ETA estimado.',
        target: '.dashboard-metrics',
        position: 'bottom',
        highlight: 'Manifiestos entrantes',
    },
    {
        id: 'recepcion',
        title: '📥 Proceso de Recepción',
        content: 'Al llegar el transporte: escanee QR → Pese → Firme recepción.',
        position: 'center',
    },
    {
        id: 'tratamiento',
        title: '⚗️ Registrar Tratamiento',
        content: 'Documente el método de tratamiento aplicado al residuo.',
        position: 'center',
    },
    {
        id: 'cierre',
        title: '🔒 Cerrar Manifiesto',
        content: 'Al cerrar, se genera el certificado de disposición y se completa la trazabilidad.',
        position: 'center',
    },
    {
        id: 'done',
        title: '✅ ¡Listo para Operar!',
        content: 'Cada cierre genera un certificado automático para el generador.',
        position: 'center',
    },
];

interface OnboardingTourProps {
    userRole: 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
    onComplete: () => void;
    isOpen: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ userRole, onComplete, isOpen }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(isOpen);

    const getTourSteps = () => {
        switch (userRole) {
            case 'ADMIN':
                return tourStepsAdmin;
            case 'GENERADOR':
                return tourStepsGenerador;
            case 'TRANSPORTISTA':
                return tourStepsTransportista;
            case 'OPERADOR':
                return tourStepsOperador;
            default:
                return tourStepsAdmin;
        }
    };

    const steps = getTourSteps();
    const step = steps[currentStep];

    useEffect(() => {
        setShowTour(isOpen);
        if (isOpen) setCurrentStep(0);
    }, [isOpen]);

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

    const handleSkip = () => {
        handleComplete();
    };

    if (!showTour) return null;

    return (
        <>
            {/* Overlay oscuro */}
            <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={handleSkip} />

            {/* Modal del tour */}
            <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HelpCircle size={24} />
                                <span className="font-semibold">Guía del Sistema</span>
                            </div>
                            <button
                                onClick={handleSkip}
                                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 flex gap-1">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1 flex-1 rounded-full transition-colors ${idx <= currentStep ? 'bg-white' : 'bg-white/30'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-3">{step.title}</h3>
                        <p className="text-gray-600 leading-relaxed mb-4">{step.content}</p>

                        {step.highlight && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                <div className="flex items-center gap-2 text-amber-700">
                                    <CheckCircle size={18} />
                                    <span className="font-medium">🎯 Zona destacada:</span>
                                </div>
                                <span className="text-amber-800 font-semibold ml-6">{step.highlight}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 p-4 flex items-center justify-between bg-gray-50">
                        <span className="text-sm text-gray-500">
                            Paso {currentStep + 1} de {steps.length}
                        </span>
                        <div className="flex gap-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={handlePrev}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <ChevronLeft size={18} />
                                    Anterior
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors flex items-center gap-1 font-medium"
                            >
                                {currentStep === steps.length - 1 ? (
                                    <>
                                        Comenzar
                                        <CheckCircle size={18} />
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
            </div>
        </>
    );
};

export default OnboardingTour;

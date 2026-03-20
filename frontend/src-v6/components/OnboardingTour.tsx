/**
 * SITREP v6 - Onboarding Tour
 * ============================
 * Multi-step guided tour that highlights key UI elements
 * with a spotlight overlay effect.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// ========================================
// TYPES
// ========================================
export interface TourStep {
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

// ========================================
// TOUR STEPS
// ========================================
const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard',
    description:
      'Tu panel principal con indicadores clave: manifiestos activos, alertas pendientes y estadísticas en tiempo real del sistema de trazabilidad.',
    targetSelector: 'a[href="/dashboard"]',
    position: 'right',
  },
  {
    title: 'Manifiestos + Búsqueda Global',
    description:
      'Gestiona el ciclo de vida completo de manifiestos de residuos peligrosos. Tip: usa Cmd+K (o Ctrl+K) para buscar cualquier manifiesto, generador o transportista desde cualquier página.',
    targetSelector: 'a[href="/manifiestos"]',
    position: 'right',
  },
  {
    title: 'Centro de Control',
    description:
      'Monitorea en tiempo real la ubicación de los vehículos en el mapa, el estado de los viajes activos y estadísticas del pipeline. Con presets de fecha: Hoy, 7d, 30d, 90d.',
    targetSelector: 'a[href="/centro-control"]',
    position: 'right',
  },
  {
    title: 'Reportes',
    description:
      'Genera reportes detallados de manifiestos, residuos, operadores y transportistas con 8 pestañas de análisis. Exporta a PDF y CSV.',
    targetSelector: 'a[href="/reportes"]',
    position: 'right',
  },
  {
    title: 'Configuración',
    description:
      'Personaliza tus preferencias de notificaciones por email, cambia tu contraseña y ajusta la apariencia del sistema. Los administradores tienen opciones adicionales.',
    targetSelector: 'a[href="/configuracion"]',
    position: 'right',
  },
];

const STORAGE_KEY = 'sitrep_tour_completed';

// ========================================
// COMPONENT
// ========================================
export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  onComplete,
  forceShow = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Only show tour when explicitly triggered via forceShow prop
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setCurrentStep(0);
    }
  }, [forceShow]);

  // Measure target element and position tooltip
  const positionTooltip = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      // Fallback: if element not found, skip to next available or center
      setTargetRect(null);
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const pad = 16;
    const style: React.CSSProperties = {};

    switch (step.position) {
      case 'right':
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + pad;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + pad;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.top = rect.bottom + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = window.innerHeight - rect.top + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = 'translateX(-50%)';
        break;
    }

    setTooltipStyle(style);
  }, [currentStep]);

  useEffect(() => {
    if (!visible) return;
    positionTooltip();

    const handleResize = () => positionTooltip();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [visible, currentStep, positionTooltip]);

  const finish = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const next = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const spotlightPad = 6;

  return (
    <div className="fixed inset-0 z-[9999]" aria-live="polite">
      {/* Dark overlay with spotlight cutout via SVG */}
      <svg
        className="absolute inset-0 w-full h-full transition-all duration-300"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - spotlightPad}
                y={targetRect.top - spotlightPad}
                width={targetRect.width + spotlightPad * 2}
                height={targetRect.height + spotlightPad * 2}
                rx={12}
                fill="black"
                className="transition-all duration-300"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Click blocker (closes on background click) */}
      <div className="absolute inset-0" onClick={finish} />

      {/* Spotlight ring */}
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-primary-400 pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - spotlightPad,
            left: targetRect.left - spotlightPad,
            width: targetRect.width + spotlightPad * 2,
            height: targetRect.height + spotlightPad * 2,
            boxShadow: '0 0 0 3px rgba(27,94,60,0.25)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 w-80 bg-white rounded-2xl shadow-xl border border-neutral-200 animate-scale-in"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-base font-bold text-neutral-900">{step.title}</h3>
          <button
            onClick={finish}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Cerrar tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <p className="px-5 pb-4 text-sm text-neutral-600 leading-relaxed">
          {step.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-4">
          {/* Progress */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === currentStep
                    ? 'w-5 bg-primary-500'
                    : i < currentStep
                    ? 'w-1.5 bg-primary-300'
                    : 'w-1.5 bg-neutral-200'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-neutral-400">
              {currentStep + 1}/{TOUR_STEPS.length}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentStep === 0 ? (
              <button
                onClick={finish}
                className="text-xs text-neutral-500 hover:text-neutral-700 px-2 py-1 transition-colors"
              >
                Omitir tour
              </button>
            ) : (
              <button
                onClick={prev}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-800 px-2 py-1 transition-colors"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {currentStep < TOUR_STEPS.length - 1 ? (
                <>
                  Siguiente
                  <ChevronRight size={14} />
                </>
              ) : (
                'Finalizar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Utility: reset tour so it shows again on next load.
 */
export const resetOnboardingTour = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export default OnboardingTour;

/**
 * SITREP v6 - Demo App Onboarding
 * ================================
 * Role-specific welcome carousel/modal shown on first login per role.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Factory,
  Truck,
  FlaskConical,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth, type UserRole } from '../contexts/AuthContext';

// ========================================
// TYPES
// ========================================
interface Slide {
  icon: React.ElementType;
  title: string;
  points: string[];
  color: string; // tailwind bg-* class
}

// ========================================
// ROLE SLIDE DATA
// ========================================
const ROLE_SLIDES: Record<UserRole, Slide[]> = {
  ADMIN: [
    {
      icon: Shield,
      title: 'Administrador del Sistema',
      points: [
        'Gestiona usuarios y asigna roles: ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR y sub-roles delegados.',
        'Supervisa el estado de todos los manifiestos en tiempo real desde el Centro de Control.',
        'Genera reportes consolidados y audita la trazabilidad completa del sistema.',
      ],
      color: 'bg-primary-100 text-primary-700',
    },
    {
      icon: Factory,
      title: 'Herramientas de Administración',
      points: [
        'Acceso Comodín: impersoná a cualquier usuario para verificar su experiencia (icono ojo en Admin → Usuarios).',
        'Búsqueda global instantánea con Cmd+K (o Ctrl+K): manifiestos, actores y más desde cualquier página.',
        'Importación masiva de datos desde archivos CSV. Sub-roles delegados para cada dominio.',
      ],
      color: 'bg-primary-50 text-primary-600',
    },
  ],
  GENERADOR: [
    {
      icon: Factory,
      title: 'Generador de Residuos',
      points: [
        'Crea manifiestos de transporte de residuos peligrosos.',
        'Registra tipos y cantidades de residuos generados.',
        'Solicita retiros y hace seguimiento del estado.',
      ],
      color: 'bg-purple-100 text-purple-700',
    },
    {
      icon: ClipboardCheck,
      title: 'Seguimiento Completo',
      points: [
        'Visualiza el ciclo de vida de cada manifiesto.',
        'Recibe alertas cuando hay novedades en tus envios.',
        'Descarga certificados y comprobantes en PDF.',
      ],
      color: 'bg-purple-50 text-purple-600',
    },
  ],
  TRANSPORTISTA: [
    {
      icon: Truck,
      title: 'Transportista',
      points: [
        'Gestiona los retiros asignados y planifica las rutas.',
        'Actualiza el tracking GPS durante el viaje (cada 30 segundos, con resiliencia offline).',
        'Confirma entregas y registra novedades en ruta.',
      ],
      color: 'bg-orange-100 text-orange-700',
    },
    {
      icon: ClipboardCheck,
      title: 'Control de Viajes y Flota',
      points: [
        'Gestioná tu propia flota: agregá, editá y eliminá vehículos y conductores desde tu perfil (Transporte → Perfil → Info).',
        'Escanea códigos QR para validar cargas y registra incidentes en ruta.',
        'Consulta tu historial completo de viajes realizados.',
      ],
      color: 'bg-orange-50 text-orange-600',
    },
  ],
  OPERADOR: [
    {
      icon: FlaskConical,
      title: 'Operador de Tratamiento',
      points: [
        'Recibe residuos y registra el pesaje de ingreso.',
        'Documenta el tratamiento aplicado a cada lote.',
        'Cierra manifiestos confirmando la disposicion final.',
      ],
      color: 'bg-green-100 text-green-700',
    },
    {
      icon: ClipboardCheck,
      title: 'Documentacion',
      points: [
        'Genera certificados de tratamiento y disposicion.',
        'Mantiene trazabilidad completa del proceso.',
        'Consulta estadisticas de residuos procesados.',
      ],
      color: 'bg-green-50 text-green-600',
    },
  ],
  AUDITOR: [
    {
      icon: ClipboardCheck,
      title: 'Auditor',
      points: [
        'Consulta todos los manifiestos del sistema.',
        'Revisa la trazabilidad completa de cada residuo.',
        'Genera informes de auditoria y cumplimiento.',
      ],
      color: 'bg-blue-100 text-blue-700',
    },
    {
      icon: Shield,
      title: 'Control y Verificacion',
      points: [
        'Compara datos declarados vs. datos reales de pesaje.',
        'Detecta inconsistencias y genera alertas.',
        'Exporta evidencia documental para fiscalizaciones.',
      ],
      color: 'bg-blue-50 text-blue-600',
    },
  ],
  ADMIN_TRANSPORTISTA: [
    {
      icon: Truck,
      title: 'Administrador de Transportistas',
      points: [
        'Gestioná transportistas, vehículos y conductores de tu dominio.',
        'Accedés al Centro de Control para supervisar viajes activos.',
        'Tenés acceso a manifiestos, reportes y alertas relacionadas.',
      ],
      color: 'bg-orange-100 text-orange-700',
    },
  ],
  ADMIN_GENERADOR: [
    {
      icon: Factory,
      title: 'Administrador de Generadores',
      points: [
        'Gestioná generadores y el catálogo de residuos peligrosos.',
        'Administrás altas, bajas y modificaciones de generadores.',
        'Tenés acceso a manifiestos, reportes y alertas de tu dominio.',
      ],
      color: 'bg-purple-100 text-purple-700',
    },
  ],
  ADMIN_OPERADOR: [
    {
      icon: FlaskConical,
      title: 'Administrador de Operadores',
      points: [
        'Gestioná operadores y el catálogo de tratamientos autorizados.',
        'Administrás altas, bajas y modificaciones de operadores.',
        'Tenés acceso a manifiestos, reportes y alertas de tu dominio.',
      ],
      color: 'bg-teal-100 text-teal-700',
    },
  ],
};

const storageKey = (role: string) => `sitrep_onboarding_${role}`;

// ========================================
// COMPONENT
// ========================================
export const DemoAppOnboarding: React.FC = () => {
  const { currentUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const role = currentUser?.rol as UserRole | undefined;
  const slides = role ? ROLE_SLIDES[role] : [];

  // Auto-trigger disabled - onboarding can be shown manually via help button
  // useEffect(() => {
  //   if (!role) return;
  //   const done = localStorage.getItem(storageKey(role));
  //   if (!done) {
  //     const timer = setTimeout(() => setVisible(true), 1200);
  //     return () => clearTimeout(timer);
  //   }
  // }, [role]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (role) localStorage.setItem(storageKey(role), 'true');
  }, [role]);

  if (!visible || !slides.length) return null;

  const slide = slides[slideIndex];
  const Icon = slide.icon;
  const isLast = slideIndex === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={dismiss}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors z-10"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Slide content */}
        <div className="p-8 animate-fade-in" key={slideIndex}>
          {/* Icon */}
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${slide.color}`}
          >
            <Icon size={32} />
          </div>

          <h2 className="text-xl font-bold text-neutral-900 text-center mb-2">
            Bienvenido a SITREP
          </h2>
          <p className="text-sm text-neutral-500 text-center mb-6">
            {slide.title}
          </p>

          {/* Points */}
          <ul className="space-y-3 mb-8">
            {slide.points.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-neutral-700 leading-relaxed">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          {/* Progress dots */}
          {slides.length > 1 && (
            <div className="flex justify-center gap-2 mb-6">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === slideIndex ? 'w-6 bg-primary-500' : 'w-2 bg-neutral-200'
                  }`}
                  aria-label={`Ir a slide ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {slideIndex > 0 ? (
              <button
                onClick={() => setSlideIndex((s) => s - 1)}
                className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
            ) : (
              <div />
            )}

            {isLast ? (
              <button
                onClick={dismiss}
                className="px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
              >
                Comenzar
              </button>
            ) : (
              <button
                onClick={() => setSlideIndex((s) => s + 1)}
                className="flex items-center gap-1 px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Utility: reset role onboarding so it shows again.
 */
export const resetDemoOnboarding = (role?: string) => {
  if (role) {
    localStorage.removeItem(storageKey(role));
  } else {
    ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR'].forEach((r) =>
      localStorage.removeItem(storageKey(r))
    );
  }
};

export default DemoAppOnboarding;

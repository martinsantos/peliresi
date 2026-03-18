/**
 * SITREP - Onboarding Wizard unificado
 * Se activa en primera sesión y post-reset de contraseña
 */
import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Leaf } from 'lucide-react';
import type { UserRole } from '../contexts/AuthContext';

interface Step { title: string; desc: string; emoji: string }

const STEPS_BY_ROLE: Record<string, Step[]> = {
  GENERADOR: [
    { emoji: '🏭', title: 'Sos un Generador de Residuos Peligrosos', desc: 'Desde SITREP podés gestionar todo el ciclo de tus residuos peligrosos de forma digital.' },
    { emoji: '📋', title: 'Crear un Manifiesto', desc: 'Registrá una generación desde el botón + en la sección Manifiestos.' },
    { emoji: '✍️', title: 'Aprobar y firmar', desc: 'Firmá digitalmente el manifiesto para habilitarlo al transporte.' },
    { emoji: '🔍', title: 'Seguimiento en tiempo real', desc: 'Seguí el estado de cada manifiesto desde "Mis Manifiestos".' },
    { emoji: '📊', title: 'Reportes y certificados', desc: 'Descargá reportes y certificados de disposición final.' },
  ],
  TRANSPORTISTA: [
    { emoji: '🚛', title: 'Sos Transportista de RRPP', desc: 'SITREP te permite gestionar los viajes y el seguimiento GPS de tus traslados.' },
    { emoji: '📦', title: 'Tomar un viaje', desc: "En 'Mis Viajes' encontrás los manifiestos asignados a tu empresa." },
    { emoji: '📍', title: 'GPS en ruta', desc: 'La app registra tu recorrido automáticamente durante el traslado.' },
    { emoji: '⚠️', title: 'Reportar incidentes', desc: 'Reportá averías o pausas desde el botón de incidente en el viaje activo.' },
    { emoji: '✅', title: 'Confirmación de entrega', desc: 'Confirmá la entrega al llegar al operador para cerrar el traslado.' },
  ],
  OPERADOR: [
    { emoji: '🏗️', title: 'Sos Operador de Tratamiento', desc: 'SITREP te acompaña en la recepción y tratamiento de residuos peligrosos.' },
    { emoji: '📥', title: 'Recibir carga', desc: 'Confirmá la recepción y registrá el pesaje real al recibir los residuos.' },
    { emoji: '⚗️', title: 'Registrar tratamiento', desc: 'Registrá el método de tratamiento aplicado a cada corriente.' },
    { emoji: '📝', title: 'Cerrar manifiesto', desc: 'Cerrá el manifiesto una vez finalizado el tratamiento.' },
    { emoji: '🏅', title: 'Certificado de disposición', desc: 'Descargá el Certificado de Disposición Final para el generador.' },
  ],
  ADMIN_TRANSPORTISTA: [
    { emoji: '🛡️', title: 'Sos Administrador de Transportistas', desc: 'Gestionás el grupo de transportistas, vehículos y choferes.' },
    { emoji: '🚚', title: 'Gestión de transportistas', desc: 'Administrá el listado completo de transportistas y sus vehículos.' },
    { emoji: '📋', title: 'Manifiestos del grupo', desc: 'Visualizá todos los manifiestos relacionados con tus transportistas.' },
    { emoji: '📊', title: 'Reportes', desc: 'Accedé a los reportes y estadísticas de tu grupo.' },
  ],
  ADMIN_GENERADOR: [
    { emoji: '🛡️', title: 'Sos Administrador de Generadores', desc: 'Gestionás el grupo de generadores y el catálogo de residuos.' },
    { emoji: '🏭', title: 'Gestión de generadores', desc: 'Administrá el listado completo de generadores.' },
    { emoji: '📋', title: 'Manifiestos del grupo', desc: 'Visualizá todos los manifiestos relacionados con tus generadores.' },
    { emoji: '📊', title: 'Reportes', desc: 'Accedé a los reportes y estadísticas de tu grupo.' },
  ],
  ADMIN_OPERADOR: [
    { emoji: '🛡️', title: 'Sos Administrador de Operadores', desc: 'Gestionás el grupo de operadores y los tratamientos autorizados.' },
    { emoji: '🏗️', title: 'Gestión de operadores', desc: 'Administrá el listado completo de operadores de tratamiento.' },
    { emoji: '📋', title: 'Manifiestos del grupo', desc: 'Visualizá todos los manifiestos relacionados con tus operadores.' },
    { emoji: '📊', title: 'Reportes', desc: 'Accedé a los reportes y estadísticas de tu grupo.' },
  ],
  ADMIN: [
    { emoji: '⚙️', title: 'Sos Administrador General del Sistema', desc: 'Tenés acceso completo a todas las funciones de SITREP.' },
    { emoji: '👥', title: 'Gestión de usuarios', desc: 'Aprobá altas, gestioná roles y estados de cuenta de todos los usuarios.' },
    { emoji: '🏢', title: 'Gestión de actores', desc: 'Administrá generadores, transportistas y operadores del sistema.' },
    { emoji: '🎛️', title: 'Centro de Control', desc: 'Monitoreo LIVE de manifiestos en tránsito con mapa en tiempo real.' },
    { emoji: '📈', title: 'Reportes y auditoría', desc: 'Acceso completo a estadísticas, trazabilidad y logs de auditoría.' },
  ],
};

const ROL_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador', ADMIN_TRANSPORTISTA: 'Adm. Transportistas',
  ADMIN_GENERADOR: 'Adm. Generadores', ADMIN_OPERADOR: 'Adm. Operadores',
};

const ROL_COLORS: Record<string, string> = {
  ADMIN: 'bg-primary-500', GENERADOR: 'bg-purple-500', TRANSPORTISTA: 'bg-orange-500',
  OPERADOR: 'bg-blue-500', ADMIN_TRANSPORTISTA: 'bg-slate-500',
  ADMIN_GENERADOR: 'bg-green-600', ADMIN_OPERADOR: 'bg-teal-500',
};

interface Props {
  rol: UserRole;
  userId: string | number;
  onDismiss: () => void;
}

const OnboardingWizard: React.FC<Props> = ({ rol, userId, onDismiss }) => {
  const steps = STEPS_BY_ROLE[rol] ?? STEPS_BY_ROLE['GENERADOR'];
  const [current, setCurrent] = useState(0);

  const finish = () => {
    localStorage.setItem(`sitrep_onboarding_${userId}`, 'done');
    localStorage.removeItem('sitrep_post_reset');
    onDismiss();
  };

  const step = steps[current];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in-bounce">
        {/* Header */}
        <div className="bg-[#1B5E3C] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Leaf size={16} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">SITREP</span>
            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${ROL_COLORS[rol] || 'bg-neutral-500'} ml-1`}>
              {ROL_LABELS[rol] || rol}
            </span>
          </div>
          <button onClick={finish} className="text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-8 text-center min-h-[240px] flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">{step.emoji}</div>
          <h3 className="text-xl font-bold text-neutral-900 mb-3 leading-tight">{step.title}</h3>
          <p className="text-neutral-600 leading-relaxed">{step.desc}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
          {/* Dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-[#1B5E3C]' : 'w-2 h-2 bg-neutral-200 hover:bg-neutral-300'}`} />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {current > 0 && (
              <button onClick={() => setCurrent(c => c - 1)} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 px-3 py-1.5">
                <ChevronLeft size={16} /> Anterior
              </button>
            )}
            {current < steps.length - 1 ? (
              <button onClick={() => setCurrent(c => c + 1)} className="flex items-center gap-1 bg-[#1B5E3C] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#164D32] transition-colors">
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={finish} className="flex items-center gap-1 bg-[#1B5E3C] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#164D32] transition-colors">
                ¡Empezar! <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <div className="px-6 pb-4 text-center">
          <button onClick={finish} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            Saltar introducción
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;

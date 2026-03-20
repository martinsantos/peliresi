/**
 * WorkflowDiagram — Ciclo de vida del manifiesto (SVG animado)
 * =============================================================
 * Muestra los estados y transiciones del workflow de manifiestos
 * con colores semánticos y flechas animadas en hover.
 */

import React, { useState } from 'react';

interface State {
  id: string;
  label: string;
  color: string;
  textColor: string;
  description: string;
}

interface Transition {
  from: string;
  to: string;
  label: string;
  roles: string;
}

const STATES: State[] = [
  { id: 'BORRADOR',       label: 'Borrador',       color: '#F3F4F6', textColor: '#374151', description: 'Manifiesto creado, pendiente de firma' },
  { id: 'APROBADO',       label: 'Aprobado',        color: '#DBEAFE', textColor: '#1E40AF', description: 'Firmado por el generador, listo para retiro' },
  { id: 'EN_TRANSITO',    label: 'En Tránsito',     color: '#FFF7ED', textColor: '#9A3412', description: 'Transportista retiró el residuo, GPS activo' },
  { id: 'ENTREGADO',      label: 'Entregado',       color: '#FEF3C7', textColor: '#92400E', description: 'Llegó a la planta del operador' },
  { id: 'RECIBIDO',       label: 'Recibido',        color: '#D1FAE5', textColor: '#065F46', description: 'Operador confirmó recepción y pesaje' },
  { id: 'EN_TRATAMIENTO', label: 'En Tratamiento',  color: '#E0E7FF', textColor: '#3730A3', description: 'Proceso de tratamiento en curso' },
  { id: 'TRATADO',        label: 'Tratado',         color: '#A7F3D0', textColor: '#064E3B', description: 'Disposición final completa — certificado emitido' },
  { id: 'RECHAZADO',      label: 'Rechazado',       color: '#FEE2E2', textColor: '#991B1B', description: 'Operador rechazó la carga al recibirla' },
  { id: 'CANCELADO',      label: 'Cancelado',       color: '#F3F4F6', textColor: '#6B7280', description: 'Manifiesto cancelado antes del cierre' },
];

const TRANSITIONS: Transition[] = [
  { from: 'BORRADOR',       to: 'APROBADO',       label: 'Firmar',            roles: 'GENERADOR / ADMIN' },
  { from: 'APROBADO',       to: 'EN_TRANSITO',    label: 'Confirmar Retiro',  roles: 'TRANSPORTISTA / ADMIN' },
  { from: 'EN_TRANSITO',    to: 'ENTREGADO',      label: 'Confirmar Entrega', roles: 'TRANSPORTISTA / ADMIN' },
  { from: 'ENTREGADO',      to: 'RECIBIDO',       label: 'Confirmar Recepción', roles: 'OPERADOR / ADMIN' },
  { from: 'ENTREGADO',      to: 'RECHAZADO',      label: 'Rechazar Carga',    roles: 'OPERADOR / ADMIN' },
  { from: 'RECIBIDO',       to: 'EN_TRATAMIENTO', label: 'Registrar Tratamiento', roles: 'OPERADOR / ADMIN' },
  { from: 'EN_TRATAMIENTO', to: 'TRATADO',        label: 'Cerrar Manifiesto', roles: 'OPERADOR / ADMIN' },
  { from: 'RECIBIDO',       to: 'TRATADO',        label: 'Cerrar directo',    roles: 'OPERADOR / ADMIN' },
];

const stateById = Object.fromEntries(STATES.map(s => [s.id, s]));

const WorkflowDiagram: React.FC = () => {
  const [activeState, setActiveState] = useState<string | null>(null);

  const mainFlow = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];
  const sideStates = ['RECHAZADO', 'CANCELADO'];

  const getActiveTransitions = (stateId: string) =>
    TRANSITIONS.filter(t => t.from === stateId || t.to === stateId);

  const activeInfo = activeState ? stateById[activeState] : null;

  return (
    <div className="space-y-4">
      {/* Main flow */}
      <div className="flex flex-wrap items-center gap-2">
        {mainFlow.map((stateId, idx) => {
          const state = stateById[stateId];
          const isActive = activeState === stateId;
          const isRelated = activeState
            ? getActiveTransitions(activeState).some(t => t.from === stateId || t.to === stateId)
            : false;

          return (
            <React.Fragment key={stateId}>
              <button
                onClick={() => setActiveState(isActive ? null : stateId)}
                className={`
                  px-3 py-2 rounded-lg font-semibold text-sm border-2 transition-all duration-200
                  ${isActive ? 'scale-105 shadow-md border-current' : 'border-transparent hover:border-current hover:scale-102'}
                  ${!activeState || isActive || isRelated ? 'opacity-100' : 'opacity-40'}
                `}
                style={{ background: state.color, color: state.textColor }}
                title={state.description}
              >
                {state.label}
              </button>
              {idx < mainFlow.length - 1 && (
                <span className={`text-lg transition-colors ${isRelated || !activeState ? 'text-neutral-400' : 'text-neutral-200'}`}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Side states */}
      <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-dashed border-neutral-300">
        <span className="text-xs text-neutral-400 self-center mr-2">Estados alternos:</span>
        {sideStates.map(stateId => {
          const state = stateById[stateId];
          const isActive = activeState === stateId;
          const isRelated = activeState
            ? getActiveTransitions(activeState).some(t => t.from === stateId || t.to === stateId)
            : false;

          return (
            <button
              key={stateId}
              onClick={() => setActiveState(isActive ? null : stateId)}
              className={`
                px-3 py-1.5 rounded-lg font-semibold text-sm border-2 transition-all duration-200
                ${isActive ? 'scale-105 shadow-md border-current' : 'border-transparent hover:border-current'}
                ${!activeState || isActive || isRelated ? 'opacity-100' : 'opacity-40'}
              `}
              style={{ background: state.color, color: state.textColor }}
              title={state.description}
            >
              {state.label}
            </button>
          );
        })}
      </div>

      {/* Active state detail */}
      {activeInfo && (
        <div
          className="p-4 rounded-xl border-2 animate-fade-in"
          style={{ borderColor: activeInfo.textColor, background: activeInfo.color }}
        >
          <p className="font-semibold text-sm mb-1" style={{ color: activeInfo.textColor }}>
            {activeInfo.label}
          </p>
          <p className="text-sm text-neutral-700 mb-3">{activeInfo.description}</p>
          <div className="space-y-1">
            {getActiveTransitions(activeState!).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">
                  {t.from === activeState ? `→ ${stateById[t.to]?.label}` : `← ${stateById[t.from]?.label}`}
                </span>
                <span className="font-medium">{t.label}</span>
                <span className="text-neutral-400">({t.roles})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activeState && (
        <p className="text-xs text-neutral-400">Haz clic en un estado para ver sus transiciones</p>
      )}
    </div>
  );
};

export default WorkflowDiagram;

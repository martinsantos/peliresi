/** Declaraciones para revisión administrativa. No calcula ni determina una deuda fiscal. */

import React, { useState, useId } from 'react';
import { Calculator, MapPin, Building2, ShieldAlert, FlaskConical, Truck, ClipboardList, Eye, Wrench, Users, Award, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/CardV2';
import {
  DEFAULT_A, ZONAS, A_OPTIONS, A_LABELS,
  type CoeficientesA,
} from '../utils/calculoTEF';

export interface TEFInputs {
  zona: string;
  coefA: CoeficientesA;
  personal: number;
  potenciaHP: number;
  superficieM2: number;
}

/** Imperative handle to read current TEF state without re-render coupling */
export interface CalculadoraTEFHandle {
  getInputs: () => TEFInputs;
}

interface CalculadoraTEFProps {
  corrientesY: string[];
  tieneISO: boolean;
  onInputsChange?: (inputs: TEFInputs) => void;
  initialInputs?: TEFInputs | null;
  /** When true, renders expanded inline (wizard mode). When false, renders as collapsible card. */
  inline?: boolean;
}

// Icons for each A coefficient to make them more visual
const A_ICONS: Record<string, React.ElementType> = {
  a1_stock: FlaskConical,
  a2_almacenamiento: Building2,
  a3_peligrosidad: ShieldAlert,
  a4_tratabilidad: Wrench,
  a5_transporte: Truck,
  a6_contingencia: ClipboardList,
  a7_monitoreo: Eye,
  a8_instalMonitoreo: Eye,
  a9_instalGenerales: Building2,
  a10_idoneidad: Users,
};

// Descriptive help for each A coefficient
const A_HELP: Record<string, string> = {
  a1_stock: 'Cantidad de residuos peligrosos almacenados en planta al momento de la inspeccion.',
  a2_almacenamiento: 'Estado de los sitios donde se almacenan los residuos antes de su retiro.',
  a3_peligrosidad: 'Nivel de riesgo ante contingencias (derrames, incendios, explosiones).',
  a4_tratabilidad: 'Dificultad para tratar los residuos generados.',
  a5_transporte: 'Cuidados especiales necesarios para trasladar los residuos.',
  a6_contingencia: 'Calidad de los planes de contingencia ante emergencias ambientales.',
  a7_monitoreo: 'Calidad del plan de monitoreo ambiental de la empresa.',
  a8_instalMonitoreo: 'Estado de las instalaciones destinadas al monitoreo ambiental.',
  a9_instalGenerales: 'Estado general de las instalaciones de la empresa.',
  a10_idoneidad: 'Nivel de capacitacion y conciencia ambiental del personal.',
};

const CalculadoraTEF = React.forwardRef<CalculadoraTEFHandle, CalculadoraTEFProps>(({ corrientesY, tieneISO, onInputsChange, initialInputs, inline = false }, ref) => {
  const [zona, setZona] = useState(initialInputs?.zona || 'zona_rural');
  const [coefA, setCoefA] = useState<CoeficientesA>(initialInputs?.coefA ? { ...initialInputs.coefA } : { ...DEFAULT_A });
  const [personal, setPersonal] = useState(initialInputs?.personal || 0);
  const [potenciaHP, setPotenciaHP] = useState(initialInputs?.potenciaHP || 0);
  const [superficieM2, setSuperficieM2] = useState(initialInputs?.superficieM2 || 0);
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const helpId = useId();

  React.useImperativeHandle(ref, () => ({
    getInputs: () => ({ zona, coefA, personal, potenciaHP, superficieM2 }),
  }));
  const onInputsChangeRef = React.useRef(onInputsChange);
  onInputsChangeRef.current = onInputsChange;
  const inputsKey = `${zona}|${JSON.stringify(coefA)}|${personal}|${potenciaHP}|${superficieM2}`;
  React.useEffect(() => {
    onInputsChangeRef.current?.({ zona, coefA, personal, potenciaHP, superficieM2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsKey]);

  const updateA = (key: keyof CoeficientesA, val: number) =>
    setCoefA(prev => ({ ...prev, [key]: val }));

  const content = (
    <div className="space-y-6" data-testid="tef-calculator">
      <section aria-label="Estado de la evaluación TEF" className="space-y-2 rounded-xl border border-warning-300 bg-warning-50 p-4 text-neutral-900">
        <h4 className="font-semibold">Importe pendiente de liquidación</h4>
        <p className="text-sm leading-6">El cálculo está en revisión. Para controlar el pago, usá la liquidación oficial del concepto y período correspondientes.</p>
        <a className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-800 underline focus-visible:outline focus-visible:outline-2" href="https://atm.mendoza.gov.ar/normativas/ley-impositiva/" target="_blank" rel="noopener noreferrer">Consultar normativa en ATM (nueva pestaña)</a>
      </section>

      {/* === SECCION 1: COEFICIENTE ZONAL Z === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-blue-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Coeficiente Zonal o de Ubicacion (Z)</h4>
        </div>
        <p className="text-xs text-neutral-500">
          Mide la importancia de la ubicacion del emprendimiento en cuanto a su peligrosidad para el entorno.
          A mayor exposicion urbana, mayor coeficiente.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ZONAS.map(z => (
            <button
              key={z.id}
              type="button"
              aria-pressed={zona === z.id}
              onClick={() => setZona(z.id)}
              className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                zona === z.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <span className="text-lg font-bold font-mono">{z.valor}</span>
              <span className="text-[11px] font-medium text-center leading-tight">{z.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* === SECCION 2: MAGNITUD D === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-purple-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Coeficiente de Magnitud del Emprendimiento (D)</h4>
        </div>
        <p className="text-xs text-neutral-500">
          Se determina en funcion del personal, potencia instalada y superficie cubierta de la empresa,
          segun datos de la declaracion jurada anual.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Cantidad de Personal *</label>
            <p className="text-[10px] text-neutral-400">Empleados en planta</p>
            <input
              type="number" min={0} value={personal || ''}
              aria-label="Cantidad de Personal"
              onChange={e => setPersonal(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full min-h-11 px-3 rounded-xl border border-neutral-200 text-base sm:text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Potencia Instalada en HP *</label>
            <p className="text-[10px] text-neutral-400">Horse Power total</p>
            <input
              type="number" min={0} value={potenciaHP || ''}
              aria-label="Potencia Instalada en HP"
              onChange={e => setPotenciaHP(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full min-h-11 px-3 rounded-xl border border-neutral-200 text-base sm:text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Superficie Cubierta en M2 *</label>
            <p className="text-[10px] text-neutral-400">Metros cuadrados</p>
            <input
              type="number" min={0} value={superficieM2 || ''}
              aria-label="Superficie Cubierta en M2"
              onChange={e => setSuperficieM2(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full min-h-11 px-3 rounded-xl border border-neutral-200 text-base sm:text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
        </div>

      </div>

      {/* === SECCION 3: PELIGROSIDAD AMBIENTAL A === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
            Coeficiente de Peligrosidad Ambiental (A)
          </h4>

        </div>
        <p className="text-xs text-neutral-500">
          Tiene en cuenta las caracteristicas del emprendimiento (Art. 15 incisos c al j).
          Mejor gestion ambiental = menor valor. Se compone de 10 sub-coeficientes.
        </p>
        <div className="space-y-2">
          {(Object.keys(A_OPTIONS) as (keyof typeof A_OPTIONS)[]).map(key => {
            const Icon = A_ICONS[key] || ShieldAlert;
            const help = A_HELP[key];
            return (
              <div key={key} className="bg-white rounded-xl border border-neutral-200 p-3 hover:border-amber-300 transition-colors">
                <div className="flex items-start gap-2 mb-2">
                  <Icon size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-neutral-800 leading-snug">{A_LABELS[key]}</span>
                    <button
                      type="button"
                      aria-label={`Ayuda sobre ${A_LABELS[key]}`}
                      aria-expanded={showHelp === key}
                      aria-controls={`${helpId}-${key}`}
                      onClick={() => setShowHelp(showHelp === key ? null : key)}
                      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-amber-50 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
                    >
                      <HelpCircle size={18} />
                    </button>
                    </div>
                    <p id={`${helpId}-${key}`} hidden={showHelp !== key} className="mt-2 text-sm text-neutral-600">{help}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700 shrink-0">{coefA[key]}</span>
                </div>
                <select
                  aria-label={A_LABELS[key]}
                  value={coefA[key]}
                  onChange={e => updateA(key, Number(e.target.value))}
                  className="w-full min-h-11 px-3 rounded-lg border border-neutral-200 text-base sm:text-sm bg-neutral-50 focus:border-amber-500 focus:outline-none"
                >
                  {A_OPTIONS[key].map(opt => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.label.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <section className="space-y-2" aria-label="Declaraciones vinculadas">
        <h4 className="text-sm font-semibold text-neutral-900">Corrientes y certificación declaradas</h4>
        <p className="text-sm text-neutral-700">{corrientesY.length ? [...new Set(corrientesY)].join(', ') : 'Sin corrientes Y declaradas. Revisá la actividad del establecimiento.'}</p>
        <p className="flex items-center gap-2 text-sm text-neutral-700"><Award size={18} aria-hidden="true" />{tieneISO ? 'Certificación ISO 14000 declarada' : 'Sin certificación ISO 14000 declarada'}</p>
        <p className="text-sm leading-6 text-neutral-600">Estos datos no aplican un coeficiente fiscal automáticamente.</p>
      </section>
    </div>
  );

  // In inline mode (wizard), render content directly
  if (inline) return content;

  // In card mode (detail page), render as collapsible card
  return (
    <Card className="border-2 border-primary-200 bg-gradient-to-br from-primary-50/30 to-white">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-primary-600" />
            <h3 className="font-bold text-neutral-900">Datos para evaluación TEF</h3>
          </div>

        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
});

CalculadoraTEF.displayName = 'CalculadoraTEF';

export default CalculadoraTEF;

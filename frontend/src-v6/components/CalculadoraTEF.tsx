/**
 * Calculadora TEF - Decreto 2625/99
 * Formula: TEF = M x R x ISO
 * R = Z x A x D x C
 *
 * Version didactica: siempre visible, explicaciones claras por seccion.
 */

import React, { useState, useMemo } from 'react';
import { Calculator, MapPin, Building2, ShieldAlert, FlaskConical, Truck, ClipboardList, Eye, Wrench, Users, Award, Info, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/CardV2';
import {
  calcularTEF, DEFAULT_A, ZONAS, A_OPTIONS, A_LABELS, C_CORRIENTES, M_COEFICIENTE,
  type CoeficientesA, type TEFResult,
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
  getResult: () => TEFResult;
  getInputs: () => TEFInputs;
}

interface CalculadoraTEFProps {
  corrientesY: string[];
  tieneISO: boolean;
  onResultChange?: (result: TEFResult) => void;
  onInputsChange?: (inputs: TEFInputs) => void;
  initialInputs?: TEFInputs | null;
  /** When true, renders expanded inline (wizard mode). When false, renders as collapsible card. */
  inline?: boolean;
}

const fmtMoney = (v: number) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

const CalculadoraTEF = React.forwardRef<CalculadoraTEFHandle, CalculadoraTEFProps>(({ corrientesY, tieneISO, onResultChange, onInputsChange, initialInputs, inline = false }, ref) => {
  const [zona, setZona] = useState(initialInputs?.zona || 'zona_rural');
  const [coefA, setCoefA] = useState<CoeficientesA>(initialInputs?.coefA ? { ...initialInputs.coefA } : { ...DEFAULT_A });
  const [personal, setPersonal] = useState(initialInputs?.personal || 0);
  const [potenciaHP, setPotenciaHP] = useState(initialInputs?.potenciaHP || 0);
  const [superficieM2, setSuperficieM2] = useState(initialInputs?.superficieM2 || 0);
  const [showHelp, setShowHelp] = useState<string | null>(null);

  const result = useMemo(() => {
    return calcularTEF({
      zona, coeficientesA: coefA, personal, potenciaHP, superficieM2,
      corrientesY, tieneISO,
    });
  }, [zona, coefA, personal, potenciaHP, superficieM2, corrientesY, tieneISO]);

  // Imperative handle: parent reads values on demand (no render coupling)
  React.useImperativeHandle(ref, () => ({
    getResult: () => result,
    getInputs: () => ({ zona, coefA, personal, potenciaHP, superficieM2 }),
  }));

  // Legacy callback support for admin pages that pass onInputsChange/onResultChange
  // Guarded by stable string keys to prevent infinite loops
  const onResultChangeRef = React.useRef(onResultChange);
  const onInputsChangeRef = React.useRef(onInputsChange);
  onResultChangeRef.current = onResultChange;
  onInputsChangeRef.current = onInputsChange;
  const resultKey = `${result.TEF}|${result.R}`;
  const inputsKey = `${zona}|${personal}|${potenciaHP}|${superficieM2}`;
  const didMountRef = React.useRef(false);
  React.useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    onResultChangeRef.current?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);
  React.useEffect(() => {
    if (!didMountRef.current) return;
    onInputsChangeRef.current?.({ zona, coefA, personal, potenciaHP, superficieM2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsKey]);

  const updateA = (key: keyof CoeficientesA, val: number) =>
    setCoefA(prev => ({ ...prev, [key]: val }));

  const maxC = corrientesY.length > 0 ? Math.max(...corrientesY.map(y => C_CORRIENTES[y.trim()] || 0)) : 0;

  const content = (
    <div className="space-y-6">
      {/* === RESULTADO TEF === */}
      <div className="bg-neutral-900 rounded-2xl p-6 text-white shadow-xl">
        <p className="text-neutral-400 text-xs font-semibold uppercase tracking-widest">Tasa de Evaluacion y Fiscalizacion</p>
        <div className="flex items-end justify-between mt-2">
          <p className="text-5xl font-black font-mono tracking-tight text-white">{fmtMoney(result.TEF)}</p>
          <div className="text-right text-neutral-400 text-xs space-y-0.5">
            <p>TEF = M x R x ISO</p>
            <p className="font-mono text-neutral-300">{result.M} x {result.R.toFixed(4)} x {result.ISO}</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 mt-5">
          {[
            { label: 'Z', desc: 'Zona', value: result.Z.toFixed(2), bg: 'bg-blue-500/20 border-blue-500/30' },
            { label: 'A', desc: 'Ambiental', value: result.A.toFixed(2), bg: 'bg-amber-500/20 border-amber-500/30' },
            { label: 'D', desc: 'Magnitud', value: result.D.toFixed(3), bg: 'bg-purple-500/20 border-purple-500/30' },
            { label: 'C', desc: 'Residuo', value: result.C.toFixed(1), bg: 'bg-red-500/20 border-red-500/30' },
            { label: 'R', desc: 'Riesgo', value: result.R.toFixed(2), bg: 'bg-white/10 border-white/20' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-2.5 text-center border ${item.bg}`}>
              <p className="text-[10px] text-neutral-400 font-medium">{item.desc}</p>
              <p className="text-lg font-bold font-mono text-white">{item.value}</p>
              <p className="text-[9px] text-neutral-500 font-mono">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

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
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Cantidad de Personal *</label>
            <p className="text-[10px] text-neutral-400">Empleados en planta</p>
            <input
              type="number" min={0} value={personal || ''}
              onChange={e => setPersonal(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Potencia Instalada en HP *</label>
            <p className="text-[10px] text-neutral-400">Horse Power total</p>
            <input
              type="number" min={0} value={potenciaHP || ''}
              onChange={e => setPotenciaHP(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">Superficie Cubierta en M2 *</label>
            <p className="text-[10px] text-neutral-400">Metros cuadrados</p>
            <input
              type="number" min={0} value={superficieM2 || ''}
              onChange={e => setSuperficieM2(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm focus:border-purple-500 focus:outline-none font-mono text-center"
            />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg px-3 py-2 text-xs text-purple-700 font-mono">
          D = 0.15 x ({personal} + {potenciaHP}) + 0.005 x {superficieM2} = <strong>{result.D.toFixed(3)}</strong>
        </div>
      </div>

      {/* === SECCION 3: PELIGROSIDAD AMBIENTAL A === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
            Coeficiente de Peligrosidad Ambiental (A)
          </h4>
          <span className="text-xs text-neutral-400 font-mono ml-auto">Sumatoria: {result.A.toFixed(3)}</span>
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
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-neutral-800 uppercase leading-tight">{A_LABELS[key]}</span>
                    <button
                      onClick={() => setShowHelp(showHelp === key ? null : key)}
                      className="text-neutral-300 hover:text-amber-600 ml-1 align-middle"
                    >
                      <HelpCircle size={11} />
                    </button>
                    {showHelp === key && (
                      <p className="text-[10px] text-neutral-500 mt-0.5">{help}</p>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700 shrink-0">{coefA[key]}</span>
                </div>
                <select
                  value={coefA[key]}
                  onChange={e => updateA(key, Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:border-amber-500 focus:outline-none"
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

      {/* === SECCION 4: COEFICIENTE C === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-red-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
            Coeficiente de Peligrosidad del Residuo (C)
          </h4>
          <span className="text-xs text-neutral-400 font-mono ml-auto">Max: {maxC}</span>
        </div>
        <p className="text-xs text-neutral-500">
          Se determina por el tipo de residuos peligrosos generado. Se toma el valor maximo
          entre todas las corrientes Y inscriptas por el generador.
        </p>
        {corrientesY.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {corrientesY.map(y => {
              const cVal = C_CORRIENTES[y.trim()] || 0;
              const isMax = cVal === maxC && maxC > 0;
              return (
                <div
                  key={y}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    isMax
                      ? 'bg-red-50 border-red-300 shadow-sm'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <span className={`text-xs font-bold ${isMax ? 'text-red-700' : 'text-neutral-600'}`}>{y.trim()}</span>
                  <span className={`text-sm font-mono font-bold ${isMax ? 'text-red-800' : 'text-neutral-500'}`}>{cVal}</span>
                  {isMax && <span className="text-[9px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-bold">MAX</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-400 text-center">
            Seleccione corrientes Y en el Paso 3 para calcular el coeficiente C
          </div>
        )}
      </div>

      {/* === SECCION 5: ISO === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-green-600" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Norma ISO 14000</h4>
        </div>
        <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
          tieneISO ? 'border-green-300 bg-green-50' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            tieneISO ? 'bg-green-600 text-white' : 'bg-neutral-300 text-white'
          }`}>
            {result.ISO}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {tieneISO ? 'Posee certificacion ISO 14000 — Factor x2' : 'No posee certificacion ISO 14000 — Factor x1'}
            </p>
            <p className="text-[10px] text-neutral-500">
              {tieneISO
                ? 'El factor ISO duplica la TEF como incentivo a mantener la certificacion.'
                : 'Para indicar ISO, complete la fecha de certificacion en Datos Regulatorios (Paso 5).'}
            </p>
          </div>
        </div>
      </div>

      {/* === FORMULA DESGLOSADA === */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-blue-800">
          <Info size={16} />
          <p className="text-sm font-bold">Desglose del Calculo</p>
        </div>
        <div className="text-xs text-blue-700 font-mono space-y-1">
          <p>R = Z x A x D x C = {result.Z} x {result.A.toFixed(3)} x {result.D.toFixed(3)} x {result.C} = <strong>{result.R.toFixed(4)}</strong></p>
          <p>TEF = M x R x ISO = {result.M} x {result.R.toFixed(4)} x {result.ISO} = <strong>{result.TEF.toFixed(2)}</strong></p>
        </div>
        <p className="text-[10px] text-blue-600 mt-2">
          M = {M_COEFICIENTE} (coeficiente anual fijado por la Autoridad de Aplicacion para 2026)
        </p>
      </div>
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
            <h3 className="font-bold text-neutral-900">Calculadora TEF</h3>
            <span className="text-xs text-neutral-500">Decreto 2625/99</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-700 font-mono">{fmtMoney(result.TEF)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
});

CalculadoraTEF.displayName = 'CalculadoraTEF';

export default CalculadoraTEF;

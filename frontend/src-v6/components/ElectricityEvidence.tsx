import { AlertTriangle, Zap } from 'lucide-react';
import type { ElectricityReading } from '../types/documentAnalysis';
const labels = { categoriaTarifaria: 'Categoría tarifaria', consumoKwh: 'Consumo facturado', potenciaContratadaKw: 'Potencia contratada', potenciaRegistradaKw: 'Potencia registrada', suministro: 'Suministro', periodo: 'Período', nivelSubsidio: 'Nivel de subsidio' };
export function ElectricityEvidence({ reading }: { reading: ElectricityReading }) {
  const supplyLabel = reading.distribuidora === 'EDESTE' ? 'Suministro · Ruta y Folio' : labels.suministro;
  return <section aria-label="Lectura de factura eléctrica" className="rounded-lg border border-primary-200 bg-primary-50/60 p-3">
    <div className="flex items-start gap-2 text-primary-900"><Zap size={19} aria-hidden="true" className="mt-0.5 shrink-0" /><div className="min-w-0"><p className="font-semibold">Factura eléctrica</p><p className="break-words text-sm">{reading.nombreDistribuidora || 'Distribuidora sin identificar: revisar original'}</p></div></div>
    <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3">
      {Object.entries(labels).map(([key, label]) => { const value = reading.campos[key as keyof typeof labels]; const unit = key === 'consumoKwh' ? ' kWh' : key.endsWith('Kw') ? ' kW' : ''; return <div key={key} className="min-w-0"><dt className="text-xs text-neutral-700">{key === 'suministro' ? supplyLabel : label}</dt><dd className="break-words text-sm font-semibold text-neutral-900">{reading.conflictos.includes(key) ? 'Lecturas distintas: revisar original' : value ? value + unit : 'No leído'}</dd></div>; })}
    </dl>
    {reading.distribuidora === 'EDESTE' && !reading.campos.suministro && <p className="mt-3 text-sm text-neutral-700">Revisá Ruta y Folio en el frente de la factura de EDESTE. Los dos datos identifican el suministro; el número de factura no los reemplaza.</p>}
    {reading.conflictos.length > 0 && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-amber-950"><AlertTriangle size={17} aria-hidden="true" className="shrink-0" />Hay datos contradictorios; revisá el original. No se eligió un valor automáticamente.</p>}
    <p className="mt-3 text-sm leading-6 text-neutral-700">{reading.aviso}</p>
    {reading.evidencias.length > 0 && <details className="mt-2 text-sm text-primary-900"><summary className="min-h-11 cursor-pointer font-semibold">Ver de dónde sale cada dato</summary><ul className="space-y-1 break-words text-neutral-800">{reading.evidencias.map((item, index) => <li key={index}>{labels[item.campo as keyof typeof labels] || item.campo}: {item.texto}</li>)}</ul></details>}
  </section>;
}

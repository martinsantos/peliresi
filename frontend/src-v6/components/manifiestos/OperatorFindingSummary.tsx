import React from 'react';
import { FileSearch, Scale, FlaskConical } from 'lucide-react';
import type { OperatorFinding } from '../../types/inspectionIntake';
import { INTAKE_REASON_LABELS } from '../../types/inspectionIntake';

export function OperatorFindingSummary({ finding }: { finding: OperatorFinding }) {
  return <section aria-label="Informe de hallazgo" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
    <h3 className="flex items-center gap-2 font-semibold text-neutral-950"><FileSearch size={20} className="shrink-0 text-amber-800" />Informe de hallazgo del operador</h3>
    <ul className="divide-y divide-amber-200/60">{finding.diferencias.map((row, i) => <li key={i} className="flex gap-2 py-2 text-sm">
      {row.tipo === 'Y_OMITIDA' ? <FlaskConical size={18} className="shrink-0 text-amber-800" /> : <Scale size={18} className="shrink-0 text-amber-800" />}
      <div className="min-w-0"><p className="font-semibold">{row.corriente} · {INTAKE_REASON_LABELS[row.tipo] || row.tipo}</p>
        <p className="text-neutral-700">Declarado: {['Y_OMITIDA', 'UNIDAD_DIFERENTE'].includes(row.tipo) ? 'sin dato en esta unidad' : `${row.declarado} ${row.unidad}`} · Observado: {row.tipo === 'NO_OBSERVADA' ? 'no informado' : `${row.observado} ${row.unidad}`}</p></div>
    </li>)}</ul>
    {!finding.diferencias.length && <p className="text-sm text-neutral-700">Sin diferencias medibles respecto de la declaración.</p>}
    <div className="border-t border-amber-200 pt-2 text-sm"><p className="font-semibold">Ficha del operador</p><p className="text-neutral-700">{finding.alcanceOperador.valorOriginal || 'Sin corrientes verificables: requiere revisión de la ficha.'}</p>
      {finding.alcanceOperador.corrientesNoRegistradas.length > 0 && <p className="mt-1 font-semibold text-amber-950">No constan en esa ficha: {finding.alcanceOperador.corrientesNoRegistradas.join(', ')}</p>}
    </div>
    <p className="text-xs text-neutral-600">Antecedente para evaluar en PSIP. No acredita infracción ni modifica la declaración o la habilitación.</p>
  </section>;
}

import React from 'react';
import { approvalSummary } from '../utils/manifestWork';
import { Factory, Truck, FlaskConical } from 'lucide-react';
export type PartyApproval = { rol: string; aprobada: boolean };
const actors = [{ rol: 'GENERADOR', name: 'Generador', Icon: Factory }, { rol: 'TRANSPORTISTA', name: 'Transporte', Icon: Truck }, { rol: 'OPERADOR', name: 'Operador', Icon: FlaskConical }];
export function PartyApprovalStatus({ partes, compact = false, showSummary = false }: { partes: PartyApproval[]; compact?: boolean; showSummary?: boolean }) {
  const linkedActors=actors.filter(actor=>partes.some(p=>p.rol===actor.rol));
  return <div><ul aria-label="Aprobaciones" className={compact ? 'flex shrink-0 gap-1.5' : `grid ${linkedActors.length===2?'grid-cols-2':'grid-cols-3'} gap-2`}>
    {linkedActors.map(({ rol, name, Icon }) => {
      const approved = partes.some(p => p.rol === rol && p.aprobada);
      const label = `${name}: ${approved ? 'Aprobado' : 'Pendiente'}`;
      return <li key={rol} aria-label={label} title={label} className={`relative rounded-lg border ${approved ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-neutral-100 text-neutral-600'} ${compact ? 'p-1.5' : 'p-2 text-center'}`}>
        <Icon aria-hidden="true" size={compact ? 17 : 22} className="mx-auto"/>
        {!compact && <><span className="mt-1 block text-xs font-semibold">{name}</span><span className="mt-1 block text-xs">{approved ? 'Aprobado' : 'Pendiente'}</span></>}
      </li>;
    })}
  </ul>{compact && showSummary && <span className="mt-1 block text-center text-xs text-neutral-600" aria-label={approvalSummary(partes)}>{partes.filter(p=>p.aprobada).length}/{partes.length} aprob.</span>}</div>;
}

import React from 'react';
import { Check, Clock, Factory, Truck, FlaskConical } from 'lucide-react';
export type PartyApproval = { rol: string; aprobada: boolean };
const actors = [{ rol: 'GENERADOR', name: 'Generador', Icon: Factory }, { rol: 'TRANSPORTISTA', name: 'Transporte', Icon: Truck }, { rol: 'OPERADOR', name: 'Operador', Icon: FlaskConical }];
export function PartyApprovalStatus({ partes, compact = false }: { partes: PartyApproval[]; compact?: boolean }) {
  return <ul aria-label="Aprobaciones" className={compact ? 'flex shrink-0 gap-1.5' : 'grid grid-cols-3 gap-2'}>
    {actors.map(({ rol, name, Icon }) => {
      const approved = partes.some(p => p.rol === rol && p.aprobada);
      const label = `${name}: ${approved ? 'Aprobado' : 'Pendiente'}`;
      return <li key={rol} aria-label={label} title={label} className={`relative rounded-lg border ${approved ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-neutral-100 text-neutral-600'} ${compact ? 'p-1.5' : 'p-2 text-center'}`}>
        <Icon aria-hidden="true" size={compact ? 17 : 22} className="mx-auto"/>
        {!compact && <><span className="mt-1 block text-xs font-semibold">{name}</span><span className="mt-1 flex items-center justify-center gap-1 text-xs">{approved ? <Check size={12}/> : <Clock size={12}/>} {approved ? 'Aprobado' : 'Pendiente'}</span></>}
      </li>;
    })}
  </ul>;
}

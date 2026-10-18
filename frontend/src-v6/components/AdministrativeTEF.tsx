import React from 'react';
import { Calculator, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tefDeclaredInputs } from '../utils/tefDeclaredInputs';
import CalculadoraTEF from './CalculadoraTEF';

interface AdministrativeTEFProps {
  actorType: string;
  identity: string;
  declaration: unknown;
  corrientesY: string[];
  tieneISO: boolean;
}

/** A local administrative evaluation, not an applicant invoice or payment approval. */
export function AdministrativeTEF({ actorType, identity, declaration, corrientesY, tieneISO }: AdministrativeTEFProps) {
  const { currentUser } = useAuth();
  if (!currentUser || !['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'].includes(currentUser.rol) || !['GENERADOR', 'OPERADOR'].includes(actorType)) return null;
  const { inputs, missing } = tefDeclaredInputs(declaration);
  return (
    <details className="group rounded-xl border border-neutral-200 bg-white" data-testid="tef-admin-review">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700">
        <Calculator size={18} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">Evaluación TEF · Administración</span><ChevronDown size={18} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-neutral-200 p-4 sm:p-5">
        <p className="text-sm leading-6 text-neutral-700">Evaluación administrativa con los datos declarados. Los cambios de esta calculadora son una simulación: no guardan un importe, no emiten una liquidación y no validan el pago de un recibo.</p>
        {missing.length > 0 && <p className="text-sm leading-6 text-amber-800">Datos no declarados: {missing.join(', ')}. Completalos y revisá los coeficientes antes de usar el resultado; no es una tasa determinada.</p>}
        <CalculadoraTEF key={identity} corrientesY={corrientesY} tieneISO={tieneISO} initialInputs={inputs} inline />
      </div>
    </details>
  );
}

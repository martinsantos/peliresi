import React, { useState } from 'react';
import { Calculator, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tefDeclaredInputs } from '../utils/tefDeclaredInputs';
import CalculadoraTEF from './CalculadoraTEF';
import { Button } from './ui/ButtonV2';

interface AdministrativeTEFProps {
  actorType: string;
  identity: string;
  declaration: unknown;
  corrientesY: string[];
  tieneISO: boolean;
}

/** A local administrative evaluation, not an applicant invoice or payment approval. */
export function AdministrativeTEF(props: AdministrativeTEFProps) {
  const { currentUser } = useAuth();
  if (!currentUser || !['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'].includes(currentUser.rol) || !['GENERADOR', 'OPERADOR'].includes(props.actorType)) return null;
  return <AdministrativeEvaluation key={[currentUser.id, currentUser.rol, props.actorType, props.identity].join(':')} {...props} />;
}

function AdministrativeEvaluation({ declaration, corrientesY, tieneISO }: AdministrativeTEFProps) {
  const source = { ...tefDeclaredInputs(declaration), corrientesY: [...new Set(corrientesY)].sort(), tieneISO };
  const sourceKey = JSON.stringify(source);
  const [loaded, setLoaded] = useState(() => ({ source, key: sourceKey, revision: 0 }));
  const [acknowledged, setAcknowledged] = useState(sourceKey);
  const previous = loaded.key !== sourceKey, changed = previous && acknowledged !== sourceKey;
  const loadCurrent = () => { setLoaded({ source, key: sourceKey, revision: loaded.revision + 1 }); setAcknowledged(sourceKey); };
  const { inputs, missing } = loaded.source;
  return (
    <details className="group rounded-xl border border-neutral-200 bg-white" data-testid="tef-admin-review">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700">
        <Calculator size={18} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">Evaluación TEF · Administración{changed && <span className="block text-xs font-normal">Declaración actualizada · revisar simulación</span>}</span><ChevronDown size={18} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-neutral-200 p-4 sm:p-5">
        <p className="text-sm leading-6 text-neutral-700">Evaluación administrativa con los datos declarados. Los cambios de esta calculadora son una simulación: no guardan un importe, no emiten una liquidación y no validan el pago de un recibo.</p>
        <p className="text-sm leading-6 text-neutral-700">Si se adjuntó factura eléctrica, revisá su lectura en Documentos. La categoría tarifaria y los kWh no determinan por sí solos la potencia instalada en HP ni cambian estos valores.</p>
        <p className="text-sm leading-6 text-amber-900">Fórmula y parámetros de la simulación pendientes de conciliación con la normativa vigente. Para controlar el comprobante, usá la liquidación correspondiente emitida por la autoridad.</p>
        {changed && <div role="alert" className="space-y-3 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-neutral-900">
          <p><strong>La declaración cambió.</strong> Tu simulación sigue aquí. Elegí qué datos usar antes de continuar.</p>
          <div className="flex flex-wrap gap-2"><Button onClick={loadCurrent}>Usar declaración actualizada</Button><Button variant="outline" onClick={() => setAcknowledged(sourceKey)}>Conservar mi simulación</Button></div>
        </div>}
        {previous && !changed && <div role="status" className="space-y-2 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-neutral-900">
          <p>Simulación basada en la declaración anterior. No representa los datos actuales del trámite.</p>
          <Button variant="outline" onClick={loadCurrent}>Usar declaración actualizada</Button>
        </div>}
        {missing.length > 0 && <p className="text-sm leading-6 text-amber-800">Datos no declarados: {missing.join(', ')}. Completalos y revisá los coeficientes antes de usar el resultado; no es una tasa determinada.</p>}
        <fieldset disabled={changed} className="min-w-0"><CalculadoraTEF key={loaded.revision} corrientesY={loaded.source.corrientesY} tieneISO={loaded.source.tieneISO} initialInputs={inputs} inline /></fieldset>
      </div>
    </details>
  );
}

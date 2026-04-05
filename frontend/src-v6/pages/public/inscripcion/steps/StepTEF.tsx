/**
 * Step TEF — TEF Calculator step (wraps CalculadoraTEF)
 */
import React, { useMemo, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Calculator } from 'lucide-react';
import CalculadoraTEF, { type TEFInputs, type CalculadoraTEFHandle } from '../../../../components/CalculadoraTEF';
import { SectionTitle } from '../SectionTitle';

export interface StepTEFHandle {
  /** Snapshot TEF values into the returned record */
  snapshotTEF: () => Record<string, string>;
}

interface StepTEFProps {
  form: Record<string, string>;
  isGenerador: boolean;
  isOperador: boolean;
}

export const StepTEF = forwardRef<StepTEFHandle, StepTEFProps>(({
  form,
  isGenerador,
}, ref) => {
  const tefRef = useRef<CalculadoraTEFHandle>(null);

  // Parse corrientesY list from form
  const tefCorrientesRaw = isGenerador ? form.corrientesControl : form.corrientesY;
  const tefCorrientesYList = useMemo(() =>
    (tefCorrientesRaw || '').split(/[,;/]/).map(s => s.trim()).filter(s => /^Y\d+$/i.test(s)),
    [tefCorrientesRaw],
  );
  const tefTieneISO = !!form.certificacionISO;
  const tefInitialInputs = useMemo<TEFInputs | null>(() => {
    if (!form.tefInputs) return null;
    try { return JSON.parse(form.tefInputs); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount -- after that CalculadoraTEF owns its state

  // Expose snapshot method to parent via ref
  const snapshotTEF = useCallback((): Record<string, string> => {
    if (!tefRef.current) return {};
    const r = tefRef.current.getResult();
    const inputs = tefRef.current.getInputs();
    return {
      factorR: r.R.toFixed(4),
      montoMxR: r.TEF.toFixed(2),
      tefInputs: JSON.stringify(inputs),
      tefPersonal: String(inputs.personal),
      tefSuperficie: String(inputs.superficieM2),
      tefPotencia: String(inputs.potenciaHP),
      tefZona: inputs.zona,
    };
  }, []);

  useImperativeHandle(ref, () => ({ snapshotTEF }), [snapshotTEF]);

  return (
    <div className="space-y-4">
      <SectionTitle icon={Calculator} title="Calculo TEF (Tasa por Evaluacion Fiscal)" />
      <p className="text-sm text-neutral-500">
        Calculadora completa segun Decreto 2625/99. Complete los coeficientes para obtener la tasa.
        {tefCorrientesYList.length === 0 && (
          <span className="block mt-1 text-amber-600 font-medium">
            Ingrese corrientes Y en el paso anterior para calcular el coeficiente C.
          </span>
        )}
      </p>
      <CalculadoraTEF
        ref={tefRef}
        corrientesY={tefCorrientesYList}
        tieneISO={tefTieneISO}
        inline={true}
        initialInputs={tefInitialInputs}
      />
    </div>
  );
});

StepTEF.displayName = 'StepTEF';

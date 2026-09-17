/**
 * Step TEF — TEF Calculator step (wraps CalculadoraTEF)
 */
import React, { useMemo, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import CalculadoraTEF, { type TEFInputs, type CalculadoraTEFHandle } from '../../../../components/CalculadoraTEF';
import { C_CORRIENTES } from '../../../../utils/calculoTEF';
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
  const tefCorrientesYList = useMemo(() => Array.from(new Set(
    (tefCorrientesRaw || '')
      .split(/[,;/]/)
      .map(s => s.trim().toUpperCase())
      .filter(s => /^Y\d+$/.test(s)),
  )), [tefCorrientesRaw]);
  const corrientesSinCoeficiente = useMemo(
    () => tefCorrientesYList.filter(corriente => C_CORRIENTES[corriente] == null),
    [tefCorrientesYList],
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
    const inputs = tefRef.current.getInputs();
    return {
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
      <SectionTitle icon={Calculator} title="Calculo TEF (Tasa de Evaluacion y Fiscalizacion)" />
      <p className="text-sm text-neutral-500">
        Cargue las variables declarativas del TEF. El importe no se calcula ni se muestra durante el alta; la liquidación final se realiza por DGFA con la regla vigente.
        {tefCorrientesYList.length === 0 && (
          <span className="block mt-1 text-amber-600 font-medium">
            Ingrese corrientes Y en el paso anterior para calcular el coeficiente C.
          </span>
        )}
      </p>
      {corrientesSinCoeficiente.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Sin coeficiente TEF configurado para: <strong>{corrientesSinCoeficiente.join(', ')}</strong>.
            Estas corrientes no aportan al coeficiente C; revise el codigo o consulte a la DGFA.
          </p>
        </div>
      )}
      <CalculadoraTEF
        ref={tefRef}
        corrientesY={tefCorrientesYList}
        tieneISO={tefTieneISO}
        inline={true}
        initialInputs={tefInitialInputs}
        deferred
      />
    </div>
  );
});

StepTEF.displayName = 'StepTEF';

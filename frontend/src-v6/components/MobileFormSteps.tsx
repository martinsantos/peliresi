import { useId } from 'react';

interface MobileFormStepsProps {
  steps: ReadonlyArray<{ id: number; label: string }>;
  currentStep: number;
  onSelect: (step: number) => void;
  compact?: boolean;
}

/** A compact mobile alternative to wide desktop steppers. The owning form
 * retains validation and the selected step; this control never advances itself. */
export function MobileFormSteps({ steps, currentStep, onSelect, compact = false }: MobileFormStepsProps) {
  const id = useId();
  return <div className={compact ? 'flex items-center gap-2 md:hidden' : 'space-y-2 md:hidden'}>
    <label htmlFor={id} className={compact ? 'shrink-0 text-xs font-semibold text-neutral-700' : 'block text-sm font-semibold text-neutral-700'}>
      {compact ? `Paso ${currentStep}/${steps.length}` : `Paso ${currentStep} de ${steps.length}`}
    </label>
    <select
      id={id}
      aria-label="Paso del registro"
      value={currentStep}
      onChange={event => onSelect(Number(event.target.value))}
      className={`min-h-11 ${compact ? 'min-w-0 flex-1' : 'w-full'} rounded-lg border border-neutral-400 bg-white px-3 text-sm font-medium text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700`}
    >
      {steps.map(step => <option key={step.id} value={step.id}>{step.id}. {step.label}</option>)}
    </select>
  </div>;
}

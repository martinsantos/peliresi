import React from 'react';
import { Skeleton } from './Skeleton';

// Same geometry as the approved favicon, without its square background.
export const SITREP_CYCLE_PATH = 'M36.319 12.412A40 40 0 0 1 80.642 24.288L86.77 19.146L83.483 44.096L65.321 37.144L71.449 32.002A28 28 0 0 0 40.423 23.689Z';

/** Decorative inside an already-labelled busy button; otherwise use LoadingIndicator. */
export function BrandSpinner({ size = 24 }: { size?: number }) {
  return <span aria-hidden="true" className="sitrep-spinner inline-flex shrink-0" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" fill="currentColor" width={size} height={size} focusable="false" data-sitrep-cycle="">
      {[0, 120, 240].map(angle => <path key={angle} d={SITREP_CYCLE_PATH} transform={`rotate(${angle} 50 50)`} />)}
    </svg>
  </span>;
}

export function LoadingIndicator({ label = 'Cargando…', size = 24 }: { label?: string; size?: number }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-neutral-600">
    <span className="text-primary-700"><BrandSpinner size={size} /></span><span>{label}</span>
  </div>;
}

/** Only for an initial fetch. Never replace editable or already-loaded fields on refresh. */
export function FormSkeleton({ label = 'Cargando datos…', fields = 6 }: { label?: string; fields?: number }) {
  return <section aria-busy="true" aria-label={label} data-form-skeleton="" className="space-y-5">
    <LoadingIndicator label={label} />
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
      <Skeleton width="42%" height={24} className="mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {Array.from({ length: fields }, (_, index) => <div key={index} className="space-y-2">
          <Skeleton width={index % 2 ? '36%' : '48%'} height={14} />
          <Skeleton height={44} />
        </div>)}
      </div>
    </div>
  </section>;
}

export function PageLoader() {
  return <div className="min-h-[60vh] flex items-center justify-center bg-neutral-50 p-6">
    <LoadingIndicator label="Cargando SITREP…" size={40} />
  </div>;
}

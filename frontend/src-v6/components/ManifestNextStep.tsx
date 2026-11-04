import React from 'react';
import { manifestWork, type ManifestWork } from '../utils/manifestWork';

/** One shared explanation of responsibility; it never grants a business action. */
export function ManifestNextStep({ work, role, showLabel = true }: { work: ManifestWork; role: string; showLabel?: boolean }) {
  const next = manifestWork(work, role);
  return <div className="space-y-1 text-sm" aria-label="Próximo paso del manifiesto">
    {showLabel && <p className="font-semibold text-neutral-900">{next.label}</p>}
    <p className="text-neutral-700"><span className="font-medium">{next.tone === 'done' ? 'Disponible para' : 'Le toca a'}:</span> {next.responsible}</p>
    <details className="text-neutral-600">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg font-medium text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">Cómo continuar</summary>
      <p className="pb-2 leading-relaxed">{next.detail}</p>
    </details>
  </div>;
}

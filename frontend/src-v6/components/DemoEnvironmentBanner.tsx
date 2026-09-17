import React from 'react';
import { FlaskConical } from 'lucide-react';

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const DemoEnvironmentBanner: React.FC = () => {
  if (!demoMode) return null;

  return (
    <div
      role="status"
      data-testid="demo-environment-banner"
      className="flex min-h-9 shrink-0 items-center justify-center gap-2 bg-amber-300 px-3 py-2 text-center text-xs font-extrabold tracking-wide text-amber-950 sm:text-sm"
    >
      <FlaskConical size={16} aria-hidden="true" />
      ENTORNO DE PRUEBA · DATOS SINTÉTICOS · NO USAR COMO INFORMACIÓN OFICIAL
    </div>
  );
};

import React from 'react';
import { GraduationCap } from 'lucide-react';
import type { User } from '../contexts/AuthContext';

/** Direct classroom sessions have no operational administrator to return to. */
export function TrainingBanner({ user }: { user: User }) {
  return <div role="status" aria-label="Modo capacitación" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950">
    <GraduationCap size={18} className="shrink-0" aria-hidden="true" />
    <span className="min-w-0"><span className="block">Capacitación · sin validez oficial</span><span className="block text-xs font-medium">{user.nombre}</span></span>
  </div>;
}

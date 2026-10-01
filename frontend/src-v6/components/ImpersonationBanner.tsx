import React from 'react';
import { Eye, ArrowLeft } from 'lucide-react';
import type { User } from '../contexts/AuthContext';

const ROL_LABELS: Record<string, string> = {
  ADMIN: 'Super Administrador',
  ADMIN_GENERADOR: 'Admin de Generadores',
  ADMIN_TRANSPORTISTA: 'Admin de Transporte',
  ADMIN_OPERADOR: 'Admin de Operadores',
  GENERADOR: 'Generador',
  TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador',
};

interface ImpersonationBannerProps {
  user: User;
  onExit: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ user, onExit }) => {
  const rolLabel = ROL_LABELS[user.rol] || user.rol;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex min-h-12 items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-1 text-amber-950">
      <div className="flex min-w-0 items-center gap-2">
        <Eye size={18} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 text-sm font-semibold">
          Vista temporal · <strong>{user.nombre}</strong>
          <span className="ml-1 font-normal">({rolLabel})</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-amber-700 bg-white px-3 text-sm font-bold text-amber-950 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-900"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a mi cuenta
      </button>
    </div>
  );
};

export default ImpersonationBanner;

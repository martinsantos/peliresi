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
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 bg-amber-500 text-white px-2 sm:px-4 flex items-center justify-between gap-2 shadow-lg" data-testid="impersonation-banner">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Eye size={16} className="shrink-0" />
        <span className="min-w-0 truncate text-xs sm:text-sm font-medium">
          <span className="hidden sm:inline">Acceso Comodín — viendo como: </span>
          <span className="sm:hidden">Viendo: </span>
          <strong>{user.nombre}</strong>
          <span className="ml-1 opacity-80 hidden sm:inline">({rolLabel})</span>
        </span>
      </div>
      <button
        onClick={onExit}
        data-testid="exit-impersonation"
        className="flex h-7 items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 sm:px-3 rounded-full font-semibold transition-colors shrink-0"
      >
        <ArrowLeft size={12} />
        <span className="hidden sm:inline">Volver a mi cuenta</span>
        <span className="sm:hidden">Volver</span>
      </button>
    </div>
  );
};

export default ImpersonationBanner;

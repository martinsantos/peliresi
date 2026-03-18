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
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <Eye size={16} className="shrink-0" />
        <span className="text-sm font-medium">
          Acceso Comodín — viendo como: <strong>{user.nombre}</strong>
          <span className="ml-1 opacity-80">({rolLabel})</span>
        </span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-semibold transition-colors shrink-0"
      >
        <ArrowLeft size={12} />
        Volver a mi cuenta
      </button>
    </div>
  );
};

export default ImpersonationBanner;

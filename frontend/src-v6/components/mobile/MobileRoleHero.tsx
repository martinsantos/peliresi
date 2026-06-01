import React from 'react';
import { ClipboardCheck, FlaskConical, Shield, Truck } from 'lucide-react';
import { Badge } from '../ui/BadgeV2';
import { Card, CardContent } from '../ui/CardV2';

type MobileRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | string;

interface MobileRoleHeroProps {
  role: MobileRole;
  userName: string;
  activeCount: number;
  pendingCount: number;
}

const ROLE_COPY: Record<string, { label: string; title: string; icon: React.ReactNode; className: string }> = {
  TRANSPORTISTA: {
    label: 'Modo transporte',
    title: 'Viajes y GPS primero',
    icon: <Truck size={22} />,
    className: 'from-orange-600 to-amber-500',
  },
  OPERADOR: {
    label: 'Modo operador',
    title: 'Recepcion y tratamiento',
    icon: <FlaskConical size={22} />,
    className: 'from-blue-700 to-cyan-600',
  },
  ADMIN: {
    label: 'Modo control',
    title: 'Alertas y supervision',
    icon: <Shield size={22} />,
    className: 'from-emerald-700 to-green-600',
  },
  GENERADOR: {
    label: 'Modo generador',
    title: 'Manifiestos pendientes',
    icon: <ClipboardCheck size={22} />,
    className: 'from-purple-700 to-indigo-600',
  },
};

export const MobileRoleHero: React.FC<MobileRoleHeroProps> = ({ role, userName, activeCount, pendingCount }) => {
  const copy = ROLE_COPY[role] || ROLE_COPY.ADMIN;
  const isTransportista = role === 'TRANSPORTISTA';
  const activeLabel = isTransportista
    ? `${activeCount} viaje${activeCount === 1 ? ' activo' : 's activos'}`
    : `${activeCount} activos`;
  const pendingLabel = isTransportista
    ? `${pendingCount} asignado${pendingCount === 1 ? '' : 's'}`
    : `${pendingCount} pendientes`;

  return (
    <Card className={`overflow-hidden border-none bg-gradient-to-br ${copy.className} text-white shadow-lg`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              {copy.icon}
              {copy.label}
            </div>
            <p className="truncate text-sm text-white/80">Hola, {userName}</p>
            <h2 className="mt-1 text-xl font-black leading-tight">{copy.title}</h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge color="success" variant="solid" size="sm" className="max-w-[112px] justify-center truncate">{activeLabel}</Badge>
            <Badge color="warning" variant="solid" size="sm" className="max-w-[112px] justify-center truncate">{pendingLabel}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileRoleHero;

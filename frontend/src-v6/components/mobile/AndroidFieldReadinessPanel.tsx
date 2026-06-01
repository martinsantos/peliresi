import React from 'react';
import { AlertTriangle, CheckCircle2, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { Badge, type BadgeColor } from '../ui/BadgeV2';
import { Card, CardContent } from '../ui/CardV2';

type MobileRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | string;

interface AndroidFieldReadinessPanelProps {
  role: MobileRole;
  isOnline: boolean;
  isApiReachable: boolean;
  activeCount: number;
  pendingCount: number;
  isStandalone?: boolean;
}

interface ReadinessItem {
  label: string;
  detail: string;
  ready: boolean;
  color: BadgeColor;
  icon: React.ReactNode;
}

function getWorkStatus(role: MobileRole, activeCount: number, pendingCount: number): ReadinessItem {
  if (role === 'TRANSPORTISTA') {
    if (activeCount > 0) {
      return {
        label: 'Trabajo de campo',
        detail: 'Viaje activo disponible',
        ready: true,
        color: 'success',
        icon: <CheckCircle2 size={16} />,
      };
    }
    if (pendingCount > 0) {
      return {
        label: 'Trabajo de campo',
        detail: `${pendingCount} viaje${pendingCount === 1 ? '' : 's'} asignado${pendingCount === 1 ? '' : 's'}`,
        ready: true,
        color: 'warning',
        icon: <AlertTriangle size={16} />,
      };
    }
    return {
      label: 'Trabajo de campo',
      detail: 'Sin viajes asignados',
      ready: false,
      color: 'neutral',
      icon: <AlertTriangle size={16} />,
    };
  }

  if (role === 'OPERADOR') {
    return {
      label: 'Cola operativa',
      detail: pendingCount > 0 ? `${pendingCount} acciones pendientes` : 'Sin acciones pendientes',
      ready: pendingCount > 0,
      color: pendingCount > 0 ? 'warning' : 'neutral',
      icon: pendingCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />,
    };
  }

  return {
    label: 'Panel movil',
    detail: 'Panel operativo disponible',
    ready: true,
    color: 'info',
    icon: <CheckCircle2 size={16} />,
  };
}

export const AndroidFieldReadinessPanel: React.FC<AndroidFieldReadinessPanelProps> = ({
  role,
  isOnline,
  isApiReachable,
  activeCount,
  pendingCount,
  isStandalone = false,
}) => {
  const connectionReady = isOnline && isApiReachable;
  const items: ReadinessItem[] = [
    {
      label: 'Conexion',
      detail: connectionReady ? 'API y red disponibles' : 'Sin conexion operativa',
      ready: connectionReady,
      color: connectionReady ? 'success' : 'error',
      icon: connectionReady ? <Wifi size={16} /> : <WifiOff size={16} />,
    },
    getWorkStatus(role, activeCount, pendingCount),
    {
      label: 'Modo Android',
      detail: isStandalone ? 'App instalada activa' : 'Abrir como app instalada',
      ready: true,
      color: isStandalone ? 'success' : 'warning',
      icon: <Smartphone size={16} />,
    },
  ];

  const readyCount = items.filter((item) => item.ready).length;
  const progress = `${Math.round((readyCount / items.length) * 100)}%`;
  const scoreColor: BadgeColor = readyCount === items.length ? 'success' : readyCount >= 2 ? 'warning' : 'error';

  return (
    <Card className="border-neutral-200 bg-white">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Score operativo Android</p>
            <h3 className="mt-1 text-base font-black text-neutral-900">Estado de campo</h3>
          </div>
          <Badge color={scoreColor} variant="solid" size="sm" className="shrink-0">
            {readyCount}/3 listo
          </Badge>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-300"
            style={{ width: progress }}
            aria-hidden="true"
          />
        </div>

        <div className="grid gap-2">
          {items.map((item) => (
            <div key={item.label} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={item.ready ? 'text-success-600' : 'text-error-600'}>{item.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-800">{item.label}</p>
                  <p className="truncate text-xs text-neutral-500">{item.detail}</p>
                </div>
              </div>
              <Badge color={item.color} variant="soft" size="sm" className="shrink-0">
                {item.ready ? 'OK' : 'Revisar'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AndroidFieldReadinessPanel;

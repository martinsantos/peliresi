import React from 'react';
import { Bell, MapPin, Settings } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';

type PermissionKind = 'gps' | 'notifications';
type PermissionState = 'denied' | 'unavailable';

interface AndroidPermissionGuideProps {
  permission: PermissionKind;
  state: PermissionState;
}

const COPY: Record<PermissionKind, Record<PermissionState, { title: string; body: string; steps: string[]; icon: React.ReactNode }>> = {
  gps: {
    denied: {
      title: 'Permiso de ubicación bloqueado',
      body: 'Permití el acceso a la ubicación para compartir el recorrido durante el viaje.',
      steps: ['Abrí los permisos de ubicación de SITREP en el navegador o teléfono', 'Permití la ubicación mientras usás SITREP', 'Volvé al viaje y, si aparece, tocá Reintentar GPS'],
      icon: <MapPin size={18} />,
    },
    unavailable: {
      title: 'GPS no disponible',
      body: 'El navegador o dispositivo no pueden obtener la ubicación para el seguimiento.',
      steps: ['Revisá que la ubicación del dispositivo esté activada', 'Comprobá los permisos del navegador o teléfono', 'Volvé al viaje y, si aparece, tocá Reintentar GPS'],
      icon: <MapPin size={18} />,
    },
  },
  notifications: {
    denied: {
      title: 'Notificaciones desactivadas',
      body: 'Activalas para recibir avisos de viaje, incidentes y cambios de estado.',
      steps: ['Abrir Ajustes de Android', 'Entrar en Apps > SITREP', 'Permitir Notificaciones'],
      icon: <Bell size={18} />,
    },
    unavailable: {
      title: 'Notificaciones no disponibles',
      body: 'El dispositivo no permite notificaciones para esta instalacion.',
      steps: ['Revisar permisos de la app', 'Confirmar que Android permite notificaciones', 'Volver a intentar desde Configuracion'],
      icon: <Bell size={18} />,
    },
  },
};

export const AndroidPermissionGuide: React.FC<AndroidPermissionGuideProps> = ({ permission, state }) => {
  const copy = COPY[permission][state];

  return (
    <Card className="border-2 border-warning-200 bg-warning-50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-warning-700 shadow-sm">
            {copy.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-warning-700" />
              <h3 className="text-sm font-bold text-warning-900">{copy.title}</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-warning-800">{copy.body}</p>
            <ol className="mt-2 space-y-1 text-xs text-warning-800">
              {copy.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AndroidPermissionGuide;

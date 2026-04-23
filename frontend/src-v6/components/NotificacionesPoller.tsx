import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from './ui/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  prioridad: string;
  createdAt: string;
}

async function fetchNoLeidas(): Promise<Notificacion[]> {
  const res = await api.get<{ data: { notificaciones: Notificacion[] } }>(
    '/notificaciones?limit=10&soloNoLeidas=true'
  );
  return res.data.data?.notificaciones ?? [];
}

// Muestra toast para notificaciones nuevas que llegan vía polling
// (complementa el push nativo — cubre el caso en que el push no llegó)
export function NotificacionesPoller() {
  usePushNotifications();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const { data } = useQuery({
    queryKey: ['notificaciones-poll'],
    queryFn: fetchNoLeidas,
    refetchInterval: 30_000,   // cada 30 segundos
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });

  useEffect(() => {
    if (!data) return;

    if (!initialized.current) {
      // Primera carga: marcar todo como visto sin mostrar toasts
      data.forEach((n) => seen.current.add(n.id));
      initialized.current = true;
      return;
    }

    const nuevas = data.filter((n) => !seen.current.has(n.id));
    nuevas.forEach((n) => {
      seen.current.add(n.id);
      toast.add({
        type:    n.prioridad === 'ALTA' || n.prioridad === 'CRITICA' ? 'warning' : 'info',
        title:   n.titulo,
        message: n.mensaje,
        duration: n.prioridad === 'CRITICA' ? 12_000 : 6_000,
      });
    });
  }, [data]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificacionService } from '../services/notificacion.service';
import { resolveNotificationPath } from '../utils/notificationNavigation';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { toast } from './ui/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../contexts/AuthContext';

// Muestra toast para notificaciones nuevas que llegan vía polling
// (complementa el push nativo — cubre el caso en que el push no llegó)
export function NotificacionesPoller() {
  const { currentUser, isRestricted } = useAuth();
  return currentUser && !isRestricted ? <AuthorizedNotificationsPoller key={currentUser.id} userId={currentUser.id} /> : null;
}

function AuthorizedNotificationsPoller({ userId }: { userId: string | number }) {
  usePushNotifications();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const qc = useQueryClient();
  const toastIds = useRef<string[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const { data } = useQuery({
    queryKey: ['notificaciones', 'poll', userId],
    queryFn: () => notificacionService.list({ limit: 20, leida: false }),
    refetchInterval: 30_000,   // cada 30 segundos
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });

  useEffect(() => {
    if (!data) return;

    if (!initialized.current) {
      data.items.forEach((n) => seen.current.add(n.id));
      initialized.current = true;
      if (data.noLeidas > 0) toastIds.current.push(toast.add({ type: 'info',
        title: `${data.noLeidas} ${data.noLeidas === 1 ? 'aviso' : 'avisos'} sin leer`, duration: 8000,
        actionLabel: 'Ver avisos', onAction: () => navigate(mp('/notificaciones')) }));
      return;
    }

    const nuevas = data.items.filter((n) => !seen.current.has(n.id));
    if (nuevas.length) void qc.invalidateQueries({ queryKey: ['attention'] });
    nuevas.forEach((n) => {
      seen.current.add(n.id);
      toastIds.current.push(toast.add({
        type:    n.prioridad === 'ALTA' || n.prioridad === 'URGENTE' ? 'warning' : 'info',
        title:   n.titulo,
        message: n.mensaje,
        duration: n.prioridad === 'URGENTE' ? 12_000 : 6_000,
        actionLabel: 'Abrir', onAction: () => navigate(mp(resolveNotificationPath(n))),
      }));
    });
    if (seen.current.size > 200) seen.current = new Set(data.items.map(n => n.id));
  }, [data, navigate, mp, qc]);
  useEffect(() => () => toastIds.current.forEach(id => toast.remove(id)), []);

  return null;
}

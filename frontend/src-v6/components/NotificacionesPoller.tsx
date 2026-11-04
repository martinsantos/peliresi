import { TrainingLiveNotices } from './TrainingLiveNotices';
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificacionService } from '../services/notificacion.service';
import { resolveNotificationPath, refreshInspectionNotification, notificationActionLabel, needsPersonalManifestChoice } from '../utils/notificationNavigation';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { toast } from './ui/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../contexts/AuthContext';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';
import { notificationToastMessage } from '../utils/notificationMessage';

// Muestra toast para notificaciones nuevas que llegan vía polling
// (complementa el push nativo — cubre el caso en que el push no llegó)
export function NotificacionesPoller() {
  const { currentUser, isRestricted } = useAuth();
  if(currentUser?.training && !isRestricted)return <TrainingLiveNotices key={currentUser.id} userId={currentUser.id}/>;
  const owner = inspectionWorkspaceOwner(currentUser);
  return currentUser && !isRestricted ? <AuthorizedNotificationsPoller key={owner} owner={owner} userId={currentUser.id} userRole={currentUser.rol} personalChoice={needsPersonalManifestChoice(currentUser)} /> : null;
}

function AuthorizedNotificationsPoller({ userId, userRole, owner, personalChoice }: { userId: string | number; userRole: string; owner: string; personalChoice: boolean }) {
  usePushNotifications();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const qc = useQueryClient();
  const toastIds = useRef<string[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const latestReceivedAt = useRef(Number.NEGATIVE_INFINITY);

  const { data } = useQuery({
    queryKey: ['notificaciones', 'poll', userId, owner],
    queryFn: () => notificacionService.list({ limit: 20, leida: false }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!data) return;

    if (!initialized.current) {
      data.items.forEach((n) => {
        seen.current.add(n.id);
        const createdAt = Date.parse(n.createdAt);
        if (Number.isFinite(createdAt)) latestReceivedAt.current = Math.max(latestReceivedAt.current, createdAt);
      });
      initialized.current = true;
      // Existing unread notices already have a persistent count in the bell.
      // Reserve the live banner for events received during this session.
      return;
    }

    // Reading one notice pulls an older unread item into this limited page.
    // A newly visible ID is not necessarily a new event. Use the server's
    // timestamps (not the device clock), keeping simultaneous events eligible.
    const nuevas = data.items.filter((n) => !seen.current.has(n.id)
      && Date.parse(n.createdAt) >= latestReceivedAt.current);
    data.items.forEach((n) => {
      seen.current.add(n.id);
      const createdAt = Date.parse(n.createdAt);
      if (Number.isFinite(createdAt)) latestReceivedAt.current = Math.max(latestReceivedAt.current, createdAt);
    });
    if (nuevas.length) {
      void qc.invalidateQueries({ queryKey: ['attention'] });
      // Refresh the open inbox and badge, without invalidating this poll and
      // creating a request loop. Receiving a notice never marks it as read.
      void qc.invalidateQueries({ queryKey: ['notificaciones', 'list'] });
      void qc.invalidateQueries({ queryKey: ['notificaciones', 'no-leidas'] });
      void qc.invalidateQueries({ queryKey: ['notificaciones', 'bell'] });
    }
    nuevas.forEach((n) => {
      seen.current.add(n.id);
      refreshInspectionNotification(n, qc);
      toastIds.current.push(toast.add({
        type:    n.prioridad === 'ALTA' || n.prioridad === 'URGENTE' ? 'warning' : 'info',
        title:   n.titulo,
        message: notificationToastMessage(n),
        messagePreview: true,
        duration: n.prioridad === 'URGENTE' ? 12_000 : 10_000,
        actionLabel: notificationActionLabel(resolveNotificationPath(n, '', userRole, false, personalChoice), n), onAction: () => { refreshInspectionNotification(n, qc); navigate(mp(resolveNotificationPath(n, '', userRole, false, personalChoice))); },
      }));
    });
    if (seen.current.size > 200) seen.current = new Set(data.items.map(n => n.id));
  }, [data, navigate, mp, qc, userRole, personalChoice]);
  useEffect(() => () => toastIds.current.forEach(id => toast.remove(id)), []);

  return null;
}

import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { solicitudService } from '../services/solicitud.service';
import type { SolicitudInscripcion } from '../types/api';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ACTIVITY_HEADER, saveActorActivity } from '../services/actorActivity';
import { clearOfflineSession } from '../services/offlineSession';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Card } from './ui/CardV2';
import { Button } from './ui/ButtonV2';

const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };
export default function ActorActivities() {
  const { currentUser } = useAuth();
  if (import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED !== 'true' || !currentUser || currentUser.empresaContexto || !(currentUser.rol in labels)) return null;
  return <ActivityChoices key={currentUser.id} />;
}
function ActivityChoices() {
  const { currentUser, isRestricted } = useAuth();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const applications = useQuery({ queryKey: ['actor-activity-applications', currentUser?.id],
    queryFn: () => solicitudService.misSolicitudes(), retry: false, staleTime: 0 });
  if (!currentUser) return null;
  const activities = isRestricted ? [] : currentUser.actividades || [currentUser.rol];
  async function choose(type: keyof typeof labels, approved: boolean, application?: SolicitudInscripcion) {
    if (lock.current || !currentUser) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (approved) {
        // Confirm on server first. New navigation discards the previous role's in-memory queries.
        const result = await api.get('/auth/profile', { headers: { [ACTIVITY_HEADER]: type } });
        if (result.data.data.user.id !== currentUser.id || result.data.data.user.rol !== type) throw new Error('Actividad incompatible');
        saveActorActivity(String(currentUser.id), type);
        clearOfflineSession();
        window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + mp('/mi-perfil'));
      } else if (application) {
        navigate(['BORRADOR', 'OBSERVADA'].includes(application.estado)
          ? '/inscripcion/' + type.toLowerCase()
          : mp('/mi-solicitud') + '?solicitud=' + encodeURIComponent(application.id));
      } else {
        const result = await api.post('/solicitudes/actividad-adicional', { tipoActor: type });
        const draft = result.data.data.solicitud;
        if (!draft?.id || draft.usuarioId !== currentUser.id) throw new Error('Solicitud incompatible');
        // Existing wizard discovers the user's own draft; no identity or form is replaced.
        navigate(['BORRADOR', 'OBSERVADA'].includes(draft.estado)
          ? '/inscripcion/' + type.toLowerCase()
          : mp('/mi-solicitud') + '?solicitud=' + encodeURIComponent(draft.id));
      }
    } catch (caught) {
      const failure = caught as { response?: { data?: { message?: string } } };
      setError(failure.response?.data?.message || 'No se pudo confirmar la actividad. Tu sesión sigue igual.');
    } finally { lock.current = false; setBusy(false); }
  }
  return <Card><h2 className="font-semibold mb-3">Mis actividades</h2>
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Array<keyof typeof labels>).map(type => {
      const approved = activities.includes(type);
      const inUse = !isRestricted && currentUser.rol === type;
      const application = applications.data?.find(item => item.tipoActor === type && item.estado !== 'RECHAZADA');
      const action = application ? (['BORRADOR', 'OBSERVADA'].includes(application.estado) ? 'Continuar ' : 'Ver solicitud de ') : 'Solicitar ';
      return <Button key={type} variant="outline" disabled={busy || inUse || (!approved && !applications.isSuccess)}
        onClick={() => void choose(type, approved, application)}>{inUse ? labels[type] + ' · En uso' : approved ? 'Usar ' + labels[type] : action + labels[type]}</Button>;
    })}</div>
    {applications.isPending && <p role="status" className="mt-2 text-sm">Consultando solicitudes…</p>}
    {applications.isError && <p role="alert" className="mt-2 text-sm">No pudimos consultar tus solicitudes. <button className="underline min-h-11" onClick={() => void applications.refetch()}>Reintentar</button></p>}
    {error && <p role="alert" className="mt-3 text-error-700">{error}</p>}
  </Card>;
}

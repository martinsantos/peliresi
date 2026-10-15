import React, { useRef, useState } from 'react';
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
  const { currentUser, isRestricted } = useAuth();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  if (import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED !== 'true' || !currentUser || !(currentUser.rol in labels)) return null;
  const activities = isRestricted ? [] : currentUser.actividades || [currentUser.rol];
  async function choose(type: keyof typeof labels, approved: boolean) {
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
      } else {
        const result = await api.post('/solicitudes/actividad-adicional', { tipoActor: type });
        const draft = result.data.data.solicitud;
        if (!draft?.id || draft.usuarioId !== currentUser.id) throw new Error('Solicitud incompatible');
        // Existing wizard discovers the user's own draft; no identity or form is replaced.
        navigate('/inscripcion/' + type.toLowerCase());
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
      return <Button key={type} variant="outline" disabled={busy || inUse}
        onClick={() => void choose(type, approved)}>{inUse ? labels[type] + ' · En uso' : approved ? 'Usar ' + labels[type] : 'Solicitar ' + labels[type]}</Button>;
    })}</div>
    {error && <p role="alert" className="mt-3 text-error-700">{error}</p>}
  </Card>;
}

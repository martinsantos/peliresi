import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { activateActorActivity } from '../services/activateActorActivity';
import { notificationEventualActors } from '../utils/notificationNavigation';
import type { Notificacion } from '../types/models';
import type { User } from '../contexts/AuthContext';
import { Button } from './ui/ButtonV2';

const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador' } as const;

/** The notice offers only the personal activities that still have access. */
export default function EventualNoticeAction({ notice, target, user }: { notice: Notificacion; target: string; user: User }) {
 const actors = notificationEventualActors(notice), mp = useMobilePrefix();
 const lock = useRef(false), alive = useRef(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 async function open(actor: typeof actors[number]) {
  if (lock.current) return;
  lock.current = true; setBusy(true); setError('');
  try {
   await activateActorActivity(user.id, actor.rol, actor.actorId, () => alive.current);
   if (!alive.current) return;
   window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + mp(target));
  } catch { if (alive.current) setError('No pudimos confirmar esta actividad. Tu contexto no cambió. Revisá los roles de tu cuenta y reintentá.'); }
  finally { if (alive.current) { lock.current = false; setBusy(false); } }
 }
 if (!actors.length) return null;
 return <div className="space-y-3" aria-label="Acceso al eventual con mi actividad">
  <p className="text-sm text-neutral-700">Abrí el eventual con tu actividad autorizada.</p>
  {actors.map(actor => {
   const matches = user.rol === actor.rol && user.actorId === actor.actorId && (!user.empresaContexto || user.empresaContexto.todasSedes);
   return <div key={`${actor.rol}:${actor.actorId}`} className="rounded-lg border border-primary-100 bg-primary-50 p-3 space-y-2">
    <p className="font-semibold">Mi actividad</p>
    {matches ? <Link aria-label={'Abrir eventual con mi actividad ' + labels[actor.rol]} className="inline-flex min-h-11 items-center rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white" to={mp(target)}>Abrir como {labels[actor.rol]}</Link>
      : user.actividades?.includes(actor.rol) ? <Button aria-label={'Abrir eventual con mi actividad ' + labels[actor.rol]} disabled={busy} onClick={() => void open(actor)}>Abrir como {labels[actor.rol]}</Button>
      : <Link className="inline-flex min-h-11 items-center text-primary-800 underline" to={mp('/mi-perfil')}>Revisar los roles de mi cuenta</Link>}
   </div>;
  })}
  {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
 </div>;
}

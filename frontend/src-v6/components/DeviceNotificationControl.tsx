import { useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import { registerDevicePush, type DevicePushState } from '../hooks/usePushNotifications';
import { getApiErrorMessage } from '../utils/api-error';

export function DeviceNotificationControl({ training = false }: { training?: boolean }) {
  const [state, setState] = useState<DevicePushState | 'checking'>('checking');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const current = useRef(false), pending = useRef(false);
  useEffect(() => {
    current.current=!training;
    if (training) return;
    let active = true;
    void registerDevicePush(false, () => active).then(value => { if (active) setState(value); })
      .catch(cause => { if (active) setError(getApiErrorMessage(cause, 'No pudimos comprobar los avisos de este dispositivo.')); });
    return () => { active = false; current.current=false; };
  }, [training]);
  if (training) return null;
  const descriptions = {
    checking: 'Comprobando este dispositivo…', unsupported: 'Este navegador no permite avisos del sistema. Consultá la campana dentro de SITREP.',
    'channel-off': 'Este canal todavía no está habilitado. Los avisos siguen disponibles en la campana.',
    ask: 'Activá los avisos para recibir una alerta del teléfono cuando haya una novedad dirigida a tu cuenta.',
    blocked: 'El permiso está bloqueado. Permití las notificaciones para SITREP en los ajustes del navegador y volvé a comprobar.',
    'worker-pending': 'La app todavía se está preparando. Recargá cuando termines el trabajo pendiente y volvé a comprobar.',
    enabled: 'Este dispositivo quedó registrado para los avisos habilitados de tu cuenta. La campana conserva el historial.',
  };
  const activate = async () => {
    if (pending.current) return;
    pending.current=true;
    setBusy(true); setError('');
    try { const value=await registerDevicePush(true,()=>current.current); if(current.current)setState(value); }
    catch (cause) { if(current.current)setError(getApiErrorMessage(cause, 'No se pudieron activar los avisos de este dispositivo.')); }
    finally { pending.current=false; if(current.current)setBusy(false); }
  };
  return <section aria-label="Avisos del dispositivo" className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center">
    <BellRing size={22} aria-hidden="true" className="shrink-0 text-primary-700"/>
    <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-neutral-900">Avisos en este dispositivo</h3><p className="mt-1 text-sm text-neutral-600">{descriptions[state]}</p>{error&&<p role="alert" className="mt-2 text-sm text-error-800">{error}</p>}</div>
    {(state==='ask'||state==='blocked'||state==='worker-pending'||!!error)&&<Button variant="outline" size="sm" isLoading={busy} onClick={activate}>{state==='ask'?'Activar avisos del teléfono':'Volver a comprobar'}</Button>}
  </section>;
}

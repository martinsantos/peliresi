import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { companyHeaders, saveCompanyContext, type CompanyContext } from '../services/companyContext';
import { clearOfflineSession } from '../services/offlineSession';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Button } from './ui/ButtonV2';
import { notificationCompanyAccesses } from '../utils/notificationNavigation';
import type { Notificacion } from '../types/models';

/** Notice metadata is orientation, never authorization. Profile revalidates the
 * exact company, activity and site before saving a choice or opening a dossier. */
export default function CompanyNoticeAction({ notice, target, userId, context }: {
 notice: Notificacion; target: string; userId: string; context?: CompanyContext;
}) {
 const accesses = notificationCompanyAccesses(notice), mp = useMobilePrefix();
 const subject = target.includes('/adendas') ? 'adenda' : target.includes('certificado=') ? 'certificado' : 'manifiesto';
 const article = subject === 'adenda' ? 'la' : 'el';
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const locked = useRef(false), alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const labels: Record<string,string> = { GENERADOR:'Generador', TRANSPORTISTA:'Transporte', OPERADOR:'Operador' };
 async function open(access: typeof accesses[number]) {
  if (locked.current) return;
  locked.current = true; setBusy(true); setError('');
  try {
   const selection = { empresaId: access.empresaId, actividadId: access.actividadId, ...(access.establecimientoId ? { establecimientoId: access.establecimientoId } : {}) };
   const result = await api.get('/auth/profile', { headers: companyHeaders(selection) });
   const user = result.data.data.user, verified = user.empresaContexto;
   if (!alive.current) return;
   if (String(user.id) !== userId || verified?.empresaId !== selection.empresaId || verified?.actividadId !== selection.actividadId
    || (verified?.establecimientoId || '') !== (selection.establecimientoId || '') || verified?.rol !== access.rol) throw new Error('Contexto incompatible');
   saveCompanyContext(userId, selection); clearOfflineSession();
   window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + mp(target));
  } catch { if (alive.current) setError('No pudimos confirmar esta autorización. Tu contexto no cambió. Reintentá o consultá al responsable de la entidad.'); }
  finally { if (alive.current) { locked.current = false; setBusy(false); } }
 }
 return <div className="space-y-3" aria-label={`Acceso ${article === 'el' ? 'al' : 'a la'} ${subject} por empresa`}>
  <p className="text-sm text-neutral-700">Abrí {article} {subject} con la actividad que representa a la empresa.</p>
  {accesses.map(a => <div key={a.actividadId} className="rounded-lg border border-primary-100 bg-primary-50 p-3 space-y-2">
   <p className="font-semibold break-words">{a.razonSocial}</p>
   <p className="text-sm">{labels[a.rol]}{a.establecimiento ? ' · ' + a.establecimiento : ''}</p>
   <Button disabled={busy} onClick={() => void open(a)}>{context?.actividadId === a.actividadId ? 'Abrir ' + subject : 'Usar ' + labels[a.rol] + ' y abrir ' + subject}</Button>
  </div>)}
  {error && <div role="alert" className="space-y-2 text-sm text-error-700"><p>{error}</p><Link className="inline-flex min-h-11 items-center underline" to={mp('/empresas?origen=avisos')}>Revisar mis autorizaciones</Link></div>}
 </div>;
}

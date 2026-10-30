import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { companyHeaders, saveCompanyContext, type CompanyContext } from '../services/companyContext';
import { clearOfflineSession } from '../services/offlineSession';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Button } from './ui/ButtonV2';
import { notificationCompanyAccesses, notificationFiscalReminder } from '../utils/notificationNavigation';
import type { Notificacion } from '../types/models';

/** Notice metadata is orientation, never authorization. Profile revalidates the
 * exact company, activity and site before saving a choice or opening a dossier. */
export default function CompanyNoticeAction({ notice, target, userId, context, returnState, onOpenFiscal }: {
 notice: Notificacion; target: string; userId: string; context?: CompanyContext; returnState?: unknown; onOpenFiscal?: () => void;
}) {
 const accesses = notificationCompanyAccesses(notice), mp = useMobilePrefix();
 const fiscal = notificationFiscalReminder(notice);
 const eventual = target.includes('/manifiestos/baja-intensidad?registro=');
 const subject = fiscal ? 'situación fiscal' : eventual ? 'eventual' : target.includes('/adendas') ? 'adenda' : target.includes('certificado=') ? 'certificado' : 'manifiesto';
 const article = subject === 'adenda' || fiscal ? 'la' : 'el';
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const locked = useRef(false), alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const labels: Record<string,string> = { GENERADOR:'Generador', TRANSPORTISTA:'Transporte', OPERADOR:'Operador' };
 const eventualCompanies = [...new Map(accesses.map(a => [a.empresaId, a.razonSocial])).entries()];
 async function open(access: typeof accesses[number]) {
  if (locked.current) return;
  locked.current = true; setBusy(true); setError('');
  try {
   const selection = { empresaId: access.empresaId, actividadId: access.actividadId, ...(access.establecimientoId ? { establecimientoId: access.establecimientoId } : {}) };
   const result = await api.get('/auth/profile', { headers: companyHeaders(selection) });
   const user = result.data.data.user, verified = user.empresaContexto;
   if (!alive.current) return;
   if (String(user.id) !== userId || verified?.empresaId !== selection.empresaId || verified?.actividadId !== selection.actividadId
    || (verified?.establecimientoId || '') !== (selection.establecimientoId || '') || verified?.rol !== access.rol
    || (fiscal && (!verified?.todasSedes || verified?.actorId !== fiscal.actorId))
    || (eventual && (!verified?.todasSedes || !access.actorId || verified?.actorId !== access.actorId))) throw new Error('Contexto incompatible');
   saveCompanyContext(userId, selection); clearOfflineSession();
   const destination = fiscal ? '/notificaciones/' + encodeURIComponent(notice.id) : target;
   window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + mp(destination));
  } catch { if (alive.current) setError('No pudimos confirmar esta autorización. Tu contexto no cambió. Reintentá o consultá al responsable de la entidad.'); }
  finally { if (alive.current) { locked.current = false; setBusy(false); } }
 }
 return <div className="space-y-3" aria-label={`Acceso ${article === 'el' ? 'al' : 'a la'} ${subject} por empresa`}>
  <p className="text-sm text-neutral-700">Abrí {article} {subject} con la actividad que representa a la empresa.</p>
  {eventual ? eventualCompanies.map(([companyId, name]) => <div key={companyId} className="rounded-lg border border-primary-100 bg-primary-50 p-3 space-y-2">
   <p className="font-semibold break-words">{name}</p>
   <div className="flex flex-wrap gap-2">
    {accesses.filter(a => a.empresaId === companyId).map(a => <Button key={a.actividadId} className="scroll-mb-28 scroll-mt-20"
     aria-label={'Abrir eventual como ' + labels[a.rol] + ' de ' + a.razonSocial} disabled={busy} onClick={() => void open(a)}>Abrir como {labels[a.rol]}</Button>)}
   </div>
  </div>) : accesses.map(a => <div key={a.actividadId} className="rounded-lg border border-primary-100 bg-primary-50 p-3 space-y-2">
   <p className="font-semibold break-words">{a.razonSocial}</p>
   <p className="text-sm">{labels[a.rol]}{a.establecimiento ? ' · ' + a.establecimiento : ''}</p>
   {fiscal && context?.empresaId === a.empresaId && context.actividadId === a.actividadId && context.rol === 'GENERADOR'
    && context.actorId === fiscal.actorId && context.todasSedes
    ? <Link className="inline-flex min-h-11 scroll-mb-28 scroll-mt-20 items-center rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white" to={mp(target)}
      state={{ actorReturn: mp('/notificaciones/' + encodeURIComponent(notice.id)), ...(returnState ? { notificationInboxReturn: returnState } : {}) }} onClick={onOpenFiscal}>Ver situación fiscal →</Link>
    : <Button className="scroll-mb-28 scroll-mt-20" disabled={busy} onClick={() => void open(a)}>{fiscal ? 'Usar ' + labels[a.rol] + ' para continuar' : context?.actividadId === a.actividadId ? 'Abrir ' + subject : 'Usar ' + labels[a.rol] + ' y abrir ' + subject}</Button>}
  </div>)}
  {error && <div role="alert" className="space-y-2 text-sm text-error-700"><p>{error}</p><Link className="inline-flex min-h-11 items-center underline" to={mp('/empresas?origen=avisos')}>Revisar mis autorizaciones</Link></div>}
 </div>;
}

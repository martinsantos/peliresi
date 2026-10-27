import CompanyNoticeAction from '../../components/CompanyNoticeAction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { resolveNotificationPath, notificationActionLabel, notificationActorRole, notificationCompanyAccesses, notificationEnvironmentalCertificate, notificationFiscalReminder, notificationInboxReturnPath, refreshInspectionNotification } from '../../utils/notificationNavigation';
import { activateActorActivity } from '../../services/activateActorActivity';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import type { Notificacion } from '../../types/models';
import { Button } from '../../components/ui/ButtonV2';

/** No acknowledgement or business mutation on opening a mail (including link scanners). */
export default function AvisoPage() {
  const { id } = useParams(); const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const location = useLocation();
  const queryClient = useQueryClient();
  const lock = useRef(false), [changing, setChanging] = useState(false), [contextError, setContextError] = useState('');
  const query = useQuery({ queryKey: ['notificaciones', 'detail', currentUser?.id, id, inspectionWorkspaceOwner(currentUser)],
    queryFn: async () => (await api.get('/notificaciones/' + encodeURIComponent(id || ''))).data.data as Notificacion,
    retry: false, staleTime: 0 });
  const notice = !query.isError && !query.isPending ? query.data : undefined;
  const inboxReturn = notificationInboxReturnPath(location.state, inspectionWorkspaceOwner(currentUser));
  const inboxState = location.state && typeof location.state === 'object' && !Array.isArray(location.state)
    ? (location.state as { notificationInboxReturn?: unknown }).notificationInboxReturn : undefined;
  const target = notice ? resolveNotificationPath(notice, '', currentUser?.rol, true) : '/notificaciones';
  const companyAccesses = notice ? notificationCompanyAccesses(notice) : [];
  const certificate = notice ? notificationEnvironmentalCertificate(notice) : null;
  const fiscal = notice ? notificationFiscalReminder(notice) : null;
  const actorTarget = certificate || fiscal;
  const actorRole = notice ? notificationActorRole(notice) : null;
  const actorContextMatches = !!(actorTarget && currentUser?.rol === actorTarget.role && currentUser.actorId === actorTarget.actorId
    && (!currentUser.empresaContexto || currentUser.empresaContexto.todasSedes));
  const otherRole = actorRole && (actorTarget ? !actorContextMatches : actorRole !== currentUser?.rol);
  const roleLabel = actorRole ? { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' }[actorRole] : '';
  const canChange = otherRole && (actorTarget || !currentUser?.empresaContexto) && currentUser?.actividades?.includes(actorRole);
  async function changeActivity() {
    if (lock.current || !canChange || !actorRole || !currentUser || !notice) return;
    lock.current = true; setChanging(true); setContextError('');
    try {
      if (actorTarget) await activateActorActivity(currentUser.id, actorRole, actorTarget.actorId);
      else await activateActorActivity(currentUser.id, actorRole);
      const path = mp(fiscal ? '/notificaciones/' + encodeURIComponent(notice.id) : resolveNotificationPath(notice, '', actorRole, !!certificate));
      window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + path);
    } catch { setContextError('No pudimos confirmar ese rol. Tu actividad actual no cambió. Reintentá o revisá los roles de tu cuenta.'); }
    finally { lock.current = false; setChanging(false); }
  }
  return <section className="mx-auto max-w-2xl space-y-4" aria-label="Aviso recibido">
    <Link className="inline-flex min-h-11 items-center gap-2 text-primary-800 underline" to={mp(inboxReturn)}><ArrowLeft size={18} aria-hidden="true" />Volver a Avisos</Link>
    {query.isPending && <p role="status">Buscando tu aviso…</p>}
    {query.isError && <div role="alert" className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <p>No se pudo abrir este aviso. Ingresá con la cuenta que recibió el correo. Si el aviso fue eliminado, consultá el trámite desde tus listados.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>
    </div>}
    {notice && <article className="rounded-xl border border-primary-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-semibold">{notice.titulo}</h2><p className="whitespace-pre-wrap break-words">{notice.mensaje}</p>
      {actorRole && !otherRole && <p className="text-sm font-semibold text-primary-800">Actividad: {roleLabel}</p>}
      {otherRole && <div className="space-y-3 rounded-lg bg-primary-50 p-3">
        <p>Usá tu actividad {roleLabel} para consultar {certificate ? 'este certificado ambiental' : fiscal ? 'este recordatorio fiscal' : 'este requerimiento'}.</p>
        {canChange ? <Button onClick={() => void changeActivity()} isLoading={changing}>Usar {roleLabel}{fiscal ? '' : certificate ? ' y ver certificado' : ' y abrir requerimiento'}</Button>
          : <Link className="inline-flex min-h-11 items-center text-primary-800 underline" to={mp('/mi-perfil')}>Revisar los roles de mi cuenta</Link>}
        {contextError && <p role="alert" className="text-sm text-error-700">{contextError}</p>}
      </div>}
      <p className="text-sm text-neutral-600">Aviso del {new Date(notice.createdAt).toLocaleString('es-AR')}. Consultá el estado actual antes de actuar.</p>
      {companyAccesses.length > 0 && currentUser && <CompanyNoticeAction key={inspectionWorkspaceOwner(currentUser)} notice={notice} target={target} userId={String(currentUser.id)} context={currentUser.empresaContexto} />}
      {!companyAccesses.length && (!actorTarget || actorContextMatches) && target !== '/notificaciones' && target !== '/notificaciones/' + id && <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white" to={mp(target)} onClick={() => { if (fiscal) refreshInspectionNotification(notice, queryClient); }} state={fiscal ? { actorReturn: mp('/notificaciones/' + encodeURIComponent(notice.id)), ...(inboxState ? { notificationInboxReturn: inboxState } : {}) } : undefined}>{notificationActionLabel(target, notice)}</Link>}
    </article>}
  </section>;
}

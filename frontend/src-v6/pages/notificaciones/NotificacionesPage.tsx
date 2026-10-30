/**
 * SITREP v6 - Centro de notificaciones del usuario.
 * Una bandeja paginada; los estados y contadores provienen de la API.
 */
import React, { useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, FileText, Info, ClipboardCheck, MoreHorizontal, SlidersHorizontal, AlertTriangle, CheckCircle2, LifeBuoy } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas, useEliminarNotificacion } from '../../hooks/useNotificaciones';
import { formatRelativeTime } from '../../utils/formatters';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { resolveNotificationPath, refreshInspectionNotification, notificationActionLabel, notificationActorRole, notificationInboxReturnState, needsPersonalManifestChoice } from '../../utils/notificationNavigation';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { notificationFollowup } from '../../utils/notificationFollowup';
import { gpsNoticeContext, gpsNoticeTitle } from '../../utils/gpsNoticeContext';
import { notificationManifestReference } from '../../utils/notificationManifestReference';
import type { Notificacion } from '../../types/models';
import { useAuth } from '../../contexts/AuthContext';
import { DeviceNotificationControl } from '../../components/DeviceNotificationControl';

const PAGE_SIZE = 20;
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700';

const NotificacionesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const mp = useMobilePrefix();
  const optionsId = useId();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [noticeOptions, setNoticeOptions] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get('avisos') === 'sin-leer';
  const rawPage = Number(params.get('pagina') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { data, isPending, isError, isSuccess, refetch } = useNotificaciones({
    page, limit: PAGE_SIZE, leida: unreadOnly ? false : undefined,
  });
  const mark = useMarcarLeida();
  const markAll = useMarcarTodasLeidas();
  const remove = useEliminarNotificacion();
  const items = data?.items ?? [];
  const mutationPending = mark.isPending || markAll.isPending || remove.isPending;
  const mutationFailed = mark.isError || markAll.isError || remove.isError;
  const lastPage = Math.max(1, data?.totalPages ?? 1);

  const changePage = (value: number, replace = false) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value === 1) next.delete('pagina'); else next.set('pagina', String(value));
      return next;
    }, { replace, preventScrollReset: true });
  };

  // Reading/deleting the last notice on a filtered page may shrink the result.
  // Return to its real last page instead of presenting a false empty inbox.
  useEffect(() => {
    if (isSuccess && page > lastPage) {
      setParams(previous => {
        const next = new URLSearchParams(previous);
        if (lastPage === 1) next.delete('pagina'); else next.set('pagina', String(lastPage));
        return next;
      }, { replace: true, preventScrollReset: true });
    }
  }, [isSuccess, page, lastPage, setParams]);

  const changeFilter = (unread: boolean) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('pagina');
      if (unread) next.set('avisos', 'sin-leer'); else next.delete('avisos');
      return next;
    }, { preventScrollReset: true });
  };
  const resetMutationErrors = () => { mark.reset(); markAll.reset(); remove.reset(); };
  const open = (notice: Notificacion) => {
    resetMutationErrors();
    refreshInspectionNotification(notice, queryClient);
    if (!notice.leida) mark.mutate(notice.id);
    // Opening the expediente must not depend on a successful acknowledgement.
    navigate(resolveNotificationPath(notice, mp(''), currentUser?.rol, false, needsPersonalManifestChoice(currentUser)), { state: notificationInboxReturnState(params.toString(), inspectionWorkspaceOwner(currentUser)) });
  };

  return (
    <div className="space-y-4" data-testid="notification-inbox">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200">
      <nav aria-label="Filtrar avisos" className="flex min-w-0 gap-1">
        <button type="button" aria-pressed={!unreadOnly} onClick={() => changeFilter(false)}
          className={'min-h-11 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ' + focus + (!unreadOnly ? ' border-primary-700 text-primary-800' : ' border-transparent text-neutral-700 hover:bg-neutral-50')}>
          Todos
        </button>
        <button type="button" aria-pressed={unreadOnly} onClick={() => changeFilter(true)}
          aria-label={'Sin leer' + (data ? ' (' + data.noLeidas + ')' : '')}
          className={'min-h-11 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ' + focus + (unreadOnly ? ' border-primary-700 text-primary-800' : ' border-transparent text-neutral-700 hover:bg-neutral-50')}>
          Sin leer {data && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-800">{data.noLeidas}</span>}
        </button>
      </nav>
      <button type="button" aria-label="Opciones de avisos" aria-expanded={optionsOpen} aria-controls={optionsId}
        onClick={() => setOptionsOpen(value => !value)}
        className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 ' + focus}>
        <SlidersHorizontal size={18} aria-hidden="true" />Opciones
      </button>
      </div>
      {optionsOpen && <section id={optionsId} aria-label="Opciones de avisos" className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <DeviceNotificationControl key={currentUser?.id} training={currentUser?.training}/>
        {data && data.noLeidas > 0 && (
          <Button variant="outline" leftIcon={<CheckCheck size={18} />} isLoading={markAll.isPending}
            disabled={mutationPending} onClick={() => { resetMutationErrors(); markAll.mutate(); }}>
            Marcar todas leídas
          </Button>
        )}
        <p className="text-sm text-neutral-600">Marcar un aviso como leído no completa la tarea ni aprueba el trámite.</p>
      </section>}

      {isError && (
        <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-800">
          No se pudieron cargar los avisos.{items.length > 0 && ' Se muestran los últimos disponibles.'}
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button>
        </div>
      )}
      {mutationFailed && (
        <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">
          No se pudo guardar el cambio. El aviso sigue disponible; podés reintentar.
        </p>
      )}
      {isPending ? (
        <p role="status" className="py-8 text-neutral-700">Cargando avisos…</p>
      ) : isSuccess && items.length === 0 && page <= lastPage ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
          <Bell size={28} aria-hidden="true" className="mx-auto mb-3 text-neutral-600" />
          <h2 className="font-semibold text-neutral-900">{unreadOnly ? 'Estás al día con tus avisos' : 'Todavía no recibiste avisos'}</h2>
          <p className="mt-1 text-sm text-neutral-700">{unreadOnly ? 'Podés consultar los anteriores en Todos.' : 'Las novedades de tus trámites aparecerán acá.'}</p>
        </div>
      ) : items.length > 0 ? (
        <ul aria-label="Avisos" className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {items.map((notice,index) => {
            const followup = notificationFollowup(notice);
            const gpsContext = gpsNoticeContext(notice);
            const manifestReference = notificationManifestReference(notice);
            // A configurable rule has an identity. Do not replace its saved
            // name with a generic title; retain the fallback for legacy data.
            const title = gpsNoticeTitle(notice) || (followup ? notice.titulo?.trim() || 'Seguimiento de manifiesto' : notice.titulo);
            const path = resolveNotificationPath(notice, mp(''), currentUser?.rol, false, needsPersonalManifestChoice(currentUser));
            const activity = notificationActorRole(notice);
            const otherActivity = activity && activity !== currentUser?.rol ? { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' }[activity] : null;
            const linked = path !== mp('/notificaciones');
            const Content = linked ? 'button' : 'div';
            const warning = /RECHAZ|INCIDENTE|ANOMALIA|VENCIMIENTO|ALERTA/.test(notice.tipo) || /rechaz|detenido/i.test(notice.titulo);
            const success = /TRATADO|RECIBIDO/.test(notice.tipo) || /aprobaron|aprobó|iniciada|certificación/i.test(notice.titulo);
            const day=(date:string)=>new Date(date).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Mendoza',day:'numeric',month:'long'});
            const dateLabel=day(notice.createdAt);
            const groupStart=index===0||day(items[index-1].createdAt)!==dateLabel;
            const Icon = warning ? AlertTriangle : /\/soporte\//.test(path) ? LifeBuoy : (activity || /\/(?:requerimientos|(?:mis-)?inspecciones)(?:[/?#]|$)/.test(path)) ? ClipboardCheck : success ? CheckCircle2 : notice.manifiestoId ? FileText : Info;
            return (
              <li key={notice.id} className={notice.leida ? 'border-l-4 border-l-transparent opacity-80' : 'border-l-4 border-l-primary-600 bg-primary-50/40'}>
                {groupStart && <p className="border-b border-neutral-200 bg-neutral-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">{dateLabel}</p>}
                <div className="flex items-start">
                <Content type={linked ? 'button' : undefined} aria-label={linked ? 'Abrir aviso: ' + title : undefined} onClick={linked ? () => open(notice) : undefined}
                  className={'flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-1 text-left text-neutral-900 sm:p-4 ' + (linked ? 'transition-colors hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-offset-[-2px] ' + focus : '')}>
                  <Icon size={20} aria-hidden="true" className={'mt-0.5 shrink-0 ' + (warning ? 'text-warning-800' : success ? 'text-emerald-800' : 'text-primary-700')} />
                  <span className="min-w-0 flex-1">
                    <span className={'block break-words text-base leading-snug ' + (notice.leida ? 'font-medium' : 'font-semibold')}>{title}</span>
                    {manifestReference && <span className="mt-1 block text-xs font-semibold text-neutral-700">{manifestReference}</span>}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {!notice.leida && <span className="text-xs font-semibold text-primary-800">Sin leer</span>}
                      {(notice.prioridad === 'ALTA' || notice.prioridad === 'URGENTE') && (
                        <Badge variant="soft" color="error">{notice.prioridad === 'URGENTE' ? 'Urgente' : 'Prioridad alta'}</Badge>
                      )}
                      <time dateTime={notice.createdAt} className="text-xs text-neutral-600">{formatRelativeTime(notice.createdAt)}</time>
                    </span>
                    {gpsContext && <span className="mt-2 block text-sm font-medium text-neutral-700">{gpsContext}</span>}
                    <span className="mt-2 block break-words text-sm leading-relaxed text-neutral-700">{followup ? 'Situación registrada al evaluar: ' : ''}{notice.mensaje}</span>
                    {followup && <span className="mt-2 block text-sm font-semibold text-primary-800">{followup}</span>}
                    {linked && <span className="mt-2 block text-sm font-semibold text-primary-800">{otherActivity ? `Ver aviso para ${otherActivity} →` : notificationActionLabel(path, notice)}</span>}
                  </span>
                </Content>
                <button type="button" aria-label={'Opciones del aviso: ' + title} aria-expanded={noticeOptions === notice.id}
                  onClick={() => setNoticeOptions(value => value === notice.id ? null : notice.id)}
                  className={'m-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 ' + focus}>
                  <MoreHorizontal size={20} aria-hidden="true" />
                </button>
                </div>
                {noticeOptions === notice.id && <div aria-label={'Acciones del aviso: ' + title} className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                  {!notice.leida && (
                    <button type="button" aria-label={'Marcar como leída: ' + title} disabled={mutationPending}
                      onClick={() => { resetMutationErrors(); mark.mutate(notice.id); }}
                      className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60 ' + focus}>
                      <Check size={16} aria-hidden="true" />Marcar leída
                    </button>
                  )}
                  <button type="button" aria-label={'Eliminar aviso: ' + title} disabled={mutationPending}
                    onClick={() => { resetMutationErrors(); remove.mutate(notice.id); }}
                    className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-error-50 hover:text-error-800 disabled:opacity-60 ' + focus}>
                    <Trash2 size={16} aria-hidden="true" />Eliminar
                  </button>
                </div>}
              </li>
            );
          })}
        </ul>
      ) : null}

      {data && data.total > 0 && (
        <nav aria-label="Paginación de avisos" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700">{data.total} avisos{unreadOnly ? ' sin leer' : ''} · Página {page} de {lastPage}</p>
          <div className="flex gap-2">
            <Button variant="outline" aria-label="Página anterior" disabled={page <= 1 || isPending} onClick={() => changePage(page - 1)}>Anterior</Button>
            <Button variant="outline" aria-label="Siguiente página" disabled={page >= lastPage || isPending} onClick={() => changePage(page + 1)}>Siguiente</Button>
          </div>
        </nav>
      )}
    </div>
  );
};
export default NotificacionesPage;

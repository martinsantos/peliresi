/**
 * SITREP v6 - Centro de notificaciones del usuario.
 * Una bandeja paginada; los estados y contadores provienen de la API.
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, FileText, Info, ClipboardCheck, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas, useEliminarNotificacion } from '../../hooks/useNotificaciones';
import { formatRelativeTime } from '../../utils/formatters';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { resolveNotificationPath } from '../../utils/notificationNavigation';
import { notificationFollowup } from '../../utils/notificationFollowup';
import type { Notificacion } from '../../types/models';

const PAGE_SIZE = 20;
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700';

const NotificacionesPage: React.FC = () => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
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
    if (!notice.leida) mark.mutate(notice.id);
    // Opening the expediente must not depend on a successful acknowledgement.
    navigate(resolveNotificationPath(notice, mp('')));
  };

  return (
    <div className="space-y-4" data-testid="notification-inbox">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" aria-label="Volver" onClick={() => navigate(-1)}
            className={'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 md:hidden ' + focus}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="text-2xl font-bold text-neutral-900">Notificaciones</h2>
        </div>
        {data && data.noLeidas > 0 && (
          <Button variant="outline" leftIcon={<CheckCheck size={18} />} isLoading={markAll.isPending}
            disabled={mutationPending} onClick={() => { resetMutationErrors(); markAll.mutate(); }}>
            Marcar todas leídas
          </Button>
        )}
      </header>

      <nav aria-label="Filtrar avisos" className="flex gap-2 border-b border-neutral-200">
        <button type="button" aria-pressed={!unreadOnly} onClick={() => changeFilter(false)}
          className={'min-h-11 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ' + focus + (!unreadOnly ? ' border-primary-700 text-primary-800' : ' border-transparent text-neutral-700 hover:bg-neutral-50')}>
          Todas
        </button>
        <button type="button" aria-pressed={unreadOnly} onClick={() => changeFilter(true)}
          aria-label={'No leídas' + (data ? ' (' + data.noLeidas + ')' : '')}
          className={'min-h-11 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ' + focus + (unreadOnly ? ' border-primary-700 text-primary-800' : ' border-transparent text-neutral-700 hover:bg-neutral-50')}>
          No leídas {data && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-800">{data.noLeidas}</span>}
        </button>
      </nav>

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
          <h3 className="font-semibold text-neutral-900">No hay notificaciones</h3>
          <p className="mt-1 text-sm text-neutral-700">{unreadOnly ? 'Todas las notificaciones han sido leídas.' : 'Todavía no recibiste avisos.'}</p>
        </div>
      ) : items.length > 0 ? (
        <ul aria-label="Avisos" className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {items.map(notice => {
            const followup = notificationFollowup(notice);
            const path = resolveNotificationPath(notice, mp(''));
            const linked = path !== mp('/notificaciones');
            const Content = linked ? 'button' : 'div';
            const warning = /RECHAZ|INCIDENTE|ANOMALIA|VENCIMIENTO|ALERTA/.test(notice.tipo);
            const success = /TRATADO|RECIBIDO/.test(notice.tipo);
            const Icon = warning ? AlertTriangle : path.includes('/inspecciones/') ? ClipboardCheck : success ? CheckCircle2 : notice.manifiestoId ? FileText : Info;
            return (
              <li key={notice.id} className={notice.leida ? '' : 'bg-primary-50/40'}>
                <Content type={linked ? 'button' : undefined} aria-label={linked ? 'Abrir aviso: ' + (followup ? 'Seguimiento de manifiesto' : notice.titulo) : undefined} onClick={linked ? () => open(notice) : undefined}
                  className={'flex w-full items-start gap-3 p-4 text-left text-neutral-900 ' + (linked ? 'transition-colors hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-offset-[-2px] ' + focus : '')}>
                  <Icon size={20} aria-hidden="true" className={'mt-1 shrink-0 ' + (warning ? 'text-warning-800' : 'text-primary-800')} />
                  <span className="min-w-0 flex-1">
                    <span className={'block break-words text-base leading-snug ' + (notice.leida ? 'font-medium' : 'font-semibold')}>{followup ? 'Seguimiento de manifiesto' : notice.titulo}</span>
                    {!notice.leida && <span className="mt-1 block text-xs font-semibold text-primary-800">Sin leer</span>}
                    {(notice.prioridad === 'ALTA' || notice.prioridad === 'URGENTE') && (
                      <Badge variant="soft" color="error" className="mt-1">{notice.prioridad === 'URGENTE' ? 'Urgente' : 'Prioridad alta'}</Badge>
                    )}
                    <span className="mt-2 block break-words text-sm leading-relaxed text-neutral-700">{followup ? 'Situación registrada al evaluar: ' : ''}{notice.mensaje}</span>
                    {followup && <span className="mt-2 block text-sm font-semibold text-primary-800">{followup}</span>}
                    <time dateTime={notice.createdAt} className="mt-2 block text-xs text-neutral-600">{formatRelativeTime(notice.createdAt)}</time>
                  </span>
                  {linked && <ChevronRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-neutral-600" />}
                </Content>
                <div className="flex flex-wrap justify-end gap-2 px-4 pb-3">
                  {!notice.leida && (
                    <button type="button" aria-label={'Marcar como leída: ' + notice.titulo} disabled={mutationPending}
                      onClick={() => { resetMutationErrors(); mark.mutate(notice.id); }}
                      className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60 ' + focus}>
                      <Check size={16} aria-hidden="true" />Marcar leída
                    </button>
                  )}
                  <button type="button" aria-label={'Eliminar aviso: ' + notice.titulo} disabled={mutationPending}
                    onClick={() => { resetMutationErrors(); remove.mutate(notice.id); }}
                    className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-error-50 hover:text-error-800 disabled:opacity-60 ' + focus}>
                    <Trash2 size={16} aria-hidden="true" />Eliminar
                  </button>
                </div>
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

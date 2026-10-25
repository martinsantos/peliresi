import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { resolveNotificationPath, notificationActionLabel } from '../../utils/notificationNavigation';
import type { Notificacion } from '../../types/models';
import { Button } from '../../components/ui/ButtonV2';

/** No acknowledgement or business mutation on opening a mail (including link scanners). */
export default function AvisoPage() {
  const { id } = useParams(); const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const query = useQuery({ queryKey: ['notificaciones', 'detail', currentUser?.id, id],
    queryFn: async () => (await api.get('/notificaciones/' + encodeURIComponent(id || ''))).data.data as Notificacion,
    retry: false, staleTime: 0 });
  const notice = !query.isError && !query.isPending ? query.data : undefined;
  const target = notice ? resolveNotificationPath(notice, '', currentUser?.rol) : '/notificaciones';
  return <section className="mx-auto max-w-2xl space-y-4" aria-label="Aviso recibido">
    <Link className="inline-flex min-h-11 items-center gap-2 text-primary-800 underline" to={mp('/notificaciones')}><ArrowLeft size={18} aria-hidden="true" />Volver a Avisos</Link>
    {query.isPending && <p role="status">Buscando tu aviso…</p>}
    {query.isError && <div role="alert" className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <p>No se pudo abrir este aviso. Ingresá con la cuenta que recibió el correo. Si el aviso fue eliminado, consultá el trámite desde tus listados.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>
    </div>}
    {notice && <article className="rounded-xl border border-primary-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-semibold">{notice.titulo}</h2><p className="whitespace-pre-wrap break-words">{notice.mensaje}</p>
      <p className="text-sm text-neutral-600">Aviso del {new Date(notice.createdAt).toLocaleString('es-AR')}. Consultá el estado actual antes de actuar.</p>
      {target !== '/notificaciones' && target !== '/notificaciones/' + id && <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white" to={mp(target)}>{notificationActionLabel(target)}<ArrowRight size={18} aria-hidden="true" /></Link>}
    </article>}
  </section>;
}

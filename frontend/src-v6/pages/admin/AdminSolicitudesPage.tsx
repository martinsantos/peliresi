import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { QueryContent } from '../../components/ui/QueryContent';
import { ReviewPagination } from '../../components/registration/ReviewPagination';
import { AdmissionTabs } from '../../components/registration/AdmissionTabs';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { ACTOR_NAMES, APPLICATION_STATES, applicantName } from '../../utils/admissionReview';
import type { EstadoSolicitud } from '../../types/api';

export default function AdminSolicitudesPage() {
  const { owner, actorType } = useAdmissionContext();
  const [params, setParams] = useScopedSearchParams('admin-applications', ['estado', 'tipoActor', 'search', 'page'], owner);
  const location = useLocation(), mp = useMobilePrefix();
  const estado = params.get('estado') || '', tipoActor = actorType || params.get('tipoActor') || '', search = params.get('search') || '';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const query = useSolicitudes({ estado: (estado || undefined) as EstadoSolicitud | undefined, tipoActor: tipoActor || undefined, search: search || undefined, page, limit: 20 });
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); setParams(next); };
  return <div className="space-y-4">
    <AdmissionTabs active="solicitudes" />
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
      <div className="space-y-1"><label htmlFor="application-search" className="block text-sm font-medium text-neutral-700">Nombre o correo del solicitante</label><input id="application-search" type="search" value={search} onChange={e => change('search', e.target.value)} className="min-h-11 w-full rounded-lg border border-neutral-300 px-3" /></div>
      <NativeSelect label="Estado" value={estado} onChange={value => change('estado', value)}><option value="">Todos los estados</option>{Object.entries(APPLICATION_STATES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</NativeSelect>
      {!actorType ? <NativeSelect label="Actividad" value={tipoActor} onChange={value => change('tipoActor', value)}><option value="">Todas las actividades</option>{Object.entries(ACTOR_NAMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</NativeSelect> : <p className="self-end py-3 text-sm text-neutral-600">{ACTOR_NAMES[actorType]} · tu área de revisión</p>}
    </div>
    <QueryContent query={query} loading="Cargando solicitudes" error="No pudimos consultar las solicitudes. Tus filtros se conservan." retryLabel="Reintentar solicitudes">
      {!query.data?.items.length && <p className="rounded-xl border border-neutral-200 bg-white p-4">No hay solicitudes con estos filtros.</p>}
      {!!query.data?.items.length && <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {query.data.items.map(s => {
          const status = APPLICATION_STATES[s.estado];
          return <Link key={s.id} to={mp('/admin/solicitudes/' + s.id)} state={{ ...location.state, admissionReturn: { owner, path: location.pathname + location.search } }} className="group grid min-h-11 gap-2 p-4 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center" aria-label={`Revisar ${applicantName(s)}`}>
            <div className="min-w-0"><p className="font-semibold text-neutral-900 [overflow-wrap:anywhere]">{applicantName(s)}</p><p className="text-sm text-neutral-600 [overflow-wrap:anywhere]">{ACTOR_NAMES[s.tipoActor]} · {s.usuario?.email}</p></div>
            <div className="space-y-1"><Badge variant="soft" color={status?.color || 'neutral'}>{status?.label || 'Estado no disponible'}</Badge><p className="text-sm text-neutral-600">{status?.next || 'Abrí la solicitud para consultar'}</p></div>
            <span className="flex items-center justify-end gap-2 text-sm text-primary-800">Revisar<ArrowRight size={18} aria-hidden="true" /></span>
          </Link>;
        })}
      </div>}
      <ReviewPagination page={page} pages={query.data?.totalPages || 1} total={query.data?.total || 0} onPage={p => change('page', String(p))} />
    </QueryContent>
  </div>;
}

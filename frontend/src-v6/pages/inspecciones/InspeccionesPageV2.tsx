import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, MapPin, Plus, Search, UserRound, X } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { useInspections, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import type { InspectionActorType, InspectionState } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';
import { downloadCsv } from '../../utils/exportCsv';
import { INSPECTION_ACTOR_LABELS, INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionDate, inspectionErrorMessage, inspectionRelevantDate } from './inspectionPresentation';

const isActorType = (value: string | null): value is InspectionActorType => value === 'GENERADOR' || value === 'TRANSPORTISTA' || value === 'OPERADOR';

const InspeccionesPageV2: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = location.pathname.startsWith('/mobile');
  const { currentUser, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = isActorType(searchParams.get('tipoActor')) ? searchParams.get('tipoActor') as InspectionActorType : '';
  const initialActor = searchParams.get('actorId') || '';
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [state, setState] = useState<InspectionState | ''>((searchParams.get('estado') || '') as InspectionState | '');
  const [typeFilter, setTypeFilter] = useState<InspectionActorType | ''>(initialType);
  const [actorFilter, setActorFilter] = useState(initialActor);
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<InspectionActorType>(initialType || 'GENERADOR');
  const [actorId, setActorId] = useState(initialActor);
  const [numeroActa, setNumeroActa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [exporting, setExporting] = useState(false);

  const allowed = Boolean(isAdmin || currentUser?.esInspector || currentUser?.rol.startsWith('ADMIN_'));
  const inspections = useInspections({ estado: state || undefined, tipoActor: typeFilter || undefined, actorId: actorFilter || undefined, search: search || undefined, page, limit: 25 });
  const generadores = useCatalogoGeneradores();
  const transportistas = useCatalogoTransportistas();
  const operadores = useCatalogoOperadores();
  const actorOptions = useMemo(() => type === 'GENERADOR' ? generadores.data || [] : type === 'TRANSPORTISTA' ? transportistas.data || [] : operadores.data || [], [type, generadores.data, transportistas.data, operadores.data]);
  const filteredActorName = useMemo(() => {
    if (!actorFilter || !typeFilter) return '';
    const source = typeFilter === 'GENERADOR' ? generadores.data : typeFilter === 'TRANSPORTISTA' ? transportistas.data : operadores.data;
    const actor = source?.find((item) => String(item.id) === actorFilter);
    return String(actor?.razonSocial || actor?.nombre || 'Actor seleccionado');
  }, [actorFilter, typeFilter, generadores.data, transportistas.data, operadores.data]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (state) next.set('estado', state);
    if (typeFilter) next.set('tipoActor', typeFilter);
    if (actorFilter) next.set('actorId', actorFilter);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [search, state, typeFilter, actorFilter, page, setSearchParams]);

  const createMutation = useInspectionMutation(async () => inspeccionService.create({ tipoActor: type, actorId, numeroActa: numeroActa || undefined, ubicacion: ubicacion || undefined, fechaProgramada: fechaProgramada ? new Date(fechaProgramada).toISOString() : undefined }));

  const createInspection = async () => {
    if (!actorId) return toast.warning('Actor requerido', 'Seleccione la entidad que se inspeccionará.');
    try {
      const created = await createMutation.mutateAsync(undefined) as Awaited<ReturnType<typeof inspeccionService.create>>;
      toast.success('Inspección creada', `${created.numero} quedó en borrador.`);
      navigate(`${mobile ? '/mobile' : ''}/inspecciones/${created.id}`);
    } catch (error: unknown) { toast.error('No se pudo crear', inspectionErrorMessage(error, 'Revise los datos e intente nuevamente.')); }
  };

  const exportList = async () => {
    setExporting(true);
    try {
      const result = await inspeccionService.list({ estado: state || undefined, tipoActor: typeFilter || undefined, actorId: actorFilter || undefined, search: search || undefined, limit: 100 });
      downloadCsv(result.items.map((inspection) => {
        const actor = inspectionActor(inspection);
        return {
          Expediente: inspection.numero, Acta: inspection.numeroActa || '', Estado: INSPECTION_STATE_LABELS[inspection.estado], Tipo_actor: INSPECTION_ACTOR_LABELS[inspection.tipoActor], Actor: actor?.razonSocial || '', CUIT: actor?.cuit || '',
          Fecha_programada: inspectionDate(inspection.fechaProgramada), Inicio_campo: inspectionDate(inspection.iniciadaAt, true), Inspector: `${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim(), Ubicacion: inspection.ubicacion || '', Evidencias: inspection._count?.evidencias || 0, Eventos: inspection._count?.eventos || 0, Actualizada: inspectionDate(inspection.updatedAt, true),
        };
      }), `inspecciones_${new Date().toISOString().slice(0, 10)}`, { titulo: 'Listado de inspecciones', filtros: [state && INSPECTION_STATE_LABELS[state], typeFilter && INSPECTION_ACTOR_LABELS[typeFilter], filteredActorName, search].filter(Boolean).join(' · ') || 'Todos', total: result.total });
      if (result.total > 100) toast.warning('Exportación parcial', 'Se exportaron los primeros 100 resultados del filtro actual.');
      else toast.success('Listado exportado', `${result.total} inspecciones incluidas.`);
    } catch { toast.error('No se pudo exportar', 'Volvé a intentar con los filtros actuales.'); } finally { setExporting(false); }
  };

  if (!allowed) return <Card className="mx-auto max-w-xl text-center"><ClipboardCheck className="mx-auto text-neutral-400" size={36} /><h2 className="mt-4 text-xl font-bold text-neutral-900">Acceso reservado a inspecciones</h2><p className="mt-2 text-sm text-neutral-600">Su cuenta no tiene el perfil inspector habilitado.</p></Card>;

  const rows = inspections.data?.items || [];
  const stateCounts = inspections.data?.summary?.byState || {};
  const inField = stateCounts.EN_CAMPO || 0;
  const pendingReview = stateCounts.EN_REVISION || 0;
  const deadlines = inspections.data?.summary?.openDeadlines || 0;
  const totalPages = inspections.data?.totalPages || 1;

  return <div className="space-y-5 animate-fade-in">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><ClipboardCheck size={23} /></div><div><h2 className="text-2xl font-bold tracking-tight text-neutral-950">Inspecciones</h2><p className="text-sm text-neutral-600">Expedientes de campo, revisión, descargo y cierre.</p></div></div>
      <div className="flex flex-col gap-2 sm:flex-row"><Button className="w-full sm:w-auto" variant="outline" leftIcon={<FileDown size={17} />} isLoading={exporting} onClick={exportList}>Exportar listado</Button><Button className="w-full sm:w-auto" leftIcon={<Plus size={17} />} onClick={() => setShowCreate(true)}>Nueva inspección</Button></div>
    </header>

    {actorFilter && typeFilter && <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Historial cruzado</p><p className="font-bold text-primary-950">{filteredActorName} · {INSPECTION_ACTOR_LABELS[typeFilter]}</p></div><Button variant="outline" size="sm" onClick={() => { setActorFilter(''); setTypeFilter(''); setPage(1); }}>Ver todos los actores</Button></div>}

    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <button onClick={() => { setState(state === 'EN_CAMPO' ? '' : 'EN_CAMPO'); setPage(1); }} className={`min-h-24 rounded-xl border bg-white p-3 text-left transition sm:min-h-0 sm:p-4 ${state === 'EN_CAMPO' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-neutral-200 hover:border-primary-300'}`}><p className="text-xs leading-tight text-neutral-500 sm:text-sm">En campo</p><p className="mt-2 text-2xl font-bold text-primary-700">{inField}</p></button>
      <button onClick={() => { setState(state === 'EN_REVISION' ? '' : 'EN_REVISION'); setPage(1); }} className={`min-h-24 rounded-xl border bg-white p-3 text-left transition sm:min-h-0 sm:p-4 ${state === 'EN_REVISION' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-neutral-200 hover:border-amber-300'}`}><p className="text-xs leading-tight text-neutral-500 sm:text-sm">Pendientes de revisión</p><p className="mt-2 text-2xl font-bold text-amber-700">{pendingReview}</p></button>
      <div className="min-h-24 rounded-xl border border-neutral-200 bg-white p-3 sm:min-h-0 sm:p-4"><p className="text-xs leading-tight text-neutral-500 sm:text-sm">Con plazo abierto</p><p className="mt-2 text-2xl font-bold text-blue-700">{deadlines}</p></div>
    </div>

    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-[minmax(240px,1fr)_220px_190px]">
      <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por expediente, acta o actor" className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" /></label>
      <select value={state} onChange={(event) => { setState(event.target.value as InspectionState | ''); setPage(1); }} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">Todos los estados</option>{Object.entries(INSPECTION_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as InspectionActorType | ''); setActorFilter(''); setPage(1); }} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">Todos los actores</option>{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>

    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="hidden grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 lg:grid"><span>Expediente / fecha</span><span>Actor inspeccionado</span><span>Inspector / ubicación</span><span>Estado</span><span>Actividad</span></div>
      {inspections.isLoading ? <p className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones…</p> : rows.length === 0 ? <div className="p-10 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={40} /><p className="mt-3 font-semibold text-neutral-800">No hay inspecciones para estos filtros</p><p className="mt-1 text-sm text-neutral-500">Ajustá la búsqueda o creá un nuevo expediente.</p></div> : rows.map((inspection) => {
        const actor = inspectionActor(inspection); const dateValue = inspectionRelevantDate(inspection);
        const inspectionRoute = `${mobile ? '/mobile' : ''}/inspecciones/${inspection.id}`;
        return <Link key={inspection.id} to={inspectionRoute} aria-label={`Abrir expediente ${inspection.numero}`} data-testid={`inspection-row-${inspection.id}`} className="group grid w-full cursor-pointer grid-cols-1 gap-3 border-b border-neutral-100 p-4 text-left transition-colors last:border-0 hover:bg-primary-50/40 active:bg-primary-100/60 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 lg:grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] lg:items-center lg:gap-4 lg:px-5">
          <div><div className="flex items-center justify-between gap-3 lg:block"><span className="font-extrabold text-[#10213A]">{inspection.numero}</span><Badge className="lg:hidden" color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge></div><p className="mt-1 text-xs text-neutral-500">Acta {inspection.numeroActa || 'sin numerar'}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-700"><CalendarDays size={14} className="text-neutral-400" />{inspectionDate(dateValue)}</p></div>
          <div>{actor ? <p className="font-semibold text-[#10213A]">{actor.razonSocial}</p> : <p className="font-semibold text-neutral-900">Actor no disponible</p>}<p className="mt-1 text-xs text-neutral-500">{INSPECTION_ACTOR_LABELS[inspection.tipoActor]} · CUIT {actor?.cuit || 's/d'}</p></div>
          <div className="space-y-1.5 text-sm text-neutral-600"><p className="flex items-center gap-2"><UserRound size={15} className="shrink-0 text-neutral-400" />{inspection.inspector.nombre} {inspection.inspector.apellido || ''}</p><p className="flex items-center gap-2 text-xs text-neutral-500"><MapPin size={14} className="shrink-0" /><span className="line-clamp-2">{inspection.ubicacion || 'Sin ubicación'}</span></p></div>
          <div className="hidden lg:block"><Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge>{inspection.plazoRespuestaAt && <p className="mt-2 text-xs text-neutral-500">Plazo: {inspectionDate(inspection.plazoRespuestaAt)}</p>}</div>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500 lg:block lg:border-0 lg:pt-0 lg:text-right"><span>{inspection._count?.evidencias || 0} evidencias</span><span className="lg:mt-1 lg:block">{inspection._count?.eventos || 0} eventos</span><span aria-hidden="true" className="rounded-md text-neutral-400 transition-colors group-hover:text-primary-700 lg:ml-auto lg:mt-1 lg:inline-flex lg:p-1"><ChevronRight size={17} /></span></div>
        </Link>;
      })}
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-neutral-600">{inspections.data?.total || 0} resultados · página {page} de {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" leftIcon={<ChevronLeft size={16} />} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button><Button variant="outline" size="sm" rightIcon={<ChevronRight size={16} />} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div></div>

    {showCreate && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5" onClick={() => setShowCreate(false)}><section role="dialog" aria-modal="true" aria-labelledby="new-inspection-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h3 id="new-inspection-title" className="text-xl font-bold text-neutral-950">Nueva inspección</h3><p className="mt-1 text-sm text-neutral-600">Se crea un expediente vinculado al actor y su declaración vigente.</p></div><button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Cerrar"><X size={20} /></button></div><div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-neutral-800">Tipo de actor<select value={type} onChange={(event) => { setType(event.target.value as InspectionActorType); setActorId(''); }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold text-neutral-800">Actor inspeccionado<select value={actorId} onChange={(event) => setActorId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal"><option value="">Seleccionar actor…</option>{actorOptions.map((actor) => <option key={String(actor.id)} value={String(actor.id)}>{String(actor.razonSocial || actor.nombre || actor.id)}</option>)}</select></label><label className="text-sm font-semibold text-neutral-800">Número de acta<input value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Opcional al iniciar" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label><label className="text-sm font-semibold text-neutral-800">Fecha programada<div className="relative mt-2"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} /><input type="datetime-local" value={fechaProgramada} onChange={(event) => setFechaProgramada(event.target.value)} className="h-11 w-full rounded-lg border border-neutral-300 pl-10 pr-3 font-normal" /></div></label><label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Ubicación prevista<div className="relative mt-2"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} /><input value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Domicilio o referencia" className="h-11 w-full rounded-lg border border-neutral-300 pl-10 pr-3 font-normal" /></div></label></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button isLoading={createMutation.isPending} leftIcon={<Camera size={17} />} onClick={createInspection}>Crear expediente</Button></div></section></div>}
  </div>;
};

export default InspeccionesPageV2;

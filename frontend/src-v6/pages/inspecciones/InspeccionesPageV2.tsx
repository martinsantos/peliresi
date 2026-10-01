import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, MapPin, Plus, Search, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { useInspections, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import { readInspectionResume } from '../../services/inspectionResume';
import type { InspectionActorType, InspectionState, InspectionType } from '../../types/inspection';
import { inspectionActor, INSPECTION_TYPES, inspectionTypeOf, inspectionNumberExample } from '../../types/inspection';
import { downloadCsv } from '../../utils/exportCsv';
import { INSPECTION_ACTOR_LABELS, INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionActorRoute, inspectionDate, inspectionErrorMessage, inspectionRelevantDate, isTrainingActNumber } from './inspectionPresentation';
import { InspectorSelect } from './InspectorSelect';
import { InspectionOperationsPanel } from './InspectionOperationsPanel';
import { useConnectivity } from '../../hooks/useConnectivity';
import { SpontaneousFindingPanel } from './SpontaneousFindingPanel';

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
  const [inspectionFilter, setInspectionFilter] = useState<InspectionType | ''>(() => { const value = searchParams.get('tipoInspeccion'); return value && Object.hasOwn(INSPECTION_TYPES, value) ? value as InspectionType : ''; });
  const [actorFilter, setActorFilter] = useState(initialActor);
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));
  const [showCreate, setShowCreate] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [type, setType] = useState<InspectionActorType>(initialType || (currentUser?.rol === 'ADMIN_OPERADOR' ? 'OPERADOR' : currentUser?.rol === 'ADMIN_TRANSPORTISTA' ? 'TRANSPORTISTA' : 'GENERADOR'));
  const [actorId, setActorId] = useState(initialActor);
  const [withoutActor, setWithoutActor] = useState(false);
  const [inspectionType, setInspectionType] = useState<InspectionType>(initialType || (currentUser?.rol === 'ADMIN_OPERADOR' ? 'OPERADOR' : currentUser?.rol === 'ADMIN_TRANSPORTISTA' ? 'TRANSPORTISTA' : 'GENERADOR'));
  const [description, setDescription] = useState('');
  const actorInspection = isActorType(inspectionType);
  const availableTypes = (Object.keys(INSPECTION_TYPES) as InspectionType[]).filter((key) => !currentUser?.rol.startsWith('ADMIN_') || currentUser.rol === `ADMIN_${key}`);
  const [assignedInspector, setAssignedInspector] = useState('');
  const [creationId, setCreationId] = useState(() => crypto.randomUUID());
  const [numeroActa, setNumeroActa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [exporting, setExporting] = useState(false);
  const [findingActorType, setFindingActorType] = useState<InspectionActorType>();
  const { isOnline } = useConnectivity({ enablePing: false, debounceMs: 0 });
  const [findingRequest, setFindingRequest] = useState(0);

  const allowed = Boolean(isAdmin || currentUser?.esInspector || currentUser?.rol.startsWith('ADMIN_'));
  const inspections = useInspections({ estado: state || undefined, tipoInspeccion: inspectionFilter || undefined, tipoActor: typeFilter || undefined, actorId: actorFilter || undefined, search: search || undefined, page, limit: 25 });
  const generadores = useCatalogoGeneradores((showCreate && type === 'GENERADOR') || findingActorType === 'GENERADOR' || Boolean(actorFilter && typeFilter === 'GENERADOR'));
  const transportistas = useCatalogoTransportistas((showCreate && type === 'TRANSPORTISTA') || findingActorType === 'TRANSPORTISTA' || Boolean(actorFilter && typeFilter === 'TRANSPORTISTA'));
  const operadores = useCatalogoOperadores((showCreate && type === 'OPERADOR') || findingActorType === 'OPERADOR' || Boolean(actorFilter && typeFilter === 'OPERADOR'));
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
    if (inspectionFilter) next.set('tipoInspeccion', inspectionFilter);
    if (actorFilter) next.set('actorId', actorFilter);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [search, state, typeFilter, inspectionFilter, actorFilter, page, setSearchParams]);

  const createMutation = useInspectionMutation(async () => inspeccionService.create({ clienteId: creationId, tipoInspeccion: inspectionType, observaciones: description || undefined, tipoActor: withoutActor ? null : type, actorId: withoutActor ? null : actorId, inspectorId: assignedInspector || undefined, numeroActa: numeroActa || undefined, ubicacion: ubicacion || undefined, fechaProgramada: fechaProgramada ? new Date(fechaProgramada).toISOString() : undefined }));

  const createInspection = async () => {
    if (!withoutActor && !actorId) return toast.warning('Actor requerido', 'Seleccione la entidad que se inspeccionará.');
    try {
      const created = await createMutation.mutateAsync(undefined) as Awaited<ReturnType<typeof inspeccionService.create>>;
      toast.success('Inspección creada', `${created.numero} · ${INSPECTION_STATE_LABELS[created.estado]}.`);
      setCreationId(crypto.randomUUID());
      navigate(`${mobile ? '/mobile' : ''}/inspecciones/${created.id}`);
    } catch (error: unknown) { toast.error('No se pudo crear', inspectionErrorMessage(error, 'Revise los datos e intente nuevamente.')); }
  };

  const exportList = async () => {
    setExporting(true);
    try {
      const result = await inspeccionService.list({ estado: state || undefined, tipoInspeccion: inspectionFilter || undefined, tipoActor: typeFilter || undefined, actorId: actorFilter || undefined, search: search || undefined, limit: 100 });
      downloadCsv(result.items.map((inspection) => {
        const actor = inspectionActor(inspection);
        return {
          Expediente: inspection.numero, Tipo_inspeccion: INSPECTION_TYPES[inspectionTypeOf(inspection)].label, Acta: inspection.numeroActa || '', Estado: INSPECTION_STATE_LABELS[inspection.estado], Tipo_actor: (inspection.tipoActor ? INSPECTION_ACTOR_LABELS[inspection.tipoActor] : 'Sin identificar'), Actor: actor?.razonSocial || '', CUIT: actor?.cuit || '',
          Fecha_programada: inspectionDate(inspection.fechaProgramada), Inicio_campo: inspectionDate(inspection.iniciadaAt, true), Inspector: `${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim(), Ubicacion: inspection.ubicacion || '', Evidencias: inspection._count?.evidencias || 0, Eventos: inspection._count?.eventos || 0, Actualizada: inspectionDate(inspection.updatedAt, true),
        };
      }), `inspecciones_${new Date().toISOString().slice(0, 10)}`, { titulo: 'Listado de inspecciones', filtros: [state && INSPECTION_STATE_LABELS[state], typeFilter && INSPECTION_ACTOR_LABELS[typeFilter], inspectionFilter && INSPECTION_TYPES[inspectionFilter].label, filteredActorName, search].filter(Boolean).join(' · ') || 'Todos', total: result.total });
      if (result.total > 100) toast.warning('Exportación parcial', 'Se exportaron los primeros 100 resultados del filtro actual.');
      else toast.success('Listado exportado', `${result.total} inspecciones incluidas.`);
    } catch { toast.error('No se pudo exportar', 'Volvé a intentar con los filtros actuales.'); } finally { setExporting(false); }
  };

  if (!allowed) return <Card className="mx-auto max-w-xl text-center"><ClipboardCheck className="mx-auto text-neutral-400" size={36} /><h2 className="mt-4 text-xl font-bold text-neutral-900">Acceso reservado a inspecciones</h2><p className="mt-2 text-sm text-neutral-600">Su cuenta no tiene el perfil inspector habilitado.</p></Card>;

  const rows = inspections.data?.items || [];
  const offline = Boolean(inspections.data?.offline);
  const totalsUnknown = offline || inspections.isError;
  const stateCounts = inspections.data?.summary?.byState || {};
  const inField = stateCounts.EN_CAMPO || 0;
  const pendingReview = stateCounts.EN_REVISION || 0;
  const deadlines = inspections.data?.summary?.openDeadlines || 0;
  const totalPages = inspections.data?.totalPages || 1;
  const resumeInspection = rows.filter((row) => row.estado === 'EN_CAMPO' && String(row.inspectorId || row.inspector?.id) === String(currentUser?.id)).sort((left, right) => (readInspectionResume(currentUser!.id, right.id)?.updatedAt || 0) - (readInspectionResume(currentUser!.id, left.id)?.updatedAt || 0))[0];
  const resumePoint = resumeInspection && currentUser ? readInspectionResume(currentUser.id, resumeInspection.id) : null;

  return <div className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold text-neutral-900">Inspecciones</h2>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setFindingRequest((value) => value + 1)}>Denuncia / hallazgo</Button><Button size="sm" leftIcon={<Plus size={16} />} disabled={offline || inspections.isError} onClick={() => setShowCreate(true)}>Nueva inspección</Button></div>
    </header>

    {resumeInspection && <Link data-testid="inspection-resume-task" aria-label="Continuar mi inspección en campo" to={`${mobile ? '/mobile' : ''}/inspecciones/${resumeInspection.id}${resumePoint?.hash || '#checklist'}`} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border-l-4 border-primary-600 bg-primary-50 px-4 py-3 !no-underline hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><div className="min-w-0"><p className="text-xs font-semibold text-primary-800">En campo · {resumeInspection.numero}</p><h3 className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{inspectionActor(resumeInspection)?.razonSocial || 'Inspección en curso'}</h3>{resumePoint && <p className="mt-0.5 text-xs text-neutral-600">Retomá en {resumePoint.label}</p>}</div><span className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary-800"><span className="sr-only sm:not-sr-only">Continuar inspección</span><ChevronRight size={20} /></span></Link>}


    {offline && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-bold">Sin conexión · copias de este dispositivo</p><p className="mt-1">Sólo aparecen expedientes que abriste aquí antes. Los cambios y las fotos pendientes siguen sin confirmar en el servidor.</p><button type="button" onClick={() => void inspections.refetch()} className="mt-2 min-h-10 font-semibold underline underline-offset-2">Reintentar conexión</button></div>}
    {inspections.isError && rows.length > 0 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">No se pudo actualizar el listado. Estos resultados pueden estar desactualizados. <button type="button" onClick={() => void inspections.refetch()} className="font-bold underline underline-offset-2">Reintentar</button></div>}

    {actorFilter && typeFilter && <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Historial cruzado</p><p className="font-bold text-primary-950">{filteredActorName} · {INSPECTION_ACTOR_LABELS[typeFilter]}</p></div><Button variant="outline" size="sm" onClick={() => { setActorFilter(''); setTypeFilter(''); setPage(1); }}>Ver todos los actores</Button></div>}

    {currentUser?.id && <SpontaneousFindingPanel createRequest={findingRequest} hideTrigger userId={currentUser.id} online={!offline && isOnline && navigator.onLine} mobile={mobile} onActorTypeNeeded={setFindingActorType} actors={{ GENERADOR: generadores.data || [], TRANSPORTISTA: transportistas.data || [], OPERADOR: operadores.data || [] }} />}

    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 text-sm [&>button]:shrink-0">
      <button className={state === '' && !agendaOpen ? 'min-h-11 font-semibold text-primary-800' : 'min-h-11 text-neutral-600'} onClick={() => { setState(''); setAgendaOpen(false); setPage(1); }}>Todas</button>
      <button className={state === 'EN_CAMPO' ? 'min-h-11 font-semibold text-primary-800' : 'min-h-11 text-neutral-600'} onClick={() => { setState('EN_CAMPO'); setAgendaOpen(false); setPage(1); }}>En campo <span className="ml-1 tabular-nums">{totalsUnknown ? '—' : inField}</span></button>
      <button className={state === 'EN_REVISION' ? 'min-h-11 font-semibold text-primary-800' : 'min-h-11 text-neutral-600'} onClick={() => { setState('EN_REVISION'); setAgendaOpen(false); setPage(1); }}>En revisión <span className="ml-1 tabular-nums">{totalsUnknown ? '—' : pendingReview}</span></button>
      <button aria-pressed={agendaOpen} className="min-h-11 text-neutral-600" onClick={() => setAgendaOpen((value) => !value)}>Agenda</button>
      <span className="hidden shrink-0 text-neutral-500 xl:inline">{totalsUnknown ? '—' : deadlines} con plazo abierto</span>
      <Button aria-label="Exportar" title="Exportar listado" className="ml-auto shrink-0 max-sm:w-11 max-sm:px-0" variant="ghost" size="sm" leftIcon={<FileDown size={16} />} isLoading={exporting} disabled={offline || inspections.isError} onClick={exportList}><span className="sr-only sm:not-sr-only">Exportar</span></Button>
    </div>
    {agendaOpen && <InspectionOperationsPanel />}
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E0E0DC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_190px_170px]">
      <label className="relative sm:col-span-2 lg:col-span-1"><span className="sr-only">Buscar inspección</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por expediente, acta o actor" className="h-11 w-full rounded-lg border border-neutral-400 bg-white pl-10 pr-3 text-base sm:text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" /></label>
      <select aria-label="Filtrar por estado" value={state} onChange={(event) => { setState(event.target.value as InspectionState | ''); setPage(1); }} className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-2 text-base sm:text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">Todos los estados</option>{Object.entries(INSPECTION_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Filtrar por tipo de inspección" value={inspectionFilter} onChange={(event) => { setInspectionFilter(event.target.value as InspectionType | ''); setTypeFilter(''); setActorFilter(''); setPage(1); }} className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-2 text-base sm:text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">Todos los tipos</option>{Object.entries(INSPECTION_TYPES).map(([value, type]) => <option key={value} value={value}>{type.label}</option>)}</select>
    </div>


    <div className="overflow-hidden rounded-xl border border-[#E0E0DC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="hidden grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] gap-4 border-b border-neutral-200 bg-[#F5F5F3] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 lg:grid"><span>Expediente / fecha</span><span>Actor inspeccionado</span><span>Inspector / ubicación</span><span>Estado</span><span>Actividad</span></div>
      {inspections.isLoading ? <p className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones…</p> : inspections.isError && rows.length === 0 ? <div role="alert" className="p-8 text-center"><p className="font-semibold text-error-800">No se pudo cargar el listado</p><p className="mt-1 text-sm text-neutral-600">No significa que no haya inspecciones. Comprobá la conexión y volvé a intentar.</p><Button variant="outline" className="mt-4" onClick={() => void inspections.refetch()}>Reintentar</Button></div> : rows.length === 0 ? <div className="p-10 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={40} /><p className="mt-3 font-semibold text-neutral-800">{offline ? 'No hay copias locales para estos filtros' : 'No hay inspecciones para estos filtros'}</p><p className="mt-1 text-sm text-neutral-500">{offline ? 'Con conexión, abrí el expediente una vez para dejarlo disponible en este dispositivo.' : 'Ajustá la búsqueda o creá un nuevo expediente.'}</p></div> : rows.map((inspection) => {
        const actor = inspectionActor(inspection); const dateValue = inspectionRelevantDate(inspection);
        const inspectionRoute = `${mobile ? '/mobile' : ''}/inspecciones/${inspection.id}`;
        const resume = currentUser?.id ? readInspectionResume(currentUser.id, inspection.id) : null;
        return <div key={inspection.id} onClick={(event) => { if (!(event.target as HTMLElement).closest('a,button,input')) navigate(inspectionRoute + (resume?.hash || '')); }} data-testid={`inspection-row-${inspection.id}`} className="group grid w-full min-w-0 cursor-pointer grid-cols-1 gap-2 border-b border-neutral-100 p-4 text-left transition-colors last:border-0 hover:bg-neutral-50/60 active:bg-neutral-100/60 focus-within:bg-neutral-50 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 lg:grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] lg:items-center lg:gap-4 lg:px-4 lg:py-2.5">
          <div><div className="flex flex-wrap items-center justify-between gap-2 lg:justify-start"><Link to={inspectionRoute + (resume?.hash || '')} aria-label={`${resume ? 'Retomar' : 'Abrir'} expediente ${inspection.numero}${resume ? ` en ${resume.label}` : ''}`} className="rounded font-mono text-sm font-semibold text-neutral-900 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500">{inspection.numero}</Link>{isTrainingActNumber(inspection.numeroActa) && <Badge color="warning">Capacitación</Badge>}<Badge className="lg:hidden" color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><CalendarDays size={14} className="text-neutral-400" />{inspectionDate(dateValue)}</p>{resume && <p className="mt-1 line-clamp-2 text-xs font-semibold text-primary-800">Retomar: {resume.label}</p>}</div>
          <div className="min-w-0">{actor ? <Link to={inspectionActorRoute(inspection.tipoActor, actor.id, mobile)} state={{ inspectionReturn: inspectionRoute }} aria-label={'Abrir ficha de ' + actor.razonSocial} className="inline-block max-w-full rounded text-sm font-medium text-neutral-700 hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">{actor.razonSocial}</Link> : <p className="font-semibold text-neutral-900">{INSPECTION_TYPES[inspectionTypeOf(inspection)].label}</p>}<p className="mt-1 text-xs text-neutral-500">{INSPECTION_TYPES[inspectionTypeOf(inspection)].label}{!inspection.tipoActor && ' · Sin responsable vinculado'}{actor?.cuit ? ` · CUIT ${actor.cuit}` : ''}</p></div>
          <div className="space-y-1.5 text-sm text-neutral-600"><p className="flex items-center gap-2"><UserRound size={15} className="shrink-0 text-neutral-400" />{inspection.inspector?.nombre || 'Sin asignar'} {inspection.inspector?.apellido || ''}</p><p className="flex items-center gap-2 text-xs text-neutral-500"><MapPin size={14} className="shrink-0" /><span className="line-clamp-2">{inspection.ubicacion || 'Sin ubicación'}</span></p></div>
          <div className="hidden lg:block"><Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge>{inspection.plazoRespuestaAt && <p className="mt-2 text-xs text-neutral-500">Plazo: {inspectionDate(inspection.plazoRespuestaAt)}</p>}</div>
          <div className="flex items-center justify-between gap-4 pt-1 text-xs text-neutral-500 lg:block lg:border-0 lg:pt-0 lg:text-right"><span>{inspection._count?.evidencias || 0} evidencias</span><span className="lg:mt-1 lg:block">{inspection._count?.eventos || 0} eventos</span><span aria-hidden="true" className="rounded-md text-neutral-400 transition-colors group-hover:text-primary-700 lg:ml-auto lg:mt-1 lg:inline-flex lg:p-1"><ChevronRight size={17} /></span></div>
        </div>;
      })}
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-neutral-600">{inspections.isError ? rows.length ? `${rows.length} resultados anteriores · sin actualizar` : 'Listado no disponible' : `${inspections.data?.total || 0} ${offline ? 'copias locales' : 'resultados'} · página ${page} de ${totalPages}`}</p><div className="flex gap-2"><Button variant="outline" size="sm" leftIcon={<ChevronLeft size={16} />} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button><Button variant="outline" size="sm" rightIcon={<ChevronRight size={16} />} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div></div>

    <Modal isOpen={showCreate} onClose={() => { if (!createMutation.isPending) setShowCreate(false); }} title="Nueva inspección" size="lg" closeOnOverlayClick={false}
      footer={<><Button variant="outline" disabled={createMutation.isPending} onClick={() => setShowCreate(false)}>Cancelar</Button><Button isLoading={createMutation.isPending} leftIcon={<Plus size={17} />} onClick={createInspection}>Crear expediente</Button></>}>
      <fieldset disabled={createMutation.isPending} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Tipo de inspección
          <select value={inspectionType} onChange={(event) => {
            const selected = event.target.value as InspectionType;
            setInspectionType(selected); setActorId(''); setAssignedInspector('');
            setWithoutActor(!isActorType(selected));
            if (isActorType(selected)) setType(selected);
          }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">
            {availableTypes.map((key) => <option key={key} value={key}>{INSPECTION_TYPES[key].label} · {INSPECTION_TYPES[key].serie}</option>)}
            <option disabled value="D">D · Reservada, pendiente de definición</option>
          </select>
        </label>
        <div className="border-l-2 border-primary-600 pl-3 text-sm sm:col-span-2">
          <span className="font-semibold text-neutral-800">Legajo automático: </span><code className="text-primary-900">{inspectionNumberExample(inspectionType)}</code>
          <p className="mt-1 text-xs text-neutral-600">Ejemplo de formato. Al crear se asigna el siguiente correlativo de este tipo y año.</p>
        </div>
        {(currentUser?.rol === 'ADMIN' || !currentUser?.rol.startsWith('ADMIN_')) && <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={withoutActor} onChange={(e) => { setWithoutActor(e.target.checked); setAssignedInspector(''); }} />Responsable todavía sin identificar</label>}
        {!withoutActor && !actorInspection && <label className="text-sm font-semibold text-neutral-800">Tipo de actor<select value={actorInspection ? inspectionType : type} onChange={(event) => { setType(event.target.value as InspectionActorType); setActorId(''); }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal disabled:bg-neutral-50">{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {!withoutActor && <label className={`text-sm font-semibold text-neutral-800 ${actorInspection ? 'sm:col-span-2' : ''}`}>Actor inspeccionado<select value={actorId} onChange={(event) => setActorId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal disabled:bg-neutral-50"><option value="">Seleccionar actor…</option>{actorOptions.map((actor) => <option key={String(actor.id)} value={String(actor.id)}>{String(actor.razonSocial || actor.nombre || actor.id)}</option>)}</select></label>}
        {(isAdmin || currentUser?.rol.startsWith('ADMIN_')) && <div className="sm:col-span-2"><InspectorSelect creating value={assignedInspector} onChange={setAssignedInspector} type={withoutActor || !actorInspection ? null : type} /></div>}
        {!actorInspection && <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Descripción inicial<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={10000} placeholder="Qué se va a inspeccionar o qué ocurrió. Se puede completar en campo." className="mt-2 w-full rounded-lg border border-neutral-300 p-3 text-base font-normal" /></label>}
        <label className="min-w-0 text-sm font-semibold text-neutral-800">Fecha programada<input type="datetime-local" value={fechaProgramada} onChange={(event) => setFechaProgramada(event.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-neutral-800">Número de acta<input value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Opcional · distinto del legajo" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Ubicación prevista<input value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Domicilio o referencia" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label>
      </fieldset>
    </Modal>
  </div>;
};

export default InspeccionesPageV2;

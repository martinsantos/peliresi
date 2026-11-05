import { InspectionManagementPanel } from './InspectionManagementPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, FileSearch, HelpCircle, MapPin, MoreHorizontal, Plus, Search, SlidersHorizontal, UserRound, Users } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from '../../components/ui/DropdownMenu';
import { Modal } from '../../components/ui/Modal';
import type { InspectionOpeningDraft } from '../../services/inspectionOpeningDraft';
import { PageToolbar } from '../../components/ui/PageToolbar';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { useInspections } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import { readInspectionResume } from '../../services/inspectionResume';
import type { InspectionActorType, InspectionState, InspectionType } from '../../types/inspection';
import { inspectionActor, INSPECTION_TYPES, inspectionTypeOf } from '../../types/inspection';
import { downloadCsv } from '../../utils/exportCsv';
import { INSPECTION_ACTOR_LABELS, INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionActorRoute, inspectionDate, inspectionRelevantDate, isTrainingActNumber } from './inspectionPresentation';
import { InspectionFollowUpSummary } from './InspectionFollowUpSummary';
import { InspectionOpening } from './InspectionOpening';
import { InspectionOperationsPanel } from './InspectionOperationsPanel';
import { useConnectivity } from '../../hooks/useConnectivity';
import { SpontaneousFindingPanel } from './SpontaneousFindingPanel';
import { InspectionIntakePanel } from './InspectionIntakePanel';
import type { InspectionIntake } from '../../types/inspectionIntake';
import { INSPECTION_PHASES, inspectionPhaseOf, isInspectionPhase, isInspectionFollowUp, type InspectionPhase } from './inspectionProcess';

import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
import { INSPECTION_FILTER_KEYS, inspectionPage, inspectionReturnState, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { supportRequestContext } from '../../utils/supportSession';

const isActorType = (value: string | null): value is InspectionActorType => value === 'GENERADOR' || value === 'TRANSPORTISTA' || value === 'OPERADOR';

const InspeccionesPageV2: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = location.pathname.startsWith('/mobile');
  const { currentUser, isAdmin } = useAuth();
  const owner = inspectionWorkspaceOwner(currentUser);
  const openingOwner = owner && JSON.stringify([owner, supportRequestContext()]);
  const [searchParams, setSearchParams] = useScopedSearchParams('inspections', INSPECTION_FILTER_KEYS, owner);
  const updateFilters = (values: Record<string, string | number>) => setSearchParams(next => {
    Object.entries(values).forEach(([key, value]) => value && value !== 1 ? next.set(key, String(value)) : next.delete(key));
    return next;
  });
  const initialType = isActorType(searchParams.get('tipoActor')) ? searchParams.get('tipoActor') as InspectionActorType : '';
  const initialActor = searchParams.get('actorId') || '';
  const search = searchParams.get('search') || '';
  const state = Object.hasOwn(INSPECTION_STATE_LABELS, searchParams.get('estado') || '') ? searchParams.get('estado') as InspectionState : '';
  const phaseValue = searchParams.get('etapa');
  const phase: InspectionPhase | '' = isInspectionPhase(phaseValue) ? phaseValue : '';
  const typeFilter = initialType;
  const inspectionFilter = Object.hasOwn(INSPECTION_TYPES, searchParams.get('tipoInspeccion') || '') ? searchParams.get('tipoInspeccion') as InspectionType : '';
  const actorFilter = initialActor;
  const page = inspectionPage(searchParams.get('page'));
  const [showCreate, setShowCreate] = useState(false);
  const showQueue = searchParams.get('vista') === 'antecedentes';
  const agendaOpen = searchParams.get('vista') === 'agenda';
  const sectionSearch = (section: string) => {
    const next = new URLSearchParams(searchParams);
    if (section) next.set('vista', section);
    else next.delete('vista');
    return next.toString();
  };
  const returnState = inspectionReturnState(location.pathname + (searchParams.size ? '?' + searchParams.toString() : ''), owner);
  const [sourceIntake, setSourceIntake] = useState<InspectionIntake | null>(null);
  const filtersOpen = searchParams.get('filtros') === 'abiertos';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const [exporting, setExporting] = useState(false);
  const [findingActorType, setFindingActorType] = useState<InspectionActorType>();
  const { isOnline } = useConnectivity({ enablePing: false, debounceMs: 0 });
  const [findingRequest, setFindingRequest] = useState(0);
  const [managementOpen, setManagementOpen] = useState(false);
  const [opening, setOpening] = useState<{ available: InspectionOpeningDraft | null; error: string }>({ available: null, error: '' });
  const managementAllowed = Boolean(isAdmin && import.meta.env.VITE_INSPECTION_FIELD_MODEL_ENABLED === 'true');
  // Una apertura guardada se continúa con la misma acción principal; el expediente ya confirmado la muestra en su tarjeta.
  const openingReceipt = !showCreate && opening.available?.command?.status === 'confirmed' ? opening.available.command.receipt : undefined;
  const openingPending = !showCreate && !opening.error && Boolean(opening.available) && !openingReceipt;

  const allowed = Boolean(isAdmin || currentUser?.esJefeInspecciones || currentUser?.esInspector || currentUser?.rol.startsWith('ADMIN_'));
  const listFilters = { estado: state || undefined, estados: phase ? INSPECTION_PHASES[phase].states : undefined, tipoInspeccion: inspectionFilter || undefined, tipoActor: typeFilter || undefined, actorId: actorFilter || undefined, search: search || undefined };
  const inspections = useInspections({ ...listFilters, page, limit: 25 });
  const generadores = useCatalogoGeneradores(findingActorType === 'GENERADOR' || Boolean(actorFilter && typeFilter === 'GENERADOR'));
  const transportistas = useCatalogoTransportistas(findingActorType === 'TRANSPORTISTA' || Boolean(actorFilter && typeFilter === 'TRANSPORTISTA'));
  const operadores = useCatalogoOperadores(findingActorType === 'OPERADOR' || Boolean(actorFilter && typeFilter === 'OPERADOR'));
  const filteredActorName = useMemo(() => {
    if (!actorFilter || !typeFilter) return '';
    const source = typeFilter === 'GENERADOR' ? generadores.data : typeFilter === 'TRANSPORTISTA' ? transportistas.data : operadores.data;
    const actor = source?.find((item) => String(item.id) === actorFilter);
    return String(actor?.razonSocial || actor?.nombre || 'Actor seleccionado');
  }, [actorFilter, typeFilter, generadores.data, transportistas.data, operadores.data]);

  const createFromIntake = (item: InspectionIntake) => {
    setSourceIntake(item); setShowCreate(true);
  };

  const exportList = async () => {
    setExporting(true);
    try {
      const result = await inspeccionService.list({ ...listFilters, limit: 100 });
      downloadCsv(result.items.map((inspection) => {
        const actor = inspectionActor(inspection);
        return {
          Expediente: inspection.numero, Tipo_inspeccion: INSPECTION_TYPES[inspectionTypeOf(inspection)].label, Acta: inspection.numeroActa || '', Etapa_PSIP: INSPECTION_PHASES[inspectionPhaseOf(inspection.estado)].label, Estado: INSPECTION_STATE_LABELS[inspection.estado], Tipo_actor: (inspection.tipoActor ? INSPECTION_ACTOR_LABELS[inspection.tipoActor] : 'Sin identificar'), Actor: actor?.razonSocial || '', CUIT: actor?.cuit || '',
          Fecha_programada: inspectionDate(inspection.fechaProgramada), Inicio_campo: inspectionDate(inspection.iniciadaAt, true), Inspector: `${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim(), Ubicacion: inspection.ubicacion || '', Evidencias: inspection._count?.evidencias || 0, Eventos: inspection._count?.eventos || 0, Actualizada: inspectionDate(inspection.updatedAt, true),
        };
      }), `inspecciones_${new Date().toISOString().slice(0, 10)}`, { titulo: 'Listado de inspecciones', filtros: [phase && INSPECTION_PHASES[phase].label, state && INSPECTION_STATE_LABELS[state], typeFilter && INSPECTION_ACTOR_LABELS[typeFilter], inspectionFilter && INSPECTION_TYPES[inspectionFilter].label, filteredActorName, search].filter(Boolean).join(' · ') || 'Todos', total: result.total });
      if (result.total > 100) toast.warning('Exportación parcial', 'Se exportaron los primeros 100 resultados del filtro actual.');
      else toast.success('Listado exportado', `${result.total} inspecciones incluidas.`);
    } catch { toast.error('No se pudo exportar', 'Volvé a intentar con los filtros actuales.'); } finally { setExporting(false); }
  };

  if (!allowed) return <Card className="mx-auto max-w-xl text-center"><ClipboardCheck className="mx-auto text-neutral-400" size={36} /><h2 className="mt-4 text-xl font-bold text-neutral-900">Acceso reservado a inspecciones</h2><p className="mt-2 text-sm text-neutral-600">Su cuenta no tiene el perfil inspector habilitado.</p></Card>;

  const rows = inspections.data?.items || [];
  const offline = Boolean(inspections.data?.offline);
  const totalsUnknown = offline || inspections.isError;
  const stateCounts = inspections.data?.summary?.byState || {};
  const deadlines = inspections.data?.summary?.openDeadlines || 0;
  const totalPages = inspections.data?.totalPages || 1;

  return <div className="min-w-0 space-y-4" data-operational-page>
    <PageToolbar label="Acciones de Inspecciones">
      <h2 className="sr-only">Inspecciones</h2>
      <Button className="flex-1 sm:ml-auto sm:flex-none" leftIcon={<Plus size={16} />} disabled={offline || inspections.isError} onClick={() => { setSourceIntake(null); setShowCreate(true); }} aria-label={openingPending ? 'Continuar apertura' : 'Nueva inspección'}>{openingPending ? 'Continuar apertura' : <>Nueva<span className="hidden sm:inline"> inspección</span></>}</Button>
      <DropdownMenu>
        <DropdownTrigger asChild><Button variant="outline" aria-label="Más acciones" leftIcon={<MoreHorizontal size={18} />}><span className="sr-only sm:not-sr-only">Más</span></Button></DropdownTrigger>
        <DropdownContent align="end">
          <DropdownItem icon={<AlertTriangle size={16} />} onClick={() => { updateFilters({ vista: '' }); setFindingRequest((value) => value + 1); }}>Denuncia / hallazgo</DropdownItem>
          <DropdownItem icon={<FileDown size={16} />} disabled={offline || inspections.isError || exporting} onClick={() => void exportList()}>{exporting ? 'Exportando…' : 'Exportar listado'}</DropdownItem>
          <a href="/manual/tutorial.html?guide=psip-flujo-inspecciones" target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-sm !text-neutral-700 !no-underline hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none"><HelpCircle size={16} className="shrink-0 text-neutral-500" aria-hidden="true" />Cómo funciona PSIP</a>
          {managementAllowed && <><DropdownSeparator /><DropdownItem icon={<Users size={16} />} onClick={() => setManagementOpen(true)}>Administración de inspectores</DropdownItem></>}
        </DropdownContent>
      </DropdownMenu>
    </PageToolbar>
    {managementAllowed && <Modal isOpen={managementOpen} onClose={() => setManagementOpen(false)} title="Administración de inspectores"><InspectionManagementPanel embedded /></Modal>}
    {currentUser?.id && <InspectionOpening key={openingOwner} userId={String(currentUser.id)} owner={openingOwner} role={currentUser.rol} isAdmin={Boolean(isAdmin || currentUser.esJefeInspecciones)} mobile={mobile} online={isOnline}
      initialType={initialType} initialActor={initialActor} returnState={returnState} open={showCreate} source={sourceIntake} banner={false} onStateChange={setOpening}
      onOpen={() => { setSourceIntake(null); setShowCreate(true); }} onClose={() => setShowCreate(false)} />}
    {!showCreate && opening.error && <p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-900">{opening.error}</p>}
    <nav aria-label="Secciones de Inspecciones" className="flex border-b border-neutral-200">
      {[
        { section: '', label: 'Expedientes', Icon: ClipboardCheck },
        { section: 'agenda', label: 'Agenda', Icon: CalendarDays },
        { section: 'antecedentes', label: 'Antecedentes', Icon: FileSearch },
      ].map(({ section, label, Icon }) => <Link
        key={label}
        to={{ pathname: location.pathname, search: sectionSearch(section) }} state={location.state}
        aria-current={(showQueue ? 'antecedentes' : agendaOpen ? 'agenda' : '') === section ? 'page' : undefined}
        className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2 text-sm !no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700 sm:flex-none sm:px-5 ${(showQueue ? 'antecedentes' : agendaOpen ? 'agenda' : '') === section ? 'border-primary-700 bg-primary-50 font-bold !text-primary-800' : 'border-transparent !text-neutral-600 hover:bg-neutral-50'}`}
      ><Icon size={18} className="hidden shrink-0 sm:block" aria-hidden="true" />{label}</Link>)}
    </nav>
    {showQueue && <InspectionIntakePanel mobile={mobile} online={isOnline && navigator.onLine} onCreate={createFromIntake} />}
    {agendaOpen && <InspectionOperationsPanel embedded />}
    {!showQueue && !agendaOpen && <>

    {offline && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-bold">Sin conexión · copias de este dispositivo</p><p className="mt-1">Sólo aparecen expedientes que abriste aquí antes. Los cambios y las fotos pendientes siguen sin confirmar en el servidor.</p><button type="button" onClick={() => void inspections.refetch()} className="mt-2 min-h-10 font-semibold underline underline-offset-2">Reintentar conexión</button></div>}
    {inspections.isError && rows.length > 0 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">No se pudo actualizar el listado. Estos resultados pueden estar desactualizados. <button type="button" onClick={() => void inspections.refetch()} className="font-bold underline underline-offset-2">Reintentar</button></div>}

    {actorFilter && typeFilter && <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Historial cruzado</p><p className="font-bold text-primary-950">{filteredActorName} · {INSPECTION_ACTOR_LABELS[typeFilter]}</p></div><Button variant="outline" size="sm" onClick={() => updateFilters({ actorId: '', tipoActor: '', page: 1 })}>Ver todos los actores</Button></div>}

    {currentUser?.id && <SpontaneousFindingPanel createRequest={findingRequest} hideTrigger userId={currentUser.id} online={!offline && isOnline && navigator.onLine} mobile={mobile} onActorTypeNeeded={setFindingActorType} actors={{ GENERADOR: generadores.data || [], TRANSPORTISTA: transportistas.data || [], OPERADOR: operadores.data || [] }} />}

    <nav aria-label="Etapas PSIP" className="flex items-center gap-x-4 overflow-x-auto border-b border-neutral-200 text-sm sm:flex-wrap [&>button]:shrink-0 [&>button]:whitespace-nowrap">
      <button aria-pressed={!phase && !state} className={!phase && !state ? 'min-h-11 border-b-2 border-primary-700 font-semibold text-primary-800' : 'min-h-11 text-neutral-600'} onClick={() => updateFilters({ etapa: '', estado: '', page: 1 })}>Todas</button>
      {(Object.keys(INSPECTION_PHASES) as InspectionPhase[]).map((key) => <button key={key} aria-pressed={phase === key} className={phase === key ? 'min-h-11 border-b-2 border-primary-700 font-semibold text-primary-800' : 'min-h-11 text-neutral-600'} onClick={() => updateFilters({ etapa: key, estado: '', page: 1 })}>{INSPECTION_PHASES[key].label} <span className="ml-1 tabular-nums">{totalsUnknown ? '—' : INSPECTION_PHASES[key].states.reduce((sum, value) => sum + (stateCounts[value] || 0), 0)}</span></button>)}
    </nav>
    {phase && <p className="text-sm text-neutral-600">{INSPECTION_PHASES[phase].description}</p>}
    {!totalsUnknown && deadlines>0 && <p className="text-sm text-neutral-600">{deadlines} con plazo vigente sin responder</p>}
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-[#E0E0DC] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(160px,1fr)_190px_170px]">
      <label className="relative sm:col-span-2 lg:col-span-1"><span className="sr-only">Buscar inspección</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17} /><input value={search} onChange={(event) => updateFilters({ search: event.target.value, page: 1 })} placeholder="Buscar…" className="h-11 w-full rounded-lg border border-neutral-400 bg-white pl-10 pr-3 text-base sm:text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" /></label>
      <Button variant="outline" aria-label="Filtros de inspecciones" aria-expanded={filtersOpen} aria-controls="inspection-secondary-filters" className="sm:hidden" leftIcon={<SlidersHorizontal size={17} />} onClick={() => updateFilters({ filtros: filtersOpen ? '' : 'abiertos' })}>Filtros{(state || inspectionFilter) && <span className="ml-1">{Number(Boolean(state)) + Number(Boolean(inspectionFilter))}</span>}</Button>
      <div id="inspection-secondary-filters" className={`${filtersOpen ? 'grid' : 'hidden'} col-span-2 grid-cols-1 gap-3 sm:contents`}>
      <select aria-label="Filtrar por estado" value={state} onChange={(event) => { const value = event.target.value as InspectionState | ''; updateFilters({ estado: value, etapa: value ? inspectionPhaseOf(value) : phase, page: 1 }); }} className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-2 text-base sm:text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">{phase ? 'Todos en esta etapa' : 'Todos los estados'}</option>{(Object.keys(INSPECTION_PHASES) as InspectionPhase[]).filter((key) => !phase || phase === key).map((key) => <optgroup key={key} label={INSPECTION_PHASES[key].label}>{INSPECTION_PHASES[key].states.map((value) => <option key={value} value={value}>{INSPECTION_STATE_LABELS[value]}</option>)}</optgroup>)}</select>
      <select aria-label="Filtrar por tipo de inspección" value={inspectionFilter} onChange={(event) => updateFilters({ tipoInspeccion: event.target.value, tipoActor: '', actorId: '', page: 1 })} className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-2 text-base sm:text-sm text-neutral-800 focus:border-primary-600 focus:outline-none"><option value="">Todos los tipos</option>{Object.entries(INSPECTION_TYPES).map(([value, type]) => <option key={value} value={value}>{type.label}</option>)}</select>
      </div>
      {(state || inspectionFilter) && <p className="col-span-2 text-xs text-neutral-600 sm:hidden">{[state && INSPECTION_STATE_LABELS[state], inspectionFilter && INSPECTION_TYPES[inspectionFilter].label].filter(Boolean).join(' · ')}</p>}
    </div>


    <div className="overflow-hidden rounded-xl border border-[#E0E0DC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="hidden grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] gap-4 border-b border-neutral-200 bg-[#F5F5F3] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 lg:grid"><span>Expediente / fecha</span><span>Actor inspeccionado</span><span>Inspector / ubicación</span><span>Estado</span><span>Actividad</span></div>
      {inspections.isLoading ? <p className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones…</p> : inspections.isError && rows.length === 0 ? <div role="alert" className="p-8 text-center"><p className="font-semibold text-error-800">No se pudo cargar el listado</p><p className="mt-1 text-sm text-neutral-600">No significa que no haya inspecciones. Comprobá la conexión y volvé a intentar.</p><Button variant="outline" className="mt-4" onClick={() => void inspections.refetch()}>Reintentar</Button></div> : rows.length === 0 ? <div className="p-10 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={40} /><p className="mt-3 font-semibold text-neutral-800">{offline ? 'No hay copias locales para estos filtros' : 'No hay inspecciones para estos filtros'}</p><p className="mt-1 text-sm text-neutral-500">{offline ? 'Con conexión, abrí el expediente una vez para dejarlo disponible en este dispositivo.' : 'Ajustá la búsqueda o creá un nuevo expediente.'}</p></div> : rows.map((inspection) => {
        const actor = inspectionActor(inspection); const dateValue = inspectionRelevantDate(inspection);
        const inspectionRoute = `${mobile ? '/mobile' : ''}/inspecciones/${inspection.id}`;
        const resume = currentUser?.id ? readInspectionResume(currentUser.id, inspection.id, owner) : null;
        return <div key={inspection.id} onClick={(event) => { if (!(event.target as HTMLElement).closest('a,button,input')) navigate(inspectionRoute + (resume?.hash || ''), { state: returnState }); }} data-testid={`inspection-row-${inspection.id}`} className="group grid w-full min-w-0 cursor-pointer grid-cols-1 gap-2 border-b border-neutral-100 p-4 text-left transition-colors last:border-0 hover:bg-neutral-50/60 active:bg-neutral-100/60 focus-within:bg-neutral-50 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 lg:grid-cols-[0.92fr_1.35fr_1fr_1fr_auto] lg:items-center lg:gap-4 lg:px-4 lg:py-2.5">
          <div><div className="flex flex-wrap items-center justify-between gap-2 lg:justify-start"><Link state={returnState} to={inspectionRoute + (resume?.hash || '')} aria-label={`${resume ? 'Retomar' : 'Abrir'} expediente ${inspection.numero}${resume ? ` en ${resume.label}` : ''}`} className="rounded font-mono text-sm font-semibold text-neutral-900 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500">{inspection.numero}</Link>{isTrainingActNumber(inspection.numeroActa) && <Badge color="warning">Capacitación</Badge>}<Badge className="lg:hidden" color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><CalendarDays size={14} className="text-neutral-400" />{inspectionDate(dateValue)}</p>{resume && <p className="mt-1 line-clamp-2 text-xs font-semibold text-primary-800">Retomar: {resume.label}</p>}{openingReceipt?.id === inspection.id && <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-primary-900"><span className="font-semibold">Apertura confirmada en este dispositivo</span><button type="button" className="min-h-11 font-semibold underline underline-offset-2" onClick={() => { setSourceIntake(null); setShowCreate(true); }}>Continuar apertura</button></p>}</div>
          <div className="min-w-0">{actor ? <Link to={inspectionActorRoute(inspection.tipoActor, actor.id, mobile)} state={{ inspectionReturn: inspectionRoute }} aria-label={'Abrir ficha de ' + actor.razonSocial} className="inline-block max-w-full rounded text-sm font-medium text-neutral-700 hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">{actor.razonSocial}</Link> : <p className="font-semibold text-neutral-900">{INSPECTION_TYPES[inspectionTypeOf(inspection)].label}</p>}<p className="mt-1 text-xs text-neutral-500">{INSPECTION_TYPES[inspectionTypeOf(inspection)].label}{!inspection.tipoActor && ' · Sin responsable vinculado'}{actor?.cuit ? ` · CUIT ${actor.cuit}` : ''}</p>{(isInspectionFollowUp(inspection.estado) || inspectionPhaseOf(inspection.estado) === 'DERIVACIONES') && <InspectionFollowUpSummary seguimiento={inspection.seguimiento} now={now} state={inspection.estado} />}</div>
          <div className="space-y-1.5 text-sm text-neutral-600"><p className="flex items-center gap-2"><UserRound size={15} className="shrink-0 text-neutral-400" />{inspection.inspector?.nombre || 'Sin asignar'} {inspection.inspector?.apellido || ''}</p><p className="flex items-center gap-2 text-xs text-neutral-500"><MapPin size={14} className="shrink-0" /><span className="line-clamp-2">{inspection.ubicacion || 'Sin ubicación'}</span></p></div>
          <div className="hidden lg:block"><Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge></div>
          <div className="flex items-center justify-between gap-4 pt-1 text-xs text-neutral-500 lg:block lg:border-0 lg:pt-0 lg:text-right"><span>{inspection._count?.evidencias || 0} evidencias</span><span className="lg:mt-1 lg:block">{inspection._count?.eventos || 0} eventos</span><span aria-hidden="true" className="rounded-md text-neutral-400 transition-colors group-hover:text-primary-700 lg:ml-auto lg:mt-1 lg:inline-flex lg:p-1"><ChevronRight size={17} /></span></div>
        </div>;
      })}
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-neutral-600">{inspections.isError ? rows.length ? `${rows.length} resultados anteriores · sin actualizar` : 'Listado no disponible' : `${inspections.data?.total || 0} ${offline ? 'copias locales' : 'resultados'} · página ${page} de ${totalPages}`}</p><div className="flex gap-2"><Button variant="outline" size="sm" leftIcon={<ChevronLeft size={16} />} disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) })}>Anterior</Button><Button variant="outline" size="sm" rightIcon={<ChevronRight size={16} />} disabled={page >= totalPages} onClick={() => updateFilters({ page: page + 1 })}>Siguiente</Button></div></div>

    </>}
  </div>;
};

export default InspeccionesPageV2;

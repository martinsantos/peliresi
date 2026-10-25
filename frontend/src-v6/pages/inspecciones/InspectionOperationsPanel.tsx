import { SlidersHorizontal } from 'lucide-react';
import React, { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useInspectionOperations } from '../../hooks/useInspectionOperations';
import { canUseInspectionOperations, inspectionOperationsService, operationSubject, type InspectionOperationsParams } from '../../services/inspectionOperations.service';
import type { InspectionState } from '../../types/inspection';
import { INSPECTION_STATE_LABELS, inspectionDate } from './inspectionPresentation';
import { downloadCsv } from '../../utils/exportCsv';

import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
import { INSPECTION_FILTER_KEYS, inspectionPage, inspectionDateFilter, inspectionReturnState, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

type Props = { embedded?: boolean; mode?: 'agenda' | 'report' | 'compact' | 'monitor'; desde?: string; hasta?: string };

export function InspectionOperationsPanel({ mode = 'agenda', desde, hasta, embedded = false }: Props) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/mobile') ? '/mobile' : '';
  const filtersId = useId();
  const owner = inspectionWorkspaceOwner(currentUser);
  const [searchParams, setSearchParams] = useScopedSearchParams('inspections', INSPECTION_FILTER_KEYS, owner);
  const updateFilters = (values: Record<string, string | number>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => value && value !== 1 ? next.set(key, String(value)) : next.delete(key));
    setSearchParams(next);
  };
  const page = inspectionPage(searchParams.get('agendaPage'));
  const rawState = searchParams.get('agendaEstado') || '';
  const state: InspectionState | '' = Object.hasOwn(INSPECTION_STATE_LABELS, rawState) && (mode === 'report' || !['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].includes(rawState)) ? rawState as InspectionState : '';
  const rawDate = searchParams.get('agendaFecha');
  const fecha: InspectionOperationsParams['fecha'] = mode !== 'report' ? 'programada' : rawDate === 'programada' || rawDate === 'campo' ? rawDate : 'creacion';
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const agendaDesde = inspectionDateFilter(searchParams.get('agendaDesde'));
  const agendaHasta = inspectionDateFilter(searchParams.get('agendaHasta'));
  const filtersOpen = searchParams.get('agendaFiltros') === 'abiertos';
  const filterCount = Number(!!state) + Number(!!agendaDesde) + Number(!!agendaHasta);
  const rangeError = mode === 'agenda' && !!agendaDesde && !!agendaHasta && agendaDesde > agendaHasta;
  const returnState = inspectionReturnState(location.pathname + (searchParams.size ? '?' + searchParams.toString() : ''), owner);
  const compact = mode === 'compact' || mode === 'monitor';
  const params: InspectionOperationsParams = { desde: (mode === 'agenda' ? agendaDesde : desde) || undefined, hasta: (mode === 'agenda' ? agendaHasta : hasta) || undefined, fecha, estado: state || undefined, activas: mode !== 'report', page, limit: compact ? 3 : 10 };
  const query = useInspectionOperations(params, !rangeError);
  if (!canUseInspectionOperations(currentUser)) return null;
  const data = rangeError ? undefined : query.data;
  const control = 'min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900';

  const exportRows = async () => {
    setExporting(true); setExportError('');
    try {
      const result = await inspectionOperationsService.list(params, true);
      if (!result.items.length) { setExportError('No hay legajos para exportar con estos filtros.'); return; }
      const safe = (value?: string | null) => /^[=+\-@\t\r]/.test(value || '') ? `'${value}` : value || '';
      downloadCsv(result.items.map((row) => ({ Legajo: row.numero, Estado: INSPECTION_STATE_LABELS[row.estado], Sujeto: safe(operationSubject(row)), Inspector: safe(`${row.inspector.nombre} ${row.inspector.apellido || ''}`), Programada: row.fechaProgramada || '', Inicio_campo: row.iniciadaAt || '', Lugar: safe(row.ubicacion), Latitud: row.latitud ?? '', Longitud: row.longitud ?? '' })), 'inspecciones', { titulo: 'Inspecciones', total: result.total, fecha: result.updatedAt, filtros: `Fecha: ${fecha}; desde ${desde || 'inicio'} hasta ${hasta || 'hoy'}; estado: ${state || 'todos'}` });
    } catch { setExportError('No se pudo exportar. Verificá la conexión o reducí el período si supera 10.000 legajos.'); }
    finally { setExporting(false); }
  };

  return <section aria-label="Operación de inspecciones" className={`rounded-xl border p-4 ${mode === 'monitor' ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-neutral-200 bg-white text-neutral-900'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-bold">{mode === 'report' ? 'Reporte de inspecciones' : 'Agenda de inspecciones'}</h3><p className={`mt-1 text-xs ${mode === 'monitor' ? 'text-slate-300' : 'text-neutral-600'}`}>{mode === 'report' ? 'Legajos únicos; los documentos y las visitas no se suman como casos nuevos.' : mode === 'monitor' ? 'Fecha prevista y último estado recibido. No indica la posición del inspector.' : 'Expedientes activos por fecha prevista. Los que no tienen fecha también aparecen hasta que filtres un período.'}</p></div>
      {!embedded && <Link className="inline-flex min-h-11 items-center font-semibold underline" to={`${prefix}/inspecciones`}>Abrir inspecciones</Link>}
    </div>
    {!compact && <>
      <button type="button" aria-expanded={filtersOpen || rangeError} aria-controls={filtersId} onClick={() => updateFilters({ agendaFiltros: filtersOpen ? '' : 'abiertos' })} className={`${control} mt-3 inline-flex items-center gap-2 font-semibold sm:hidden`}><SlidersHorizontal size={16} aria-hidden="true" />Filtros{filterCount > 0 ? ` (${filterCount})` : ''}</button>
      {!filtersOpen && filterCount > 0 && <p className="mt-2 text-sm text-neutral-700 sm:hidden">{[state && INSPECTION_STATE_LABELS[state], agendaDesde && `Desde ${inspectionDate(agendaDesde + 'T15:00:00Z')}`, agendaHasta && `Hasta ${inspectionDate(agendaHasta + 'T15:00:00Z')}`].filter(Boolean).join(' · ')}</p>}
      <div id={filtersId} className={`${filtersOpen || rangeError ? 'grid' : 'hidden'} mt-4 min-w-0 grid-cols-1 items-end gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4`}>
      <label className="grid min-w-0 gap-1 text-sm">Estado<select aria-label="Estado de las inspecciones" value={state} onChange={(e) => updateFilters({ agendaEstado: e.target.value, agendaPage: 1 })} className={`${control} w-full min-w-0`}><option value="">Todos</option>{Object.entries(INSPECTION_STATE_LABELS).filter(([value]) => mode === 'report' || !['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {mode === 'agenda' && <><label className="grid min-w-0 gap-1 text-sm">Previstas desde<input type="date" aria-label="Agenda desde" value={agendaDesde} onChange={(e) => updateFilters({ agendaDesde: e.target.value, agendaPage: 1 })} className={`${control} w-full min-w-0`} /></label><label className="grid min-w-0 gap-1 text-sm">Hasta<input type="date" aria-label="Agenda hasta" aria-invalid={rangeError || undefined} aria-describedby={rangeError ? "inspection-agenda-date-error" : undefined} min={agendaDesde || undefined} value={agendaHasta} onChange={(e) => updateFilters({ agendaHasta: e.target.value, agendaPage: 1 })} className={`${control} w-full min-w-0`} /></label>{(agendaDesde || agendaHasta) && <button className={control} onClick={() => updateFilters({ agendaDesde: '', agendaHasta: '', agendaPage: 1 })}>Quitar fechas</button>}</>}
      {mode === 'report' && <label className="grid min-w-0 gap-1 text-sm">Fecha del reporte<select aria-label="Fecha del reporte de inspecciones" value={fecha} onChange={(e) => updateFilters({ agendaFecha: e.target.value, agendaPage: 1 })} className={`${control} w-full min-w-0`}><option value="creacion">Apertura del legajo</option><option value="programada">Programación</option><option value="campo">Inicio de campo</option></select></label>}
      {mode === 'report' && <button type="button" disabled={exporting || query.isError || !data} onClick={() => void exportRows()} className={control}>{exporting ? 'Exportando…' : 'Exportar CSV completo'}</button>}
    </div></>}
    {rangeError && <p id="inspection-agenda-date-error" role="alert" className="mt-3 text-sm text-error-800">La fecha hasta debe ser igual o posterior a la fecha desde.</p>}
    {exportError && <p role="alert" className="mt-2 text-sm">{exportError}</p>}
    {!rangeError && query.isLoading && <p className="mt-4 text-sm">Cargando inspecciones…</p>}
    {!rangeError && query.isError && <p role="alert" className="mt-4 text-sm">No se pudo actualizar. {data ? 'Se muestran los últimos datos recibidos.' : 'No significa que no existan inspecciones.'} <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>Reintentar</button></p>}
    {data && <>
      <p className={`mt-3 text-sm ${mode === 'monitor' ? 'text-slate-200' : 'text-neutral-700'}`}><strong>{data.total}</strong> legajos{mode !== 'report' ? ' activos' : ''} · {data.summary.sinResponsable} sin responsable · {data.summary.sinUbicacion} sin coordenadas</p>
      <div className="mt-3 divide-y divide-neutral-200">{data.items.length === 0 ? <p className="py-4 text-sm">No hay inspecciones para este alcance y período.</p> : data.items.map((row) => <Link state={returnState} key={row.id} to={`${prefix}/inspecciones/${row.id}`} className="block min-h-16 rounded-lg py-3 !text-inherit !no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <div className="flex flex-wrap justify-between gap-1 text-sm font-semibold"><span>{row.numero}</span><span>{INSPECTION_STATE_LABELS[row.estado]}</span></div>
        <p className="mt-1 text-sm font-medium">{operationSubject(row)}</p>
        <p className="mt-1 text-xs">{row.fechaProgramada ? `Prevista: ${inspectionDate(row.fechaProgramada, true)}` : 'Sin fecha programada'}{mode !== 'monitor' ? ` · ${row.inspector.nombre} ${row.inspector.apellido || ''}` : ''}</p>
        {!compact && <p className="mt-1 text-xs">{row.ubicacion || 'Ubicación pendiente'} · Caso actualizado: {inspectionDate(row.updatedAt, true)}</p>}
      </Link>)}</div>
      {!compact && data.totalPages > 1 && <div className="mt-3 flex items-center justify-between gap-2"><button className={control} disabled={page <= 1} onClick={() => updateFilters({ agendaPage: page - 1 })}>Anterior</button><span className="grid min-w-0 gap-1 text-sm">Página {data.page} de {data.totalPages}</span><button className={control} disabled={page >= data.totalPages} onClick={() => updateFilters({ agendaPage: page + 1 })}>Siguiente</button></div>}
      <p className={`mt-3 text-xs ${mode === 'monitor' ? 'text-slate-400' : 'text-neutral-500'}`}>Consulta recibida: {inspectionDate(data.updatedAt, true)}. Los cambios aún sin sincronizar no aparecen aquí.</p>
    </>}
  </section>;
}

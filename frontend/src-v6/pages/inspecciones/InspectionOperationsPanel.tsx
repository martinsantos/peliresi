import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useInspectionOperations } from '../../hooks/useInspectionOperations';
import { canUseInspectionOperations, inspectionOperationsService, operationSubject, type InspectionOperationsParams } from '../../services/inspectionOperations.service';
import type { InspectionState } from '../../types/inspection';
import { INSPECTION_STATE_LABELS, inspectionDate } from './inspectionPresentation';
import { downloadCsv } from '../../utils/exportCsv';

type Props = { mode?: 'agenda' | 'report' | 'compact' | 'monitor'; desde?: string; hasta?: string };

export function InspectionOperationsPanel({ mode = 'agenda', desde, hasta }: Props) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/mobile') ? '/mobile' : '';
  const [page, setPage] = useState(1);
  const [state, setState] = useState<InspectionState | ''>('');
  const [fecha, setFecha] = useState<InspectionOperationsParams['fecha']>(mode === 'report' ? 'creacion' : 'programada');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [agendaDesde, setAgendaDesde] = useState('');
  const [agendaHasta, setAgendaHasta] = useState('');
  const compact = mode === 'compact' || mode === 'monitor';
  const params: InspectionOperationsParams = { desde: (mode === 'agenda' ? agendaDesde : desde) || undefined, hasta: (mode === 'agenda' ? agendaHasta : hasta) || undefined, fecha, estado: state || undefined, activas: mode !== 'report', page, limit: compact ? 3 : 10 };
  const query = useInspectionOperations(params);
  if (!canUseInspectionOperations(currentUser)) return null;
  const data = query.data;
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
      <div><h3 className="text-base font-bold">{mode === 'report' ? 'Reporte de inspecciones' : 'Inspecciones · agenda y seguimiento'}</h3><p className={`mt-1 text-xs ${mode === 'monitor' ? 'text-slate-300' : 'text-neutral-600'}`}>{mode === 'report' ? 'Legajos únicos; los documentos y las visitas no se suman como casos nuevos.' : 'Fecha prevista y último estado recibido. No indica la posición del inspector.'}</p></div>
      <Link className="inline-flex min-h-11 items-center font-semibold underline" to={`${prefix}/inspecciones`}>Abrir inspecciones</Link>
    </div>
    {!compact && <div className="mt-3 flex flex-wrap gap-2">
      <label className="text-xs">Estado<select aria-label="Estado de las inspecciones" value={state} onChange={(e) => { setState(e.target.value as InspectionState | ''); setPage(1); }} className={`${control} ml-2`}><option value="">Todos</option>{Object.entries(INSPECTION_STATE_LABELS).filter(([value]) => mode === 'report' || !['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {mode === 'agenda' && <><label className="text-xs">Previstas desde<input type="date" aria-label="Agenda desde" value={agendaDesde} onChange={(e) => { setAgendaDesde(e.target.value); setPage(1); }} className={`${control} ml-2`} /></label><label className="text-xs">Hasta<input type="date" aria-label="Agenda hasta" min={agendaDesde || undefined} value={agendaHasta} onChange={(e) => { setAgendaHasta(e.target.value); setPage(1); }} className={`${control} ml-2`} /></label>{(agendaDesde || agendaHasta) && <button className={control} onClick={() => { setAgendaDesde(''); setAgendaHasta(''); setPage(1); }}>Quitar fechas</button>}</>}
      {mode === 'report' && <label className="text-xs">Fecha del reporte<select aria-label="Fecha del reporte de inspecciones" value={fecha} onChange={(e) => { setFecha(e.target.value as InspectionOperationsParams['fecha']); setPage(1); }} className={`${control} ml-2`}><option value="creacion">Apertura del legajo</option><option value="programada">Programación</option><option value="campo">Inicio de campo</option></select></label>}
      {mode === 'report' && <button type="button" disabled={exporting || query.isError || !data} onClick={() => void exportRows()} className={control}>{exporting ? 'Exportando…' : 'Exportar CSV completo'}</button>}
    </div>}
    {exportError && <p role="alert" className="mt-2 text-sm">{exportError}</p>}
    {query.isLoading && <p className="mt-4 text-sm">Cargando inspecciones…</p>}
    {query.isError && <p role="alert" className="mt-4 text-sm">No se pudo actualizar. {data ? 'Se muestran los últimos datos recibidos.' : 'No significa que no existan inspecciones.'} <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>Reintentar</button></p>}
    {data && <>
      <p className={`mt-3 text-sm ${mode === 'monitor' ? 'text-slate-200' : 'text-neutral-700'}`}><strong>{data.total}</strong> legajos{mode !== 'report' ? ' activos' : ''} · {data.summary.sinResponsable} sin responsable · {data.summary.sinUbicacion} sin coordenadas</p>
      <div className="mt-3 divide-y divide-neutral-200">{data.items.length === 0 ? <p className="py-4 text-sm">No hay inspecciones para este alcance y período.</p> : data.items.map((row) => <Link key={row.id} to={`${prefix}/inspecciones/${row.id}`} className="block min-h-16 rounded-lg py-3 !text-inherit !no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <div className="flex flex-wrap justify-between gap-1 text-sm font-semibold"><span>{row.numero}</span><span>{INSPECTION_STATE_LABELS[row.estado]}</span></div>
        <p className="mt-1 text-sm font-medium">{operationSubject(row)}</p>
        <p className="mt-1 text-xs">{row.fechaProgramada ? `Prevista: ${inspectionDate(row.fechaProgramada, true)}` : 'Sin fecha programada'}{mode !== 'monitor' ? ` · ${row.inspector.nombre} ${row.inspector.apellido || ''}` : ''}</p>
        {!compact && <p className="mt-1 text-xs">{row.ubicacion || 'Ubicación pendiente'} · Caso actualizado: {inspectionDate(row.updatedAt, true)}</p>}
      </Link>)}</div>
      {!compact && data.totalPages > 1 && <div className="mt-3 flex items-center justify-between gap-2"><button className={control} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span className="text-xs">Página {data.page} de {data.totalPages}</span><button className={control} disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</button></div>}
      <p className={`mt-3 text-xs ${mode === 'monitor' ? 'text-slate-400' : 'text-neutral-500'}`}>Consulta recibida: {inspectionDate(data.updatedAt, true)}. Los cambios aún sin sincronizar no aparecen aquí.</p>
    </>}
  </section>;
}

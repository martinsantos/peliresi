import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileSearch, Truck, ChevronRight, ClipboardPlus, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { OperatorFindingSummary } from '../../components/manifiestos/OperatorFindingSummary';
import type { InspectionIntake, OperatorFinding } from '../../types/inspectionIntake';
import { INTAKE_REASON_LABELS, INTAKE_STATE_LABELS, eventualLinkAllowed } from '../../types/inspectionIntake';
import { INSPECTION_ACTOR_LABELS, inspectionDate, inspectionErrorMessage } from './inspectionPresentation';
import { inspeccionService } from '../../services/inspeccion.service';

type Data = { items: InspectionIntake[]; total: number; puedeEvaluar: boolean; puedeAbrirExterno?: boolean };
const originLabel: Record<string, string> = { INFORME_ADENDA: 'Informe en adenda', PARTICIPANTE_EVENTUAL: 'Participante eventual', RELEVO_EXTERNO: 'Relevo externo' };
const partyLabels: Record<string, string> = { nombre: 'Nombre', identificacion: 'Identificación declarada', domicilio: 'Domicilio', nombreFantasia: 'Nombre de fantasía', telefono: 'Teléfono', empresa: 'Empresa', cuit: 'CUIT declarado', patente: 'Patente', chofer: 'Chofer', documento: 'Documento', observaciones: 'Observaciones' };

export function InspectionIntakePanel({ mobile, online, onCreate }: { mobile: boolean; online: boolean; onCreate: (item: InspectionIntake) => void }) {
  const { currentUser } = useAuth(), qc = useQueryClient();
  const [state, setState] = useState('PENDIENTE'), [search, setSearch] = useState(''), [type, setType] = useState(''), [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(''), [reason, setReason] = useState(''), [inspectionId, setInspectionId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<{ signature: string; id: string } | undefined>(undefined), lock = useRef(false);
  const key = ['inspection-intakes', currentUser?.id];
  const query = useQuery({ queryKey: [...key, state, type, search, page], enabled: online && !!currentUser,
    queryFn: async () => (await api.get('/inspecciones/antecedentes', { params: { estado: state, tipoActor: type, search, page } })).data.data as Data,
    retry: false, staleTime: 0, refetchInterval: busy || selectedId ? false : 30000,
    refetchOnWindowFocus: !selectedId, refetchOnReconnect: !selectedId });
  const selected = query.data?.items.find(item => item.id === selectedId);
  const stale = !!selected && selected.version !== selectedVersion;
  const candidates = useQuery({ queryKey: ['intake-inspections', currentUser?.id, selected?.id], enabled: online && !!selected && !!query.data?.puedeEvaluar && !selected.inspeccion,
    queryFn: async () => inspeccionService.list({ ...(selected?.actorId ? { actorId: selected.actorId, tipoActor: selected.tipoActor } : {}), limit: 100 }), retry: false });
  async function decide(action: string) {
    if (!selected || lock.current) return;
    const body = { version: selectedVersion, accion: action, motivo: reason, ...(action === 'VINCULADA' ? { inspeccionId: inspectionId } : {}) };
    const signature = JSON.stringify({ target: selected.id, body });
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError('');
    try {
      await api.post(`/inspecciones/antecedentes/${selected.id}/decisiones`, { ...body, id: pending.current.id });
      pending.current = undefined; await qc.invalidateQueries({ queryKey: key }); setReason(''); setSelectedId('');
    } catch (cause) { setError(inspectionErrorMessage(cause, 'No se pudo guardar. Conservamos tu motivo para reintentar.')); }
    finally { lock.current = false; setBusy(false); }
  }
  const choose = (item: InspectionIntake) => { setSelectedId(selectedId === item.id ? '' : item.id); setSelectedVersion(item.version); setReason(''); setInspectionId(''); setError(''); };
  return <Card padding="none" className="overflow-hidden" role="region" aria-label="Antecedentes para inspección">
    <header className="border-b border-neutral-200 p-4"><h2 className="flex items-center gap-2 text-lg font-bold text-neutral-950"><FileSearch size={22} className="shrink-0 text-primary-700" aria-hidden="true" />Antecedentes para inspección</h2>
      <p className="mt-2 text-sm text-neutral-600">Hallazgos de manifiestos, participantes sin alta y relevos externos.</p>
      <p className="mt-1 text-sm text-neutral-600">Administración evalúa los antecedentes y decide si abre o vincula una inspección. No son infracciones comprobadas.</p>
      {query.data?.puedeEvaluar === false && <p className="mt-2 text-sm font-medium text-neutral-800">Tu acceso es de consulta. La administración del actor debe evaluar estos antecedentes; los externos sin identificar corresponden a jefatura general.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="relative"><span className="sr-only">Buscar antecedente</span><Search size={17} className="absolute left-3 top-3 text-neutral-500" /><input className="h-11 w-full rounded-lg border border-neutral-300 pl-9 pr-2 text-base" placeholder="Manifiesto o actor" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <select aria-label="Estado del antecedente" className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-base" value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{Object.entries(INTAKE_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Actor del antecedente" className="h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-base" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">Todos los actores</option>{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </header>
    {!online ? <p role="status" className="p-4 text-sm text-amber-950">Sin conexión. Los antecedentes requieren datos actuales del servidor.</p> : query.isError ? <div role="alert" className="p-4"><p>No se pudieron actualizar los antecedentes. No significa que no existan.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : query.isPending ? <p role="status" className="p-4">Cargando antecedentes…</p> : <>
      <p role="status" className="border-b border-neutral-100 px-4 py-2 text-sm text-neutral-600"><span className="font-semibold tabular-nums text-neutral-900">{query.data?.total ?? 0}</span> {query.data?.total === 1 ? 'antecedente' : 'antecedentes'} · {state ? INTAKE_STATE_LABELS[state] : 'Todos los estados'}</p>
      {!query.data?.items.length && <p className="p-5 text-sm text-neutral-600">Sin antecedentes para estos filtros.</p>}
      <ul className="divide-y divide-neutral-200">{query.data?.items.map(item => <li key={item.id}>
        <button type="button" aria-expanded={selectedId === item.id} className="flex w-full items-center gap-3 p-4 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700" onClick={() => choose(item)}>
          <span className="rounded-lg bg-primary-50 p-2 text-primary-700">{item.origen === 'RELEVO_EXTERNO' ? <Truck size={20} /> : <FileSearch size={20} />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-neutral-950">{item.referencia}</p><p className="truncate text-sm text-neutral-700">{item.actorNombre} · {INSPECTION_ACTOR_LABELS[item.tipoActor]}</p><p className="mt-1 text-xs text-neutral-600">{originLabel[item.origen]} · {inspectionDate(item.createdAt)} · {INTAKE_STATE_LABELS[item.estado]}</p></div><ChevronRight size={18} className="shrink-0 text-primary-700" />
        </button>
        {selectedId === item.id && <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/60 p-4">
          <div className="flex flex-wrap gap-2">{item.motivos.map(motive => <span key={motive} className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">{INTAKE_REASON_LABELS[motive] || motive}</span>)}</div>
          <p className="break-words text-sm text-neutral-800">{item.evidencia.motivo}</p>
          {item.evidencia.formato === 'SITREP-INFORME-HALLAZGO-1' && <OperatorFindingSummary finding={item.evidencia as OperatorFinding} />}
          {item.evidencia.participante && <dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(partyLabels).map(([field, label]) => item.evidencia.participante?.[field] ? <div key={field}><dt className="text-xs text-neutral-500">{label}</dt><dd className="break-words font-medium text-neutral-900">{item.evidencia.participante[field]}</dd></div> : null)}<div><dt className="text-xs text-neutral-500">Vínculo de padrón</dt><dd>Sin alta vinculada · identidad pendiente de verificar</dd></div></dl>}
          {item.inspeccion && <Link className="inline-flex min-h-11 items-center font-semibold text-primary-800 underline" to={`${mobile ? '/mobile' : ''}/inspecciones/${item.inspeccion.id}`}>Seguir expediente {item.inspeccion.numero}</Link>}
          {item.estado === 'VINCULADA' && !item.inspeccion && <p className="text-sm text-neutral-600">Expediente vinculado de acceso restringido. Conserva la asignación y los permisos de PSIP.</p>}
          {!!query.data?.puedeEvaluar && item.estado !== 'VINCULADA' && <div className="space-y-3 border-t border-neutral-200 pt-3">
            {stale && <p role="alert" className="text-sm text-amber-950">Otra persona actualizó este antecedente. Revisá el historial antes de continuar. <button type="button" className="min-h-11 font-semibold underline" onClick={() => { setSelectedVersion(item.version); setError(''); }}>Usar versión actual</button></p>}
            {(item.actorId || query.data?.puedeAbrirExterno) && item.estado !== 'DESCARTADA' && <Button variant="outline" disabled={stale || busy} leftIcon={<ClipboardPlus size={17} />} onClick={() => onCreate(item)}>Abrir inspección</Button>}
            {!item.actorId && !query.data?.puedeAbrirExterno && <p className="text-sm text-neutral-600">El jefe de inspecciones o el administrador general debe abrir este caso sin alta en el padrón.</p>}
            <label className="block text-sm font-semibold text-neutral-800">Motivo de evaluación<textarea value={reason} maxLength={1000} rows={2} className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-3 text-base font-normal" onChange={event => setReason(event.target.value)} /></label>
            <div className="flex flex-wrap gap-2"><Button disabled={stale || busy || reason.trim().length < 3} onClick={() => void decide('EN_EVALUACION')}>Tomar en evaluación</Button><Button variant="outline" disabled={stale || busy || reason.trim().length < 3} onClick={() => void decide('DESCARTADA')}>Descartar con motivo</Button></div>
            <label className="block text-sm font-semibold text-neutral-800">Vincular a un expediente existente<select className="mt-1 h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-base font-normal" value={inspectionId} onChange={event => setInspectionId(event.target.value)}><option value="">Seleccionar expediente…</option>{candidates.data?.items.filter(inspection => (item.actorId ? inspection.tipoActor === item.tipoActor : !inspection.tipoActor) && eventualLinkAllowed(item, inspection)).map(inspection => <option key={inspection.id} value={inspection.id}>{inspection.numero}</option>)}</select></label>
            {candidates.isError && <p role="alert" className="text-sm text-error-800">No se pudieron cargar los expedientes. <button type="button" className="min-h-11 underline" onClick={() => void candidates.refetch()}>Reintentar expedientes</button></p>}
            {(candidates.data?.total || 0) > 100 && <p className="text-xs text-neutral-600">Se muestran los primeros 100 expedientes accesibles. La vinculación también puede realizarse desde administración.</p>}
            <Button variant="outline" disabled={stale || busy || !inspectionId || reason.trim().length < 3} onClick={() => void decide('VINCULADA')}>Vincular expediente</Button>
            {error && <p role="alert" className="text-sm text-error-800">{error}</p>}
          </div>}
          {item.eventos.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Historial de evaluación</summary><ul className="space-y-2 text-sm">{item.eventos.map(event => <li key={event.id}><p className="font-semibold">{INTAKE_STATE_LABELS[event.accion] || event.accion} · {inspectionDate(event.fecha, true)}</p><p>{event.motivo}</p></li>)}</ul></details>}
          <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-neutral-600">Referencia y huella de evidencia</summary><p className="break-all text-xs text-neutral-600">{item.origenId} · SHA-256 {item.huellaEvidencia}</p></details>
        </div>}
      </li>)}</ul>
      {(query.data?.total || 0) > 20 && <nav aria-label="Páginas de antecedentes" className="flex items-center justify-between border-t border-neutral-200 p-3"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">{page} / {Math.ceil((query.data?.total || 0) / 20)}</span><Button variant="outline" disabled={page * 20 >= (query.data?.total || 0)} onClick={() => setPage(page + 1)}>Siguiente</Button></nav>}
    </>}
  </Card>;
}

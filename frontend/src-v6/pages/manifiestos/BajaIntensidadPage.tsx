import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

type Waste = { corriente: string; cantidad: number; unidad: string };
type Participant = { nombre: string; identificacion: string; domicilio: string; padronId?: string };
type Entry = {
  id: string; referencia: string; version: number; etapa: string; puedeRegistrar: boolean; puedeResolver: boolean;
  datos: { generador: Participant; transportista: Participant; patente: string; motivo: string; residuos: Waste[] };
  revisiones: { objetivo: string; estado: string; solicitada: boolean }[];
  eventos: { id: string; tipo: string; nota: string; fecha: string; autorId: string; etapa?: string; residuos?: Waste[]; decision?: string }[];
};
const endpoint = '/manifiestos/baja-intensidad';
const emptyActor = (): Participant => ({ nombre: '', identificacion: '', domicilio: '' });
const stageLabels: Record<string, string> = { REGISTRADO: 'Registrado', RETIRADO: 'Retirado', RECIBIDO: 'Recibido', TRATADO: 'Tratado' };
const nextStages: Record<string, string> = { REGISTRADO: 'RETIRADO', RETIRADO: 'RECIBIDO', RECIBIDO: 'TRATADO' };
const labels: Record<string, string> = { AVANCE: 'Movimiento registrado', DIFERENCIA: 'Diferencia registrada', SOLICITAR_REVISION: 'Revisión solicitada', RESOLVER: 'Resolución posterior' };

function ParticipantFields({ title, value, onChange }: { title: string; value: Participant; onChange: (v: Participant) => void }) {
  const { currentUser } = useAuth();
  const [lookup, setLookup] = useState(false);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const externalDraft = useRef(value);
  const query = useQuery({ queryKey: ['baja-intensidad-participantes', currentUser?.id, title, submittedSearch], enabled: lookup,
    queryFn: async () => (await api.get(endpoint + '/participantes', { params: { tipo: title.toLowerCase(), q: submittedSearch } })).data.data.participantes as Participant[],
    retry: false, staleTime: 60000 });
  const participants = query.data || [];
  const choices = participants.some(p => p.padronId === value.padronId) || !value.padronId ? participants : [value, ...participants];
  return <fieldset className="space-y-3 min-w-0"><legend className="font-semibold mb-2">{title} · {value.padronId ? 'Del padrón' : 'Sin alta'}</legend>
    <Button type="button" variant="outline" size="sm" onClick={() => {
      if (!lookup) { if (!value.padronId) externalDraft.current = value; setLookup(true); }
      else { onChange(externalDraft.current); setLookup(false); }
    }}>{lookup ? title + ' · Usar datos declarados' : title + ' · Buscar en padrón'}</Button>
    {lookup && <div className="space-y-2">
      <Input label={title + ' · Buscar por nombre o CUIT'} value={search} onChange={e => setSearch(e.target.value)} />
      <Button type="button" variant="outline" size="sm" onClick={() => setSubmittedSearch(search)}>Buscar {title.toLowerCase()}</Button>
      <Select label={title + ' del padrón'} value={value.padronId || ''} options={choices.map(p => ({ value: p.padronId!, label: p.nombre + ' · ' + p.identificacion }))}
        onChange={id => { const actor = choices.find(p => p.padronId === id); if (actor) onChange(actor); }}
        placeholder={query.isFetching ? 'Buscando…' : 'Elegir participante'} />
      {query.isError && <p role="alert">No se pudo consultar el padrón. Conservamos los datos declarados.</p>}
    </div>}
    <Input label={title + ' · Nombre o razón social'} required readOnly={!!value.padronId} maxLength={500} value={value.nombre} onChange={e => onChange({ ...value, nombre: e.target.value })} />
    <Input label={title + ' · Identificación declarada'} required readOnly={!!value.padronId} maxLength={500} placeholder="CUIT o referencia disponible" value={value.identificacion} onChange={e => onChange({ ...value, identificacion: e.target.value })} />
    <Input label={title + ' · Domicilio'} required readOnly={!!value.padronId} maxLength={500} value={value.domicilio} onChange={e => onChange({ ...value, domicilio: e.target.value })} />
  </fieldset>;
}
function WasteFields({ value, onChange }: { value: Waste; onChange: (v: Waste) => void }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <Input label="Corriente" required pattern="Y[0-9]{1,3}" placeholder="Y1" value={value.corriente} onChange={e => onChange({ ...value, corriente: e.target.value.toUpperCase() })} />
    <Input label="Cantidad" required type="number" min="0.001" step="any" inputMode="decimal" value={value.cantidad || ''} onChange={e => onChange({ ...value, cantidad: Number(e.target.value) })} />
    <label className="text-sm font-medium">Unidad<select className="mt-1 block w-full h-11 border border-neutral-300 rounded-lg px-3 bg-white text-base" value={value.unidad} onChange={e => onChange({ ...value, unidad: e.target.value })}>
      {['kg', 'l', 't', 'm3'].map(unit => <option key={unit}>{unit}</option>)}
    </select></label>
  </div>;
}
export default function BajaIntensidadPage() {
  const { currentUser } = useAuth();
  const mp = useMobilePrefix();
  const [params, setParams] = useSearchParams();
  const id = params.get('registro');
  const listPage = Math.max(1, Math.floor(Number(params.get('pagina')) || 1));
  const enabled = import.meta.env.VITE_MANIFEST_EXCEPTIONAL_ENABLED === 'true';
  const qc = useQueryClient();
  const queryKey = id ? ['baja-intensidad', currentUser?.id, id] : ['baja-intensidad', currentUser?.id, null, listPage];
  const query = useQuery({ queryKey, enabled: enabled && !!currentUser,
    queryFn: async () => (await api.get(id ? endpoint + '/' + id : endpoint + '?page=' + listPage)).data.data as { registro?: Entry; registros?: Entry[]; total?: number },
    retry: false });
  const [creating, setCreating] = useState(false);
  const [generador, setGenerador] = useState(emptyActor);
  const [transportista, setTransportista] = useState(emptyActor);
  const [patente, setPatente] = useState('');
  const [motivo, setMotivo] = useState('');
  const [wastes, setWastes] = useState<Waste[]>([{ corriente: '', cantidad: 0, unidad: 'kg' }]);
  const [nota, setNota] = useState('');
  const [difference, setDifference] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // Retained on failed requests. Repeating the same command cannot duplicate facts.
  const request = useRef<{ signature: string; id: string } | undefined>(undefined);
  const creationId = useRef(crypto.randomUUID());
  async function send(path: string, body: Record<string, unknown>, created = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const signature = JSON.stringify({ path, body });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const result: Entry = (await api.post(path, { ...body, id: created ? creationId.current : request.current.id })).data.data.registro;
      qc.setQueryData(['baja-intensidad', currentUser?.id, result.id], { registro: result });
      setParams({ registro: result.id }); setCreating(false); setDifference(false); setNota('');
      if (created) creationId.current = crypto.randomUUID();
      request.current = undefined;
    } catch (caught) {
      const failure = caught as { response?: { data?: { message?: string } } };
      setError(failure.response?.data?.message || 'No se pudo confirmar. Tus datos siguen aquí; podés reintentar.');
    } finally { lock.current = false; setBusy(false); }
  }
  const entry = query.data?.registro;
  const event = (body: Record<string, unknown>) => entry && send(endpoint + '/' + entry.id + '/eventos', { ...body, version: entry.version });
  const wasteInputs = <div className="space-y-3">{wastes.map((waste, index) => <fieldset key={index} className="space-y-2">
    <legend className="text-sm font-semibold mb-2">Residuo {index + 1}</legend>
    <WasteFields value={waste} onChange={value => setWastes(rows => rows.map((row, i) => i === index ? value : row))} />
    {wastes.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setWastes(rows => rows.filter((_, i) => i !== index))}>Quitar residuo {index + 1}</Button>}
  </fieldset>)}
    <Button type="button" variant="outline" disabled={wastes.length >= 50} onClick={() => setWastes(rows => [...rows, { corriente: '', cantidad: 0, unidad: 'kg' }])}>Agregar residuo</Button>
  </div>;
  if (!enabled) return <p className="p-6">Circuito no habilitado.</p>;
  return <div className="max-w-4xl mx-auto py-5 space-y-4 pb-24">
    <Link className="text-primary-700 underline text-sm" to={mp('/manifiestos')}>Manifiestos</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-neutral-900">Baja intensidad</h1>
      {!id && currentUser?.rol === 'OPERADOR' && <Button onClick={() => setCreating(v => !v)} variant="outline">{creating ? 'Volver a registros' : 'Registrar operación'}</Button>}
      {id && <Button variant="outline" onClick={() => setParams({})}>Ver registros</Button>}
    </div>
    <p className="text-sm text-neutral-600">Referencia interna · Sin número oficial. Registrar no implica aprobación ni habilitación.</p>
    {error && <div role="alert" className="p-3 bg-error-50 text-error-800 rounded-lg">{error} <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Recargar registro</Button></div>}
    {query.isError && <div role="alert">No se pudo cargar el registro. <Button onClick={() => void query.refetch()}>Reintentar</Button></div>}
    {query.isLoading && <p role="status">Cargando registros…</p>}
    {creating && !id && <Card><form className="space-y-5" onSubmit={e => { e.preventDefault(); void send(endpoint, { generador, transportista, patente, motivo, residuos: wastes }, true); }}>
      <div className="grid sm:grid-cols-2 gap-5"><ParticipantFields title="Generador" value={generador} onChange={setGenerador} /><ParticipantFields title="Transportista" value={transportista} onChange={setTransportista} /></div>
      <Input label="Patente declarada" required maxLength={20} value={patente} onChange={e => setPatente(e.target.value)} />
      {wasteInputs}
      <Input label="Motivo del registro excepcional" required maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
      <Button type="submit" disabled={busy}>Guardar operación</Button>
    </form></Card>}
    {!id && !creating && <div className="space-y-3">
      <p className="text-sm text-neutral-600">{query.data?.total ?? '—'} registros · Página {listPage}</p>
      {query.data?.registros?.map(row => <Card key={row.id}><button className="text-left w-full min-h-11 space-y-1" onClick={() => setParams({ registro: row.id })}>
        <span className="block font-semibold">{row.datos.generador.nombre}</span><span className="block text-sm">{stageLabels[row.etapa]} · {row.revisiones.filter(r => r.estado !== 'APROBADA').length} revisiones pendientes</span>
        <span className="block text-xs text-neutral-600 break-all">{row.referencia}</span>
      </button></Card>)}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={listPage <= 1 || query.isFetching} onClick={() => setParams({ pagina: String(listPage - 1) })}>Anterior</Button>
        <Button variant="outline" disabled={listPage * 20 >= (query.data?.total ?? 0) || query.isFetching} onClick={() => setParams({ pagina: String(listPage + 1) })}>Siguiente</Button>
      </div>
    </div>}
    {entry && <div className="space-y-4">
      <Card><p className="text-xs break-all text-neutral-600">{entry.referencia}</p><h2 className="font-bold text-lg mt-2">{entry.datos.generador.nombre}</h2>
        <p>{entry.datos.transportista.nombre} · {entry.datos.patente}</p>
        <p className="font-semibold mt-3" role="status" aria-label="Estado operativo">Operación: {stageLabels[entry.etapa]}</p>
        <p className="text-sm text-amber-900 mt-1">Regularización pendiente · Compatibilidad de corrientes sin verificar</p>
        <h3 className="font-semibold mt-4">Declaración original</h3>
        {entry.datos.residuos.map((r, i) => <p key={i}>{r.corriente} · {r.cantidad} {r.unidad}</p>)}
        <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">Identidades declaradas</summary>
          {[entry.datos.generador, entry.datos.transportista].map((p, i) => <p key={i} className="break-words">{p.nombre} · {p.identificacion} · {p.domicilio} · {p.padronId ? 'Vinculado al padrón' : 'Sin alta'}</p>)}
          <p>{entry.datos.motivo}</p>
        </details>
      </Card>
      {(entry.puedeRegistrar || entry.puedeResolver) && <Input label="Nota de la acción" helperText="Opcional para movimientos; requerida para diferencias y revisiones." maxLength={500} value={nota} onChange={e => setNota(e.target.value)} />}
      {entry.puedeRegistrar && <Card><div className="flex flex-wrap gap-3">
        {nextStages[entry.etapa] && <Button disabled={busy} onClick={() => void event({ tipo: 'AVANCE', etapa: nextStages[entry.etapa], nota })}>Registrar {stageLabels[nextStages[entry.etapa]].toLowerCase()}</Button>}
        <Button variant="outline" onClick={() => setDifference(v => !v)}>{difference ? 'Cerrar diferencia' : 'Registrar diferencia'}</Button>
      </div>
      {difference && <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); void event({ tipo: 'DIFERENCIA', nota, residuos: wastes }); }}>
        <p className="text-sm">Carga observada completa; no se suma automáticamente al original.</p>
        {wasteInputs}<Button type="submit" disabled={busy || !nota.trim()}>Guardar diferencia</Button>
      </form>}</Card>}
      <Card><h2 className="font-semibold mb-3">Revisión posterior</h2><div className="space-y-4">
        {entry.revisiones.map((review, i) => <section key={review.objetivo} aria-label={i === 0 ? 'Revisión original' : 'Revisión diferencia ' + i} className="border-b border-neutral-200 pb-3 last:border-0">
          <h3 className="font-medium">{i === 0 ? 'Registro original' : 'Diferencia ' + i}</h3>
          <p className="text-sm mb-2">{review.estado === 'APROBADA' ? 'Conformidad aprobada' : review.estado === 'OBSERVADA' ? 'Observada · requiere atención' : review.estado === 'RECHAZADA' ? 'Conformidad rechazada · hechos conservados' : 'Pendiente de conformidad'}{review.solicitada ? ' · Revisión solicitada' : ''}</p>
          <div className="flex flex-wrap gap-2">
            {entry.puedeRegistrar && <Button variant="outline" disabled={busy || !nota.trim()} onClick={() => void event({ tipo: 'SOLICITAR_REVISION', objetivo: review.objetivo, nota })}>Solicitar revisión</Button>}
            {entry.puedeResolver && review.solicitada && <>
              <Button disabled={busy || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'APROBADA', nota })}>Aprobar post facto</Button>
              <Button variant="outline" disabled={busy || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'OBSERVADA', nota })}>Observar</Button>
              <Button variant="outline" disabled={busy || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'RECHAZADA', nota })}>Rechazar conformidad</Button>
            </>}
          </div>
        </section>)}
      </div></Card>
      <Card><h2 className="font-semibold mb-3">Historial</h2><ol className="space-y-3">
        {entry.eventos.map(e => <li key={e.id} className="border-l-2 border-primary-200 pl-3 text-sm">
          <p className="font-medium">{labels[e.tipo]}{e.etapa ? ' · ' + stageLabels[e.etapa] : ''}{e.decision ? ' · ' + e.decision : ''}</p><p className="break-words">{e.nota}</p>
          {e.residuos?.map((r, i) => <p key={i}>{r.corriente} · {r.cantidad} {r.unidad}</p>)}
          <time className="text-neutral-600">{new Date(e.fecha).toLocaleString('es-AR')}</time>
        </li>)}
      </ol></Card>
    </div>}
  </div>;
}

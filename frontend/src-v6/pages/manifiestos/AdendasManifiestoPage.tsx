import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';

type Waste = { corriente: string; cantidad: number; unidad: string };
type Adenda = { id: string; motivo: string; rectificaId: string | null; version: number; estadoRevision: string; puedeResolver: boolean;
  creadoPorId: string; createdAt: string; residuos: Waste[]; declaracion: { numero: string; residuos: Waste[] };
  revisiones: { id: string; autorId: string; fecha: string; decision: string; nota: string }[] };
type Data = { adendas: Adenda[]; total: number; puedeRegistrar: boolean; manifiesto: { numero: string; estado: string } };
const labels: Record<string, string> = { PENDIENTE: 'Pendiente de revisión', APROBADA: 'Aprobada post facto', OBSERVADA: 'Observada', RECHAZADA: 'Conformidad rechazada' };
const emptyWaste = (): Waste => ({ corriente: '', cantidad: 0, unidad: 'kg' });
function Load({ rows }: { rows: Waste[] }) {
  return <ul className="space-y-1">{rows.map((row, i) => <li key={i}>{row.corriente} · {row.cantidad} {row.unidad}</li>)}</ul>;
}
export default function AdendasManifiestoPage() {
  const { id } = useParams(); const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const enabled = import.meta.env.VITE_MANIFEST_ADDENDA_ENABLED === 'true';
  const [page, setPage] = useState(1); const qc = useQueryClient();
  const key = ['manifiesto-adendas', currentUser?.id, id];
  const endpoint = `/manifiestos/${encodeURIComponent(id || '')}/adendas`;
  const query = useQuery({ queryKey: [...key, page], enabled: enabled && !!id && !!currentUser,
    queryFn: async () => (await api.get(endpoint, { params: { page } })).data.data as Data, retry: false });
  const [creating, setCreating] = useState(false); const [rectificaId, setRectificaId] = useState<string | undefined>();
  const [wastes, setWastes] = useState<Waste[]>([emptyWaste()]); const [motivo, setMotivo] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState('');
  const lock = useRef(false); const pending = useRef<{ signature: string; id: string } | undefined>(undefined);
  async function send(path: string, body: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSaved('');
    const signature = JSON.stringify({ path, body });
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    try {
      await api.post(path, { ...body, id: pending.current.id });
      // Refresh bounded lists, including fresh shared caches. Never mutate the manifest cache or declaration.
      await qc.invalidateQueries({ queryKey: key });
      setCreating(false); setRectificaId(undefined); setMotivo(''); setWastes([emptyWaste()]); setNotes({});
      setSaved('Adenda actualizada. El manifiesto conserva su declaración y su estado operativo.'); pending.current = undefined;
    } catch (cause: unknown) {
      const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'No se pudo guardar. Conservamos tus datos para reintentar.');
    } finally { lock.current = false; setBusy(false); }
  }
  if (!enabled) return <p>Adendas no habilitadas.</p>;
  const data = query.data;
  return <section className="mx-auto w-full max-w-4xl space-y-4 py-6" aria-label="Adendas del manifiesto">
    <Link to={mp(`/manifiestos/${id}`)} className="text-primary-700 underline">Volver al manifiesto</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">Adendas · {data?.manifiesto.numero || 'Manifiesto'}</h1>
      {data?.puedeRegistrar && !creating && <Button onClick={() => { setCreating(true); setSaved(''); }}>Registrar diferencia</Button>}
    </div>
    {data && <p className="text-sm text-neutral-600">Operación: {data.manifiesto.estado}. La revisión de adendas no detiene el circuito.</p>}
    {query.isPending && <p role="status">Cargando adendas…</p>}
    {query.isError && <p role="alert">No se pudieron cargar las adendas. <Button variant="outline" onClick={() => void query.refetch()}>Reintentar carga</Button></p>}
    {error && <p role="alert" className="text-error-700">{error} <Button variant="outline" onClick={() => void query.refetch()}>Actualizar revisiones</Button></p>}
    {saved && <p role="status">{saved}</p>}
    {creating && <Card className="p-4"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void send(endpoint, { motivo, residuos: wastes, ...(rectificaId ? { rectificaId } : {}) }); }}>
      <h2 className="font-semibold">{rectificaId ? 'Rectificar mediante una nueva adenda' : 'Carga observada completa'}</h2>
      <p className="text-sm text-neutral-600">No se suma automáticamente a lo declarado. Compatibilidad de corrientes pendiente de verificar.</p>
      {wastes.map((row, i) => <fieldset key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-0"><legend className="sr-only">Residuo {i + 1}</legend>
        <Input label={`Corriente observada ${i + 1}`} required pattern="Y[0-9]{1,3}" maxLength={4} placeholder="Y1" value={row.corriente} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, corriente: e.target.value.toUpperCase() } : v))} />
        <Input label={`Cantidad observada ${i + 1}`} required type="number" inputMode="decimal" min="0.001" max="1000000000000" step="any" value={row.cantidad || ''} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, cantidad: Number(e.target.value) } : v))} />
        <label className="text-sm font-medium">Unidad observada {i + 1}<select className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base" value={row.unidad} onChange={e => setWastes(wastes.map((v, n) => n === i ? { ...v, unidad: e.target.value } : v))}>
          {['kg', 'l', 't', 'm3'].map(unit => <option key={unit}>{unit}</option>)}
        </select></label>
        {wastes.length > 1 && <Button type="button" variant="ghost" onClick={() => setWastes(wastes.filter((_, n) => n !== i))}>Quitar residuo {i + 1}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={wastes.length >= 50 || busy} onClick={() => setWastes([...wastes, emptyWaste()])}>Agregar corriente</Button>
      <Input label="Motivo de la adenda" required maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Guardar y solicitar revisión</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cerrar formulario</Button></div>
    </form></Card>}
    {data && <>
      {data.total === 0 && <p>Todavía no hay adendas.</p>}
      {data.adendas.map((item, i) => <Card key={item.id} className="p-4 space-y-3" role="region" aria-label={`Adenda ${item.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Adenda {data.total - (page - 1) * 20 - i}</h2><span role="status" aria-label="Estado de revisión">{labels[item.estadoRevision]}</span></div>
        <p className="break-words">{item.motivo}</p>
        <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="font-medium">Declaración conservada</h3><Load rows={item.declaracion.residuos} /></div><div><h3 className="font-medium">Carga observada</h3><Load rows={item.residuos} /></div></div>
        {item.rectificaId && <p className="text-sm break-all">Rectifica adenda {item.rectificaId}; el antecedente se conserva.</p>}
        <p className="text-sm text-amber-800">Compatibilidad de corrientes sin verificar. Registrar no implica habilitación.</p>
        {item.puedeResolver && <div className="space-y-2"><Input id={`resolucion-${item.id}`} label="Motivo de resolución" maxLength={500} value={notes[item.id] || ''} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} />
          <div className="flex flex-wrap gap-2">{[['APROBADA', 'Aprobar post facto'], ['OBSERVADA', 'Observar'], ['RECHAZADA', 'Rechazar conformidad']].map(([decision, label]) => <Button key={decision} variant="outline" disabled={busy || !notes[item.id]?.trim()} onClick={() => void send(endpoint + '/' + item.id + '/revisiones', { version: item.version, decision, nota: notes[item.id] })}>{label}</Button>)}</div>
        </div>}
        {data.puedeRegistrar && <Button variant="outline" disabled={busy} onClick={() => { setRectificaId(item.id); setWastes(item.residuos.map(r => ({ ...r }))); setMotivo(''); setCreating(true); setSaved(''); }}>Agregar rectificación</Button>}
        <details><summary className="cursor-pointer py-2 text-sm">Trazabilidad de la adenda</summary><p className="text-sm break-all">{item.id} · {item.createdAt} · {item.creadoPorId}</p>
          <ul className="space-y-2">{item.revisiones.map(r => <li key={r.id} className="text-sm break-words">{labels[r.decision]} · {r.nota}<span className="block text-neutral-600 break-all">{r.fecha} · {r.autorId}</span></li>)}</ul>
        </details>
      </Card>)}
      {data.total > 20 && <nav aria-label="Páginas de adendas" className="flex items-center gap-3"><Button variant="outline" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Anterior</Button><span>{page} / {Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={page * 20 >= data.total || busy} onClick={() => setPage(page + 1)}>Siguiente</Button></nav>}
    </>}
  </section>;
}

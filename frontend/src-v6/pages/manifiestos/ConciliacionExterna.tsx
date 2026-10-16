import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
type Entry = { id: string; accion: string; revision: number; motivo: string; autorId: string; createdAt: string;
  ficha: { razonSocial: string; cuit: string } | null };
type Result = { revision: number; vinculo: Entry | null; historial: Entry[]; puedeRevisar: boolean; pendiente: string | null;
  candidato: { id: string; razonSocial: string; cuit: string; domicilio: string | null } | null };

export default function ConciliacionExterna({ id, rol, userId }: { id: string; rol: string; userId: string | number }) {
  const endpoint = '/manifiestos/baja-intensidad/' + encodeURIComponent(id) + '/conciliacion';
  const [motivo, setMotivo] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const query = useQuery({ queryKey: ['conciliacion-externa', userId, id, rol], retry: false,
    queryFn: async () => (await api.get(endpoint, { params: { rol } })).data.data as Result });
  const data = query.data;
  async function confirm() {
    if (!data || inFlight.current || !motivo.trim()) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await api.post(endpoint, { id: crypto.randomUUID(), revision: data.revision, rol,
        accion: data.vinculo ? 'DESVINCULAR' : 'VINCULAR',
        ...(!data.vinculo ? { actorId: data.candidato?.id } : {}), motivo: motivo.trim() });
      setMotivo(''); await query.refetch();
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'No se pudo confirmar. Recargá el vínculo antes de volver a intentar.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="space-y-3 border-t border-neutral-200 pt-3" aria-label="Conciliación con el padrón" role="region">
    {query.isFetching && <p role="status">Consultando vínculo…</p>}
    {query.isError && <p role="alert">No se pudo consultar el vínculo.</p>}
    <Button variant="outline" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>Recargar vínculo</Button>
    {data && !query.isError && <>
      <p className="font-semibold break-words">{data.vinculo ? 'Vinculado a ' + data.vinculo.ficha?.razonSocial : 'Sin vínculo confirmado'}</p>
      {data.pendiente && <p className="text-sm text-neutral-700">{data.pendiente}</p>}
      {!data.vinculo && data.candidato && <div className="text-sm break-words">
        <p>Ficha coincidente: <strong>{data.candidato.razonSocial}</strong></p>
        <p>CUIT {data.candidato.cuit} · {data.candidato.domicilio || 'Sin domicilio'}</p>
      </div>}
      <p className="text-sm text-neutral-600">Conserva lo declarado. No cambia cantidades, permisos ni aprobaciones.</p>
      {data.puedeRevisar && (data.vinculo || data.candidato) ? <form className="space-y-2" onSubmit={e => { e.preventDefault(); void confirm(); }}>
        <Input label="Motivo de conciliación" value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} disabled={busy} />
        <Button type="submit" disabled={busy || query.isFetching || !motivo.trim()}>{busy ? 'Confirmando…' : data.vinculo ? 'Desvincular y conservar historia' : 'Confirmar vínculo'}</Button>
      </form> : !data.puedeRevisar && <p className="text-sm text-neutral-600">Confirma el revisor designado.</p>}
      {data.historial.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Historial de conciliación ({data.revision})</summary>
        <ol className="space-y-2 text-sm">{data.historial.map(entry => <li key={entry.id} className="break-words">
          <strong>Revisión {entry.revision} · {entry.accion === 'VINCULAR' ? 'Vinculado' : 'Desvinculado'}</strong>
          <p>{entry.motivo}</p><p>{entry.ficha?.razonSocial} {entry.ficha?.cuit}</p>
          <p className="text-xs break-all">{new Date(entry.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })} · Revisor {entry.autorId}</p>
        </li>)}</ol>{data.revision > 50 && <p>Últimas 50 revisiones. Las anteriores se conservan en auditoría.</p>}
      </details>}
    </>}
    {error && <p role="alert" className="text-error-700">{error}</p>}
  </div>;
}

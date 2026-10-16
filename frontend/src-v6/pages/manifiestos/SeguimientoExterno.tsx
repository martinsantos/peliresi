import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';

type Result = { total: number; primera: string | null; ultima: string | null; pageSize: number;
  cantidades: { corriente: string; unidad: string; cantidad: string }[];
  registros: { id: string; createdAt: string; etapa: string; operador: string;
    participante: { nombre: string; identificacion: string; domicilio: string; telefono?: string; nombreFantasia?: string } }[] };
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short' }).format(new Date(value));
export default function SeguimientoExterno() {
  const { currentUser } = useAuth(); const mp = useMobilePrefix();
  const [role, setRole] = useState('generador'), [identity, setIdentity] = useState('');
  const [filters, setFilters] = useState({ rol: 'generador', identificacion: '', page: 1 });
  const query = useQuery({ queryKey: ['seguimiento-externo', currentUser?.id, currentUser?.rol, filters],
    queryFn: async () => (await api.get('/manifiestos/baja-intensidad/seguimiento', { params: filters })).data.data as Result,
    retry: false });
  const data = query.data;
  return <section aria-label="Seguimiento de participantes externos" className="space-y-4">
    <h2 className="text-lg font-semibold">Participantes sin vínculo al padrón</h2>
    <p className="text-sm text-neutral-600">Datos declarados, identidad por verificar. No acredita una infracción.</p>
    <Card><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setFilters({ rol: role, identificacion: identity.trim(), page: 1 }); }}>
      <div className="text-sm font-medium"><label htmlFor="external-participant-type">Tipo de participante</label>
        <select id="external-participant-type" value={role} onChange={e => setRole(e.target.value)} className="block mt-1 min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base">
          <option value="generador">Generador</option><option value="transportista">Transportista</option>
        </select>
      </div>
      <div className="min-w-0 flex-1 basis-52"><Input label="Identificación exacta" maxLength={500} placeholder="CUIT o referencia declarada" value={identity} onChange={e => setIdentity(e.target.value)} /></div>
      <Button type="submit" disabled={query.isFetching}>Consultar</Button>
      <Button type="button" variant="outline" disabled={query.isFetching} onClick={() => { setIdentity(''); setFilters({ rol: role, identificacion: '', page: 1 }); }}>Ver todos</Button>
    </form></Card>
    {query.isFetching && <p role="status">Consultando movimientos…</p>}
    {query.isError && <div role="alert">No se pudo consultar el seguimiento. <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>}
    {data && !query.isError && <>
      <Card role="region" aria-label="Resumen del seguimiento" className="space-y-2">
        <p className="font-semibold">{data.total} {data.total === 1 ? 'movimiento' : 'movimientos'} · {filters.rol === 'generador' ? 'Generadores' : 'Transportistas'}</p>
        {data.primera && data.ultima && <p className="text-sm">{date(data.primera)} — {date(data.ultima)}</p>}
        <p className="text-sm text-neutral-600">Carga original declarada en todas las coincidencias; no suma adendas ni identifica personas únicas.</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Cantidades por corriente y unidad">{data.cantidades.map(row =>
          <li key={row.corriente + row.unidad}>{row.corriente} · {row.cantidad} {row.unidad}</li>)}</ul>
      </Card>
      {data.total === 0 && <p>No hay movimientos para estos filtros.</p>}
      {data.registros.map(row => <Card key={row.id} className="space-y-2" role="region" aria-label={'Movimiento BI-' + row.id}>
        <h3 className="font-semibold break-words">{row.participante.nombre || 'Participante por identificar'}</h3>
        <p className="text-sm break-words">{row.participante.identificacion || 'Identificación pendiente'} · {date(row.createdAt)}</p>
        <p className="text-sm break-words">Informado por {row.operador} · {row.etapa}</p>
        <details><summary className="cursor-pointer py-2 text-sm">Datos declarados</summary>
          <p className="text-sm break-words">{[row.participante.nombreFantasia, row.participante.domicilio, row.participante.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
          <p className="text-xs break-all">BI-{row.id}</p>
        </details>
        <Link className="inline-flex min-h-11 items-center text-primary-700 underline" to={mp('/manifiestos/baja-intensidad') + '?registro=' + encodeURIComponent(row.id)}>Ver registro</Link>
      </Card>)}
      <nav aria-label="Páginas del seguimiento" className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={filters.page <= 1 || query.isFetching} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Anterior</Button>
        <span className="text-sm">Página {filters.page}</span>
        <Button variant="outline" disabled={filters.page * data.pageSize >= data.total || query.isFetching} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Siguiente</Button>
      </nav>
    </>}
  </section>;
}

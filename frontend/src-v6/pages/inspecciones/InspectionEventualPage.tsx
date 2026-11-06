import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import type { InspectionActorType } from '../../types/inspection';
import { INSPECTION_ACTOR_LABELS } from './inspectionPresentation';

interface Source {
  numero: string;
  referencia: string;
  etapa: string;
  partes: { tipoActor: InspectionActorType; actorNombre: string }[];
}

export default function InspectionEventualPage() {
  const { id, eventualId } = useParams();
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: ['inspeccion-eventual', inspectionWorkspaceOwner(currentUser), currentUser?.id, id, eventualId],
    enabled: Boolean(currentUser && id && eventualId),
    queryFn: async () => (await api.get<{ data: Source }>(`/inspecciones/${id}/eventuales/${eventualId}`)).data.data,
    retry: false,
  });
  return <main className="mx-auto max-w-3xl space-y-4 p-4">
    <Link className="inline-flex min-h-11 items-center text-primary-800 underline" relative="path" to="../..#firma">Volver a la inspección</Link>
    <h1 className="text-xl font-bold">Eventual de origen</h1>
    {query.isLoading && <p role="status">Cargando eventual…</p>}
    {query.isError && <p role="alert">No se pudo consultar este eventual desde la inspección. <button className="min-h-11 underline" onClick={() => void query.refetch()}>Reintentar</button></p>}
    {query.data && <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="break-all font-semibold">{query.data.referencia}</h2>
      <p>Origen de la inspección {query.data.numero}</p>
      <p>Estado del eventual · {query.data.etapa.toLowerCase()}</p>
      {query.data.partes.map(p => <p key={p.tipoActor}><strong>{p.actorNombre}</strong> · {INSPECTION_ACTOR_LABELS[p.tipoActor]} declarado fuera del padrón</p>)}
    </section>}
  </main>;
}

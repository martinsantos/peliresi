import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Card, CardHeader, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';

type History = {
  habilitado: boolean; fichaCorrientes: string[]; disponible: boolean;
  excepciones: { id: string; origen: 'ADENDA' | 'MANIFIESTO'; manifiestoId: string; numero: string | null; corrientes: string[]; motivo: string;
    otorgadaAt: string; estado: 'ABIERTA' | 'CERRADA'; cerradaAt: string | null; cierre: { motivo?: string; fuente?: string } | null }[];
};
const date = (value: string) => new Date(value).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
const CLOSING: Record<string, string> = { EDICION_FICHA: 'alta en la ficha', RENOVACION: 'renovación aprobada', CONTROL: 'control administrativo' };

/** Generator history of exceptions for streams outside its ficha (one open at a time). */
export function GeneratorCurrentExceptionHistory({ generadorId, linkTo = path => path }: { generadorId: string; linkTo?: (path: string) => string }) {
  const query = useQuery({ queryKey: ['generator-current-exceptions', generadorId], retry: false,
    queryFn: async () => (await api.get(`/actores/generadores/${generadorId}/excepciones-corriente`)).data.data as History });
  const data = query.data;
  if (query.isError || !data || (!data.habilitado && !data.excepciones.length)) return null;
  return <Card>
    <CardHeader title="Excepciones por corriente no inscripta" />
    <CardContent>
      <p className="mb-3 text-sm text-neutral-700">
        {data.disponible ? 'Sin excepción abierta: la autoridad puede otorgar una única excepción si aparece una corriente fuera de la ficha.'
          : 'Hay una excepción abierta: ninguna otra corriente fuera de la ficha puede moverse hasta el alta en la ficha.'}
      </p>
      {!data.excepciones.length ? <p className="text-sm text-neutral-500">No hay excepciones registradas.</p>
        : <ul className="space-y-2">{data.excepciones.map(e => <li key={e.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-neutral-900">{e.corrientes.join(', ')}</span>
            <Badge variant="soft" color={e.estado === 'ABIERTA' ? 'warning' : 'success'}>{e.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}</Badge>
            <span className="text-neutral-600">{e.origen === 'ADENDA' ? 'Hallazgo en adenda' : 'Declarada en el manifiesto'} · {date(e.otorgadaAt)}</span>
          </div>
          <p className="mt-1 text-neutral-700">Motivo: {e.motivo}</p>
          {e.estado === 'CERRADA' && <p className="text-neutral-600">Cerrada {e.cerradaAt ? 'el ' + date(e.cerradaAt) + ' ' : ''}por {CLOSING[e.cierre?.fuente || ''] || 'alta en la ficha'}.</p>}
          {e.numero && <Link className="inline-flex min-h-11 items-center font-semibold text-primary-800 underline" to={linkTo(`/manifiestos/${e.manifiestoId}${e.origen === 'ADENDA' ? '/adendas' : ''}`)}>Ver {e.numero}</Link>}
        </li>)}</ul>}
    </CardContent>
  </Card>;
}

import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/ButtonV2';

type Status = {
  habilitado: boolean; estado?: 'AUTORIZADAS' | 'SIN_FICHA' | 'REQUIERE_EXCEPCION' | 'BLOQUEADA' | 'CUBIERTAS_POR_EXCEPCION';
  corrientes?: string[]; mensaje?: string | null; puedeOtorgar?: boolean; fichaGenerador?: string[];
  excepcion?: { id: string; corrientes: string[]; otorgadaAt: string; cerradaAt: string | null; motivo: string } | null;
};
const errorMessage = (cause: unknown, fallback: string) =>
  (cause as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** A Y outside the generator's ficha: who must act before the parties approve, and the authority's grant. */
export function GeneratorCurrentExceptionPanel({ manifiestoId }: { manifiestoId: string }) {
  const qc = useQueryClient();
  const key = ['manifest-current-exception', manifiestoId];
  const query = useQuery({ queryKey: key, retry: false, staleTime: 0,
    queryFn: async () => (await api.get(`/manifiestos/${manifiestoId}/excepcion-corriente`)).data.data as Status });
  const [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const data = query.data;
  if (!data?.habilitado || !data.estado || ['AUTORIZADAS', 'SIN_FICHA'].includes(data.estado)) return null;
  const ys = (data.corrientes?.length ? data.corrientes : data.excepcion?.corrientes || []).join(', ');
  async function grant() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.post(`/manifiestos/${manifiestoId}/excepcion-corriente`, { motivo });
      setMotivo('');
      await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['manifiestos', 'detail', manifiestoId] })]);
    } catch (cause) { setError(errorMessage(cause, 'No se pudo registrar la excepción. Tu motivo se conserva para reintentar.')); }
    finally { lock.current = false; setBusy(false); }
  }
  if (data.estado === 'CUBIERTAS_POR_EXCEPCION') return <section aria-label="Excepción de corriente" className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900">
    <p className="font-semibold">Excepción otorgada · {ys}</p>
    <p>La autoridad de aplicación otorgó la única excepción disponible del generador. Queda abierta hasta el alta de {ys} en su ficha.</p>
    {data.excepcion?.motivo && <p className="mt-1 text-neutral-700">Motivo: {data.excepcion.motivo}</p>}
  </section>;
  return <section aria-label="Corriente no inscripta en la ficha del generador" role="alert" className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <div>
      <p className="font-semibold">{data.estado === 'BLOQUEADA' ? `Corriente no inscripta reiterada · ${ys}` : `Corriente no inscripta · ${ys}`}</p>
      <p>{data.mensaje}</p>
      {!!data.fichaGenerador?.length && <p className="mt-1 text-amber-900">Ficha del generador: {data.fichaGenerador.join(', ')}</p>}
    </div>
    {data.puedeOtorgar && <div className="space-y-2">
      <label className="block font-semibold text-neutral-900">Motivo de la excepción
        <textarea value={motivo} maxLength={1000} rows={2} onChange={event => setMotivo(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-3 text-base font-normal" />
      </label>
      <p className="text-neutral-800">Es la única excepción del generador: hasta el alta de {ys} en su ficha no podrá mover ninguna otra corriente no inscripta.</p>
      <Button className="min-h-11" disabled={busy || motivo.trim().length < 10} isLoading={busy} onClick={() => void grant()}>Otorgar excepción</Button>
    </div>}
    {error && <p role="alert" className="text-error-800">{error}</p>}
  </section>;
}

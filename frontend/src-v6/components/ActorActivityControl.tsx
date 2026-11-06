import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Button } from './ui/ButtonV2';

type Props = { registry: 'generadores' | 'transportistas' | 'operadores'; id: string; active: boolean };

export function ActorActivityControl({ registry, id, active }: Props) {
  const [confirming, setConfirming] = useState(false);
  const cache = useQueryClient();
  const edit = useMutation({
    mutationFn: (activate: boolean) => api.put('/actores/' + registry + '/' + id, { activo: activate }),
    onSuccess: async () => {
      await Promise.all([registry, 'actor-directory', 'historial-actor'].map(key => cache.invalidateQueries({ queryKey: [key] })));
      setConfirming(false);
    },
  });
  const action = active ? 'Desactivar actividad' : 'Reactivar actividad';
  if (!confirming) return <Button variant="outline" onClick={() => { edit.reset(); setConfirming(true); }}>{action}</Button>;
  return <div className="space-y-2" role="group" aria-label={action}>
    <p>{active ? 'Se suspenderá la operación de esta actividad. La cuenta, sus demás actividades y el historial se conservan.' : 'Se habilitará nuevamente esta actividad.'}</p>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => edit.mutate(!active)} disabled={edit.isPending}>{'Confirmar ' + (active ? 'desactivación' : 'reactivación')}</Button>
      <Button variant="outline" onClick={() => setConfirming(false)} disabled={edit.isPending}>Cancelar</Button>
    </div>
    {edit.isError && <p role="alert">No se pudo cambiar el estado. Volvé a intentarlo.</p>}
  </div>;
}

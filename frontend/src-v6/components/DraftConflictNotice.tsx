import React from 'react';
import { Button } from './ui/ButtonV2';

export function DraftConflictNotice({ durable, count, onReload, onKeep, canKeep = true, canReload = true }: {
  durable: boolean; count: number; onReload: () => void; onKeep: () => void; canKeep?: boolean; canReload?: boolean;
}) {
  return <div role="alert" className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-900">
    <p className="font-semibold">Este borrador cambió en otra pestaña</p>
    <p className="mt-1">{durable
      ? 'Guardamos ambas versiones en este dispositivo. Podés cerrar y retomar; elegí una versión para continuar.'
      : 'Tu texto sigue aquí, pero no pudimos guardar esta copia. Mantené esta pantalla abierta hasta resolverlo.'}</p>
    {count > 1 && <p className="mt-1">Quedan {count} copias pendientes de revisar, una por vez.</p>}
    {!canKeep && <p className="mt-1">Hay un envío sin confirmar o una copia que no se puede leer. Revisá las versiones antes de continuar.</p>}
    {!canReload && <p className="mt-1">Esta versión tiene un envío sin confirmar; no la reemplaces antes de comprobarlo.</p>}
    <div className="mt-2 flex flex-wrap gap-2">
      {canReload && <Button type="button" variant="outline" onClick={onReload}>Cargar la otra versión</Button>}
      {canKeep && <Button type="button" variant="outline" onClick={onKeep}>Conservar mi versión</Button>}
    </div>
  </div>;
}

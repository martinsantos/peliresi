import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';
import { Button } from './ui/ButtonV2';
import { NativeSelect } from './ui/NativeSelect';

interface Props {
  cuit: string;
  scope: string;
  role: string;
  actor: string;
  labels: Record<string, string>;
  busy: boolean;
  onRole: (value: string) => void;
  onActor: (value: string) => void;
  onLink: (actorId: string) => void;
}

/** A catalog is evidence for a choice, never permission to replace that choice. */
export function CompanyActivityLink({ cuit, scope, role, actor, labels, busy, onRole, onActor, onLink }: Props) {
  const hintId = useId();
  const catalog = useQuery({
    queryKey: ['company-role-catalogs', scope, role, cuit],
    queryFn: () => role === 'GENERADOR' ? catalogoService.generadores()
      : role === 'TRANSPORTISTA' ? catalogoService.transportistas() : catalogoService.operadores(),
    enabled: Object.prototype.hasOwnProperty.call(labels, role),
    retry: false,
  });
  const options = (catalog.data || []).filter(item => item.activo === true && String(item.cuit).replace(/\D/g, '') === cuit);
  const selected = options.find(item => item.id === actor);
  const verified = catalog.isSuccess && !catalog.isFetching;
  const unavailable = verified && !!actor && !selected;
  const canLink = verified && !!selected && !busy;
  const hint = catalog.isFetching || catalog.isPending ? `Consultando fichas de ${labels[role]}…`
    : catalog.isError ? `No pudimos consultar las fichas de ${labels[role]}. Conservamos tu elección; reintentá antes de vincular.`
    : !verified ? `Consultando fichas de ${labels[role]}…`
    : unavailable ? 'La ficha elegida ya no está disponible para vincular. Elegí otra ficha activa del mismo CUIT.'
    : !options.length ? `No hay fichas activas del mismo CUIT para ${labels[role]}. Revisá el CUIT y el estado de la ficha en el padrón.`
    : !selected ? 'Elegí la ficha que querés vincular.' : '';
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
    event.preventDefault();
    if (canLink && selected) onLink(selected.id);
  }}>
    <NativeSelect label="Actividad a vincular" value={role} onChange={onRole} disabled={busy}>
      {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </NativeSelect>
    <NativeSelect label="Ficha del mismo CUIT" value={selected?.id || ''} onChange={onActor}
      disabled={!verified || busy || !options.length} aria-describedby={hint ? hintId : undefined} aria-invalid={unavailable || undefined}>
      <option value="">Elegí una ficha</option>
      {options.map(item => <option key={item.id} value={item.id}>{item.razonSocial} · {String(item.numeroInscripcion || item.numeroHabilitacion || '')}</option>)}
    </NativeSelect>
    {hint && <p id={hintId} role={catalog.isError ? 'alert' : 'status'} className="text-sm text-neutral-700 sm:col-span-2">{hint}</p>}
    {catalog.isError && <Button variant="outline" disabled={busy || catalog.isFetching} onClick={() => void catalog.refetch()}>Reintentar fichas</Button>}
    <Button type="submit" disabled={!canLink}>Vincular actividad existente</Button>
  </form>;
}

import { useEffect, useRef } from 'react';
import type { useInvitationPreparation } from '../hooks/useInvitationPreparation';
import { Button } from './ui/ButtonV2';

type Props = {
  preparation: ReturnType<typeof useInvitationPreparation>;
  activityLabel: string;
  busy: boolean;
  onCheck: () => void;
};
export function InvitationPreparationNotice({ preparation, activityLabel, busy, onCheck }: Props) {
  const notice = useRef<HTMLDivElement>(null);
  const { pending, checked, result, checking, storageFailed } = preparation;
  useEffect(() => { if (!busy && (pending || result)) notice.current?.focus(); }, [busy, pending, result]);
  if (busy || !pending && !result) return null;
  return <div ref={notice} tabIndex={-1} role="status" className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-700">
    <h2 className="font-semibold">{pending ? 'Comprobar preparación de invitación' : 'Preparación comprobada'}</h2>
    {(pending || checked) && <p className="mt-2 break-words">{(pending || checked)?.email} · {activityLabel}</p>}
    {pending && <>
      <p className="my-2 text-sm">No recibimos una confirmación completa. Comprobá el resultado antes de preparar otra invitación o autorizar a esta persona.</p>
      <Button type="button" variant="outline" disabled={checking} onClick={onCheck}>
        {checking ? 'Consultando…' : 'Comprobar preparación'}
      </Button>
    </>}
    {result && <p className="mt-2 text-sm">{result}</p>}
    {storageFailed && <p className="mt-2 text-sm">No pudimos actualizar la copia en este dispositivo. Mantené esta pantalla abierta hasta comprobar el resultado.</p>}
  </div>;
}

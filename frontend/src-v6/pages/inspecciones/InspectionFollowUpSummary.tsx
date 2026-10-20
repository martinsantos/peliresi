import { Clock3, UserRound } from 'lucide-react';
import type { InspectionFollowUp, InspectionState } from '../../types/inspection';
import { inspectionDeadlineDate, inspectionFollowUpStatus, inspectionLegalFollowUp } from './inspectionProcess';

/** Same source and wording for the staff list and the inspected party's portal. */
export function InspectionFollowUpSummary({ seguimiento, now, state }: { seguimiento?: InspectionFollowUp; now: number; state?: InspectionState }) {
  const status = inspectionFollowUpStatus(seguimiento, now);
  const legal = state ? inspectionLegalFollowUp(state) : null;
  return <div data-testid="inspection-follow-up" className="mt-2 min-w-0 space-y-1 text-xs leading-5">
    <p className={`flex items-start gap-1.5 font-semibold ${status.overdue ? 'text-error-800' : 'text-primary-800'}`}>
      <UserRound size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{!legal && seguimiento?.paso === 'RESPONDER' ? 'Inspeccionado: ' : ''}{legal?.label || status.label}</span>
    </p>
    {!legal && status.next && <p className="flex items-start gap-1.5 text-neutral-600"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Pedido #{status.next.secuencia} · {inspectionDeadlineDate(status.next.plazoRespuestaAt)}{status.next.plazoRespuestaAt ? ' · Mendoza' : ''}</span></p>}
  </div>;
}

import { Clock3, UserRound } from 'lucide-react';
import type { InspectionFollowUp } from '../../types/inspection';
import { inspectionDeadlineDate, inspectionFollowUpStatus } from './inspectionProcess';

/** Same source and wording for the staff list and the inspected party's portal. */
export function InspectionFollowUpSummary({ seguimiento, now }: { seguimiento?: InspectionFollowUp; now: number }) {
  const status = inspectionFollowUpStatus(seguimiento, now);
  return <div data-testid="inspection-follow-up" className="mt-2 min-w-0 space-y-1 text-xs leading-5">
    <p className={`flex items-start gap-1.5 font-semibold ${status.overdue ? 'text-error-800' : 'text-primary-800'}`}>
      <UserRound size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{seguimiento?.paso === 'RESPONDER' ? 'Inspeccionado: ' : ''}{status.label}</span>
    </p>
    {status.next && <p className="flex items-start gap-1.5 text-neutral-600"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Pedido #{status.next.secuencia} · {inspectionDeadlineDate(status.next.plazoRespuestaAt)}{status.next.plazoRespuestaAt ? ' · Mendoza' : ''}</span></p>}
  </div>;
}

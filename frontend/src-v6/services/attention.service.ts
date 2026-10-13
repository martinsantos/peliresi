import { supportService } from './support.service';
import { solicitudService } from './solicitud.service';

export async function supportPending(): Promise<number> {
  const { puedeGestionar } = await supportService.access();
  const states = puedeGestionar ? ['ABIERTO', 'EN_CURSO'] : ['ESPERANDO_USUARIO'];
  const totals = await Promise.all(states.map(estado => supportService.list({ scope: puedeGestionar ? 'mesa' : 'mis', estado, page: 1 })));
  return totals.reduce((sum, result) => sum + result.total, 0);
}
export async function applicationTotals() {
  const states = ['ENVIADA', 'EN_REVISION', 'OBSERVADA', 'APROBADA'] as const;
  const totals = await Promise.all(states.map(estado => solicitudService.list({ estado, page: 1, limit: 1 })));
  return Object.fromEntries(states.map((state, index) => [state, totals[index].total])) as Record<typeof states[number], number>;
}

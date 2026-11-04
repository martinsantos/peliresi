import { supportRequestContext } from '../utils/supportSession';
import { supportService } from './support.service';
import { solicitudService } from './solicitud.service';

function assertContext(owner: string) {
  if (!owner || supportRequestContext() !== owner) throw new Error('El contexto cambió. Volvé a consultar los pendientes.');
}
function count(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('No se pudo comprobar la cantidad de pendientes.');
  return value;
}

export async function supportPending(): Promise<number> {
  const owner = supportRequestContext(); assertContext(owner);
  const { puedeGestionar } = await supportService.access();
  assertContext(owner);
  const states = puedeGestionar ? ['ABIERTO', 'EN_CURSO'] : ['ESPERANDO_USUARIO'];
  const totals = await Promise.all(states.map(estado => supportService.list({ scope: puedeGestionar ? 'mesa' : 'mis', estado, page: 1 })));
  assertContext(owner);
  return count(totals.reduce((sum, result) => sum + count(result.total), 0));
}
export async function applicationTotals() {
  const owner = supportRequestContext(); assertContext(owner);
  const states = ['ENVIADA', 'EN_REVISION', 'OBSERVADA', 'APROBADA'] as const;
  const totals = await Promise.all(states.map(estado => solicitudService.list({ estado, page: 1, limit: 1 })));
  assertContext(owner);
  return Object.fromEntries(states.map((state, index) => [state, count(totals[index].total)])) as Record<typeof states[number], number>;
}

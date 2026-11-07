import { splitDeclaredWasteStreams } from '../services/inspectionDeclaredSnapshot.service';

/**
 * A generator's authorized Y streams are exactly the ones registered in its
 * ficha (`corrientesControl`). Decided 2026-11-07: the ficha is the only source;
 * the migrated streams are copied into it once (see backfillGeneratorCurrents).
 */
export function generatorAuthorizedCurrents(corrientesControl: unknown): string[] {
  return splitDeclaredWasteStreams(corrientesControl);
}

/** Canonical ficha text; parses back to exactly the same set. */
export function formatCurrents(currents: string[]): string {
  return [...new Set(splitDeclaredWasteStreams(currents))]
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')) || a.localeCompare(b))
    .join(', ');
}

export const cuitDigits = (cuit: unknown) => String(cuit ?? '').replace(/\D/g, '');

export type BackfillChange = { id: string; antes: string | null; despues: string };
/** Only empty fichas are completed; an edited ficha is never overwritten. */
export function generatorCurrentsBackfillPlan(
  generators: { id: string; cuit: string | null; corrientesControl: string | null }[],
  migrated: Record<string, { cuit?: string; categoriasControl?: unknown }>,
) {
  const byCuit = new Map<string, string[]>();
  for (const [key, row] of Object.entries(migrated)) {
    const currents = splitDeclaredWasteStreams(row?.categoriasControl);
    if (currents.length) byCuit.set(cuitDigits(row?.cuit || key), currents);
  }
  const changes: BackfillChange[] = [];
  let conFicha = 0, sinDatos = 0;
  for (const g of generators) {
    if (generatorAuthorizedCurrents(g.corrientesControl).length) { conFicha++; continue; }
    const currents = byCuit.get(cuitDigits(g.cuit));
    if (!currents) { sinDatos++; continue; }
    changes.push({ id: g.id, antes: g.corrientesControl, despues: formatCurrents(currents) });
  }
  return { changes, conFicha, sinDatos, total: generators.length };
}

export type CurrentException = { id: string; corrientes: string[]; manifiestoId: string; cerradaAt: Date | string | null };

/** Open = some Y it exempted is still outside the current ficha. Evaluated live,
 * so a ficha edited by any path is honoured even before the closing hook runs. */
export function openExceptions<T extends CurrentException>(exceptions: T[], authorized: string[]): T[] {
  const allowed = new Set(authorized);
  return exceptions.filter(e => !e.cerradaAt && e.corrientes.some(y => !allowed.has(y)));
}
/** Recorded-open exceptions that the ficha now covers: close them for the history. */
export function exceptionsCoveredByFicha<T extends CurrentException>(exceptions: T[], authorized: string[]): T[] {
  const allowed = new Set(authorized);
  return exceptions.filter(e => !e.cerradaAt && e.corrientes.every(y => allowed.has(y)));
}

export type CurrentsDecision =
  | { estado: 'AUTORIZADAS' }
  | { estado: 'SIN_FICHA' }
  | { estado: 'CUBIERTAS_POR_EXCEPCION'; excepcionId: string }
  | { estado: 'REQUIERE_EXCEPCION'; corrientes: string[] }
  | { estado: 'BLOQUEADA'; corrientes: string[]; excepcionAbierta: { id: string; corrientes: string[]; manifiestoId: string } };

/**
 * One rule for every gate (addendum approval, manifest approval, manifest creation):
 * - Y inside the ficha: nothing to authorize.
 * - Empty ficha: never blocks; the authority must complete the registration.
 * - Y outside the ficha already exempted for THIS manifest: same event, not a new occurrence.
 * - Otherwise the generator may hold a single open exception; with one open,
 *   any further Y outside the ficha (same or different) is refused until registered.
 */
export function decideGeneratorCurrents(input: {
  corrientes: string[]; authorized: string[]; manifiestoId: string; exceptions: CurrentException[];
}): CurrentsDecision {
  if (!input.authorized.length) return { estado: 'SIN_FICHA' };
  const allowed = new Set(input.authorized);
  const outside = [...new Set(input.corrientes)].filter(y => !allowed.has(y)).sort();
  if (!outside.length) return { estado: 'AUTORIZADAS' };
  const open = openExceptions(input.exceptions, input.authorized);
  const own = open.find(e => e.manifiestoId === input.manifiestoId && outside.every(y => e.corrientes.includes(y)));
  if (own) return { estado: 'CUBIERTAS_POR_EXCEPCION', excepcionId: own.id };
  const other = open.find(e => e.manifiestoId !== input.manifiestoId) || open[0];
  if (other) return { estado: 'BLOQUEADA', corrientes: outside, excepcionAbierta: { id: other.id, corrientes: other.corrientes, manifiestoId: other.manifiestoId } };
  return { estado: 'REQUIERE_EXCEPCION', corrientes: outside };
}

export function currentsDecisionMessage(decision: CurrentsDecision, moment: 'ADENDA' | 'APROBACION' | 'CREACION'): string | null {
  if (decision.estado === 'BLOQUEADA') {
    const where = moment === 'CREACION' ? 'No se puede crear el manifiesto' : moment === 'ADENDA' ? 'No se puede aprobar la adenda' : 'No se puede aprobar el manifiesto';
    return `${where}: ${decision.corrientes.join(', ')} no figura en la ficha del generador y ya tiene una excepción abierta por ${decision.excepcionAbierta.corrientes.join(', ')}. Sólo el alta de esa corriente en la ficha permite una nueva excepción.`;
  }
  if (decision.estado === 'REQUIERE_EXCEPCION') {
    return moment === 'ADENDA'
      ? `${decision.corrientes.join(', ')} no figura en la ficha del generador. Sólo la autoridad de aplicación puede aprobar esta adenda, y al hacerlo otorga la única excepción disponible del generador.`
      : `${decision.corrientes.join(', ')} no figura en la ficha del generador. La autoridad de aplicación debe otorgar la excepción antes de las aprobaciones.`;
  }
  return null;
}

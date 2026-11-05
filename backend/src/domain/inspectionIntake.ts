import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export type ObservedWaste = { corriente: string; cantidad: number; unidad: string };
export type WasteDifference = { corriente: string; unidad: string; declarado: number | null; observado: number | null; tipo: 'CANTIDAD_DIFERENTE' | 'Y_OMITIDA' | 'NO_OBSERVADA' | 'UNIDAD_DIFERENTE' };
export const findingAtDestination = (role: string, state: string) => role === 'OPERADOR'
  && ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(state);

/** Compare like units only. Never sum kg with t or infer an unobserved stream is zero. */
export function wasteDifferences(declared: ObservedWaste[], observed: ObservedWaste[]): WasteDifference[] {
  const totals = (rows: ObservedWaste[]) => {
    const result = new Map<string, { corriente: string; unidad: string; cantidad: number }>();
    for (const row of rows) {
      // Equivalent spellings only, never conversion between kg and tonnes.
      // The declaration and observed rows retain their literal unit.
      const unit = row.unidad === 'lt' ? 'l' : row.unidad === 'tn' ? 't' : row.unidad;
      const key = `${row.corriente}:${unit}`;
      result.set(key, { corriente: row.corriente, unidad: row.unidad, cantidad: (result.get(key)?.cantidad || 0) + row.cantidad });
    }
    return result;
  };
  const original = totals(declared), actual = totals(observed), differences: WasteDifference[] = [];
  for (const [key, row] of actual) {
    const before = original.get(key);
    const tipo = !declared.some(item => item.corriente === row.corriente) ? 'Y_OMITIDA'
      : !before ? 'UNIDAD_DIFERENTE' : Math.abs(before.cantidad - row.cantidad) > 4 * Number.EPSILON * Math.max(1, before.cantidad, row.cantidad) ? 'CANTIDAD_DIFERENTE' : null;
    if (tipo) differences.push({ corriente: row.corriente, unidad: row.unidad, declarado: before?.cantidad ?? null, observado: row.cantidad, tipo });
  }
  for (const [key, row] of original) if (!actual.has(key) && !observed.some(item => item.corriente === row.corriente)) {
    differences.push({ corriente: row.corriente, unidad: row.unidad, declarado: row.cantidad, observado: null, tipo: 'NO_OBSERVADA' });
  }
  return differences;
}

export function intakeScope(user: { id?: string; rol?: string; esInspector?: boolean; esJefeInspecciones?: boolean }): Prisma.AntecedenteFiscalizacionWhereInput {
  if (user.rol === 'ADMIN' || user.esJefeInspecciones) return {};
  const type = /^ADMIN_(GENERADOR|TRANSPORTISTA|OPERADOR)$/.exec(user.rol || '')?.[1];
  if (type) return { tipoActor: type as 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' };
  return user.esInspector && user.id ? { inspeccion: { inspectorId: user.id } } : { id: { in: [] } };
}
export const intakeDecisionSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative(),
  accion: z.enum(['EN_EVALUACION', 'DESCARTADA', 'VINCULADA']),
  motivo: z.string().trim().min(3).max(1000),
  inspeccionId: z.string().min(1).max(100).optional(),
}).strict().refine(value => (value.accion === 'VINCULADA') === !!value.inspeccionId, { message: 'Indicá el expediente sólo para vincular una inspección' });

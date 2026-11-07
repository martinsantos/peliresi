/**
 * Completes the generator migration: copies each generator's migrated Y streams
 * (backend/data/generadores-enrichment.json) into its ficha (`corrientesControl`).
 *
 *   node dist/scripts/backfillGeneratorCurrents.js            # dry run, counts only
 *   node dist/scripts/backfillGeneratorCurrents.js --apply    # writes, one audit row per change
 *   node dist/scripts/backfillGeneratorCurrents.js --revert   # undoes rows this script wrote, if untouched since
 *
 * Only empty fichas are completed; a ficha edited later is never overwritten.
 * Prints counts only: no names or CUITs. Production use requires explicit authorization.
 */
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { generatorCurrentsBackfillPlan } from '../domain/generatorCurrents';

export const BACKFILL_ACTION = 'COMPLETAR_CORRIENTES_MIGRADAS';
const SOURCE = 'generadores-enrichment.json';

export async function backfillGeneratorCurrents(db: PrismaClient, migrated: Record<string, { cuit?: string; categoriasControl?: unknown }>, mode: 'dry' | 'apply' | 'revert') {
  if (mode === 'revert') {
    const audits = await db.auditoria.findMany({ where: { accion: BACKFILL_ACTION, modulo: 'GENERADORES' }, orderBy: { createdAt: 'desc' } });
    let revertidos = 0, conservados = 0;
    for (const audit of audits) {
      const before = JSON.parse(audit.datosAntes || '{}').corrientesControl ?? null;
      const after = JSON.parse(audit.datosDespues || '{}').corrientesControl;
      // Conditional: revert only if nobody edited the ficha after the backfill.
      const done = await db.generador.updateMany({ where: { id: audit.generadorId || '', corrientesControl: after }, data: { corrientesControl: before } });
      if (done.count) revertidos++; else conservados++;
    }
    return { modo: mode, revertidos, conservadosPorEdicionPosterior: conservados };
  }
  const generators = await db.generador.findMany({ select: { id: true, cuit: true, corrientesControl: true } });
  const plan = generatorCurrentsBackfillPlan(generators, migrated);
  const summary = { modo: mode, total: plan.total, yaConFicha: plan.conFicha, aCompletar: plan.changes.length, sinDatosMigrados: plan.sinDatos, completados: 0 };
  if (mode !== 'apply') return summary;
  for (const change of plan.changes) {
    await db.$transaction(async tx => {
      // Idempotent and race-safe: only a still-empty ficha is completed.
      const done = await tx.generador.updateMany({ where: { id: change.id, OR: [{ corrientesControl: null }, { corrientesControl: '' }] }, data: { corrientesControl: change.despues } });
      if (!done.count) return;
      await tx.auditoria.create({ data: { accion: BACKFILL_ACTION, modulo: 'GENERADORES', generadorId: change.id,
        datosAntes: JSON.stringify({ corrientesControl: change.antes }),
        datosDespues: JSON.stringify({ corrientesControl: change.despues, fuente: SOURCE }) } });
      summary.completados++;
    });
  }
  return summary;
}

if (require.main === module) {
  const mode = process.argv.includes('--revert') ? 'revert' : process.argv.includes('--apply') ? 'apply' : 'dry';
  const migrated = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', SOURCE), 'utf8'));
  const db = new PrismaClient();
  backfillGeneratorCurrents(db, migrated, mode)
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => db.$disconnect());
}

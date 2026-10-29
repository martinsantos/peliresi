import cron from 'node-cron';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { hasConfiguredTransitThreshold, matchesAlertCondition } from '../services/alertRuleCondition.service';
import { catalogueCondition } from '../services/alertCataloguePolicy.service';
import { followupDays } from '../services/alertFollowupPolicy.service';
import { alertaSubscriber } from '../subscribers/alerta.subscriber';
import { isTrainingSession } from '../lib/trainingScope';

/** An active duration rule must have an explicit lower bound; other follow-up
 * families share this event name and are evaluated by their own jobs. */
function isDurationRule(condition: string): boolean {
  try {
    return followupDays(condition) === null && catalogueCondition(condition) === null
      && hasConfiguredTransitThreshold(condition);
  } catch {
    return false;
  }
}

/** Evaluate elapsed time even if the device has not submitted a new point. */
export async function evaluarDuracionTransito(now?: Date): Promise<{ evaluados: number; errores: number }> {
  if (now && !Number.isFinite(now.getTime())) throw new Error('Fecha de evaluación inválida');
  if (isTrainingSession()) return { evaluados: 0, errores: 0 };
  const rules = await prisma.reglaAlerta.findMany({
    where: { evento: 'TIEMPO_EXCESIVO', activa: true }, select: { condicion: true },
  });
  const durationRules = rules.filter(rule => isDurationRule(rule.condicion));
  if (!durationRules.length) return { evaluados: 0, errores: 0 };
  // The threshold and the transaction's final check use the same clock source,
  // even when application workers and PostgreSQL run on different hosts.
  const at = now ?? (await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`)[0]?.now;
  if (!at || !Number.isFinite(at.getTime())) throw new Error('No se pudo obtener la hora de evaluación');

  let cursor: string | undefined;
  let evaluados = 0, errores = 0;
  for (;;) {
    const batch = await prisma.manifiesto.findMany({
      where: { estado: 'EN_TRANSITO', isDemoData: false, fechaRetiro: { lte: at } }, select: { id: true },
      orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of batch) {
      try {
        // The trip may have been delivered since this page was selected.
        const current = await prisma.manifiesto.findUnique({ where: { id: row.id },
          select: { id: true, numero: true, estado: true, fechaRetiro: true, isDemoData: true } });
        if (!current || current.estado !== 'EN_TRANSITO' || current.isDemoData || !current.fechaRetiro) continue;
        const horasTransito = (at.getTime() - current.fechaRetiro.getTime()) / 3_600_000;
        if (!Number.isFinite(horasTransito) || horasTransito < 0) continue;
        const facts = { manifiestoId: current.id, numero: current.numero, horasTransito };
        // Most trips will be below their configured threshold. Do not start
        // transactions or re-query all rules for them on every sweep.
        if (!durationRules.some(rule => matchesAlertCondition(rule.condicion, facts))) continue;
        await alertaSubscriber({ type: 'DURACION_TRANSITO_OBSERVADA', manifiestoId: current.id,
          numero: current.numero, horasTransito });
        evaluados++;
      } catch (error) {
        errores++;
        logger.error({ manifiestoId: row.id, error: error instanceof Error ? error.message : String(error) }, 'Transit duration evaluation failed');
      }
    }
    if (batch.length < 100) break;
    cursor = batch[batch.length - 1].id;
  }
  return { evaluados, errores };
}

export function iniciarDuracionTransitoJob(): void {
  if ((process.env.NODE_APP_INSTANCE || process.env.pm_id || '0') !== '0') return;
  let running = false;
  cron.schedule('*/5 * * * *', async () => {
    if (running) return;
    running = true;
    try {
      const result = await evaluarDuracionTransito();
      if (result.errores) logger.error(result, 'Transit duration evaluation incomplete');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Transit duration evaluation failed');
    } finally {
      running = false;
    }
  });
}

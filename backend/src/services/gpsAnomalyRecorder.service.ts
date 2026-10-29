import { Prisma, PrismaClient } from '@prisma/client';
import type { DomainEvent } from './domainEvent.service';
import { defaultGpsAnomalyNotice, saveDefaultAdminNotices } from './defaultAdminNotice.service';

/** A detector observation and its default inbox notices commit together.
 * Other event subscribers and external channels still run after this commit. */
export async function recordGpsAnomaly(
  db: Pick<PrismaClient, '$transaction'>,
  data: Prisma.AnomaliaTransporteCreateManyInput,
  event: Extract<DomainEvent, { type: 'ANOMALIA_GPS' }>,
) {
  return db.$transaction(async tx => {
    const created = await tx.anomaliaTransporte.createMany({ data: [data], skipDuplicates: true });
    if (!created.count) return { created: false, notices: [] };
    const notices = await saveDefaultAdminNotices(tx, defaultGpsAnomalyNotice(event));
    return { created: true, notices };
  }, { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000 });
}

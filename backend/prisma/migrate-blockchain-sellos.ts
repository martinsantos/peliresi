/**
 * Migration script: Convert existing blockchain data to BlockchainSello records.
 *
 * For manifiestos with blockchainStatus = 'CONFIRMADO':
 * 1. Create BlockchainSello tipo=GENESIS with existing data
 * 2. Compute initial rollingHash for APROBADO state
 *
 * Run: npx ts-node prisma/migrate-blockchain-sellos.ts
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function computeRollingHash(input: {
  previousHash: string | null;
  genesisBlockchainTimestamp: string | null;
  estado: string;
  fecha: string;
  eventCount: number;
  observaciones: string | null;
}): string {
  const canonical = JSON.stringify({
    previousHash: input.previousHash ?? null,
    genesisTs: input.genesisBlockchainTimestamp ?? null,
    estado: input.estado,
    fecha: input.fecha,
    eventCount: input.eventCount,
    observaciones: input.observaciones ?? null,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function main() {
  const manifiestos = await prisma.manifiesto.findMany({
    where: {
      blockchainStatus: 'CONFIRMADO',
      blockchainHash: { not: null },
    },
    select: {
      id: true,
      numero: true,
      blockchainHash: true,
      blockchainTxHash: true,
      blockchainBlockNumber: true,
      blockchainTimestamp: true,
      fechaFirma: true,
      observaciones: true,
      sellosBlockchain: { select: { id: true } },
    },
  });

  console.log(`Found ${manifiestos.length} manifiestos with CONFIRMADO blockchain status`);

  let migrated = 0;
  let skipped = 0;

  for (const m of manifiestos) {
    // Skip if already has sello records
    if (m.sellosBlockchain.length > 0) {
      skipped++;
      continue;
    }

    try {
      // Create GENESIS sello from existing blockchain fields
      await prisma.blockchainSello.create({
        data: {
          manifiestoId: m.id,
          tipo: 'GENESIS',
          hash: m.blockchainHash!,
          txHash: m.blockchainTxHash,
          blockNumber: m.blockchainBlockNumber,
          blockTimestamp: m.blockchainTimestamp,
          status: 'CONFIRMADO',
        },
      });

      // Compute initial rolling hash for APROBADO
      const eventCount = await prisma.eventoManifiesto.count({ where: { manifiestoId: m.id } });
      const rollingHash = computeRollingHash({
        previousHash: null,
        genesisBlockchainTimestamp: m.blockchainTimestamp?.toISOString() ?? null,
        estado: 'APROBADO',
        fecha: m.fechaFirma?.toISOString() ?? new Date().toISOString(),
        eventCount,
        observaciones: m.observaciones,
      });

      await prisma.manifiesto.update({
        where: { id: m.id },
        data: { rollingHash },
      });

      migrated++;
      console.log(`  Migrated: ${m.numero}`);
    } catch (err: any) {
      // Unique constraint violation = already exists, skip
      if (err?.code === 'P2002') {
        skipped++;
      } else {
        console.error(`  Error migrating ${m.numero}:`, err.message);
      }
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import prisma from '../lib/prisma';
import { computeRollingHash } from './blockchain.service';

/**
 * Compute rolling hash and save it on the manifiesto + evento inside a $transaction.
 * `tx` is the Prisma transaction client.
 */
export async function updateRollingHash(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  manifiestoId: string,
  estado: string,
  fecha: Date,
  observaciones: string | null,
  eventoId: string,
) {
  // Fetch current rolling hash + genesis blockchain timestamp
  const current = await tx.manifiesto.findUnique({
    where: { id: manifiestoId },
    select: { rollingHash: true, blockchainTimestamp: true },
  });
  const eventCount = await tx.eventoManifiesto.count({ where: { manifiestoId } });

  const newRollingHash = computeRollingHash({
    previousHash: current?.rollingHash ?? null,
    genesisBlockchainTimestamp: current?.blockchainTimestamp?.toISOString() ?? null,
    estado,
    fecha: fecha.toISOString(),
    eventCount,
    observaciones,
  });

  await tx.manifiesto.update({
    where: { id: manifiestoId },
    data: { rollingHash: newRollingHash },
  });

  await tx.eventoManifiesto.update({
    where: { id: eventoId },
    data: { integrityHash: newRollingHash },
  });

  return newRollingHash;
}

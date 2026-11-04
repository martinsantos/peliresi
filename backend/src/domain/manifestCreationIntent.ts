import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

type Context = { empresaId?: string; actividadId?: string; establecimientoId?: string };
export type ManifestCreationIntent = { id: string; hash: string; ownerId: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, canonical(item)]));
  return value;
}

/** An existing audit row is the durable receipt; no schema or business-state change.
 * Called under the same transaction lock as number allocation and creation. */
export function manifestCreationIntent(key: string, ownerId: string, role: string, context: Context | undefined, body: unknown): ManifestCreationIntent {
  const scope = [ownerId, role, context?.empresaId || '', context?.actividadId || '', context?.establecimientoId || ''];
  return { id: 'manifest-create:' + digest(JSON.stringify([scope, key.toLowerCase()])), hash: digest(JSON.stringify(canonical(body))), ownerId };
}

export async function readManifestCreationReceipt(tx: Prisma.TransactionClient, intent: ManifestCreationIntent): Promise<string | null> {
  const receipt = await tx.auditoria.findUnique({ where: { id: intent.id } });
  if (!receipt) return null;
  let data: { version?: number; requestHash?: string } = {};
  try { data = JSON.parse(receipt.datosDespues || '{}'); } catch { /* Fail closed on a damaged receipt. */ }
  if (receipt.usuarioId !== intent.ownerId || receipt.modulo !== 'MANIFIESTOS' || receipt.accion !== 'CREAR_MANIFIESTO'
    || data?.version !== 1 || data.requestHash !== intent.hash || !receipt.manifiestoId) {
    throw new AppError('Este envío ya fue procesado con otros datos. Recuperá el envío original antes de iniciar otro manifiesto.', 409);
  }
  return receipt.manifiestoId;
}

export async function recordManifestCreation(tx: Prisma.TransactionClient, intent: ManifestCreationIntent, manifestId: string) {
  await tx.auditoria.create({ data: {
    id: intent.id, usuarioId: intent.ownerId, manifiestoId: manifestId,
    modulo: 'MANIFIESTOS', accion: 'CREAR_MANIFIESTO',
    datosDespues: JSON.stringify({ version: 1, requestHash: intent.hash }),
  } });
}

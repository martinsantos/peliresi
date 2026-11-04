import { createHash } from 'node:crypto';
import prisma from '../lib/prisma';

export interface AdmissionReceipt {
  key: string;
  hits: number;
  resetAt: Date;
  retryAfterSeconds: number;
}
export interface AdmissionStore {
  consume(namespace: string, identity: string, windowMs: number): Promise<AdmissionReceipt>;
  release(receipt: AdmissionReceipt): Promise<void>;
}

/** One counter per identity/family; no cleartext IP, account, email or CUIT. */
export function admissionKey(namespace: string, identity: string): string {
  return createHash('sha256').update(JSON.stringify([namespace, identity])).digest('hex');
}

/** Atomic across workers, with PostgreSQL's clock (not individual process clocks).
 * This is operational metadata only, never a grant of authentication/permissions.
 * Expired keys reuse the same row; pruning abandoned keys is a separate task.
 */
export class PostgresAdmissionStore implements AdmissionStore {
  async consume(namespace: string, identity: string, windowMs: number): Promise<AdmissionReceipt> {
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error('Invalid admission window');
    const key = admissionKey(namespace, identity);
    const rows = await prisma.$queryRaw<Array<{ hits: number; resetAt: Date; retryAfterSeconds: number }>>`
      INSERT INTO "rate_limit_counters" ("key", "hits", "resetAt")
      VALUES (${key}, 1, statement_timestamp() + ${windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "rate_limit_counters"."resetAt" <= statement_timestamp()
          THEN 1 ELSE LEAST("rate_limit_counters"."hits" + 1, 1000000000) END,
        "resetAt" = CASE WHEN "rate_limit_counters"."resetAt" <= statement_timestamp()
          THEN EXCLUDED."resetAt" ELSE "rate_limit_counters"."resetAt" END
      RETURNING "hits", "resetAt",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - statement_timestamp()))))::integer AS "retryAfterSeconds"
    `;
    if (!rows[0]) throw new Error('Admission counter unavailable');
    return { key, ...rows[0] };
  }

  async release(receipt: AdmissionReceipt): Promise<void> {
    // A successful login that finishes after expiry must not decrement a later
    // request's window. The receipt identifies the exact counter generation.
    await prisma.$executeRaw`
      UPDATE "rate_limit_counters" SET "hits" = GREATEST(0, "hits" - 1)
      WHERE "key" = ${receipt.key} AND "resetAt" = ${receipt.resetAt}
    `;
  }
}

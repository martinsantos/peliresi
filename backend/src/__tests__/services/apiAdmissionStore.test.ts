import { describe, expect, it } from 'vitest';
import { prismaMock } from '../mocks/prisma';
import { admissionKey, PostgresAdmissionStore } from '../../services/apiAdmission.service';

describe('PostgreSQL admission counters', () => {
  it('uses a single atomic upsert with the database clock and a stable hashed identity', async () => {
    const resetAt = new Date('2026-10-23T18:00:00Z');
    prismaMock.$queryRaw.mockResolvedValue([{ hits: 7, resetAt, retryAfterSeconds: 41 }]);
    const store = new PostgresAdmissionStore();
    const receipt = await store.consume('api:person:reads', 'person@example.invalid', 60_000);
    expect(receipt).toEqual({ key: admissionKey('api:person:reads','person@example.invalid'), hits: 7, resetAt, retryAfterSeconds: 41 });
    const [sql, key, windowMs] = prismaMock.$queryRaw.mock.calls[0];
    expect((sql as TemplateStringsArray).join('')).toContain('ON CONFLICT ("key") DO UPDATE');
    expect((sql as TemplateStringsArray).join('')).toContain('statement_timestamp()');
    expect(key).toMatch(/^[a-f0-9]{64}$/); expect(windowMs).toBe(60_000);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it('releases only the exact counter generation that admitted the request', async () => {
    const receipt = { key: 'hashed-key', hits: 1, resetAt: new Date('2026-10-23T18:00:00Z'), retryAfterSeconds: 60 };
    await new PostgresAdmissionStore().release(receipt);
    const [sql, key, resetAt] = prismaMock.$executeRaw.mock.calls[0];
    expect((sql as TemplateStringsArray).join('')).toContain('AND "resetAt" = ');
    expect(key).toBe(receipt.key); expect(resetAt).toBe(receipt.resetAt);
  });
  it('does not fall back to per-process storage on DB failure or an empty result', async () => {
    const store = new PostgresAdmissionStore();
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(store.consume('reads','one',60_000)).rejects.toThrow('db unavailable');
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(store.consume('reads','one',60_000)).rejects.toThrow('Admission counter unavailable');
    await expect(store.consume('reads','one',0)).rejects.toThrow('Invalid admission window');
  });
  it('separates families without retaining personal identifiers', () => {
    const a = admissionKey('reads','198.51.100.20'); const b = admissionKey('writes','198.51.100.20');
    expect(a).not.toBe(b); expect(a).toHaveLength(64); expect(a).not.toContain('198.51');
    expect(admissionKey('reads','a:b')).not.toBe(admissionKey('reads:a','b'));
  });
});

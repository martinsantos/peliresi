import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceJson } from './evidence-json.ts';
test('PostgreSQL bigint diagnostics serialize without precision loss or changing ordinary counts', () => {
  const data = { estimated: 9007199254740993n, exactCount: 50, rows: [{ n_live_tup: 10n }], at: new Date('2026-10-08T20:00:00Z') };
  assert.throws(() => JSON.stringify(data), /BigInt/);
  assert.deepEqual(JSON.parse(evidenceJson(data)), { estimated: '9007199254740993', exactCount: 50, rows: [{ n_live_tup: '10' }], at: '2026-10-08T20:00:00.000Z' });
});

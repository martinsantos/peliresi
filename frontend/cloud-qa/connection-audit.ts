import assert from 'node:assert/strict';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
 const activity = await db.$queryRaw<Array<{ state: string | null; count: bigint }>>`
  SELECT state, count(*) AS count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state ORDER BY state`;
 console.log(JSON.stringify({ synthetic: true, states: activity.map(row => ({ state: row.state, count: Number(row.count) })) }));
} finally { await db.$disconnect(); }

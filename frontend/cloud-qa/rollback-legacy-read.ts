import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-rollback-partial-20261030');
assert.equal(process.env.QA_COMPAT_BACKEND, '8fb6277e');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'rollback-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
    Cookie: 'sitrep_qa_client=127.11.71.16' }, body: JSON.stringify({ email: 'generador@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(login.status, 200);
  const token = (await login.json() as any).data.tokens.accessToken;
  let blocked = 0;
  for (const item of Object.values(fixture.cases) as Array<{ id: string; numero: string; markerSha256: string }>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true } });
    assert.equal(manifest.numero, item.numero); assert.equal(manifest.isDemoData, true);
    const before = await db.eventoManifiesto.findMany({ where: { manifiestoId: item.id }, orderBy: { id: 'asc' } });
    const response = await fetch(base + `/manifiestos/${item.id}/aprobaciones`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json() as any;
    assert.equal(response.status, 409); assert.match(result.message, /Propuesta inválida/i);
    const after = await db.eventoManifiesto.findMany({ where: { manifiestoId: item.id }, orderBy: { id: 'asc' } });
    assert.equal(digest(after), digest(before)); blocked++;
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'rollback-legacy-proof.json'),
    JSON.stringify({ synthetic: true, backend: '8fb6277e', proposalsBlocked: blocked, dataChanged: false }, null, 2));
  console.log('La versión anterior rechaza las dos propuestas artificiales sin modificarlas.');
} finally { await db.$disconnect(); }

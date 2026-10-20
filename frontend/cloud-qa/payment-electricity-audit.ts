import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, externalKeys, root } from './safety.ts';
await assertCloudDatabase(); const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema'); assert.equal(schema, 'payment_identity_20261020');
for (const key of externalKeys) assert.equal(process.env[key], '');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const out = process.env.QA_ARTIFACTS!, { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const sharedUrl = new URL(process.env.DATABASE_URL!); sharedUrl.searchParams.set('schema', 'public'); const shared = new PrismaClient({ datasources: { db: { url: sharedUrl.toString() } } });
const checks: string[] = [];
try {
  const original = JSON.parse(readFileSync(path.join(out, 'shared-qa-original-records.json'), 'utf8'));
  const originalCounts: Record<string, number> = {};
  for (const [table, rows] of Object.entries(original.tables)) {
    const current = await shared[table].findMany({ orderBy: { id: 'asc' } });
    assert.deepEqual(current.map((row: { id: string }) => ({ id: row.id, hash: sha(JSON.stringify(row)) })), rows); originalCounts[table] = current.length;
  }
  assert.deepEqual(await shared.$queryRawUnsafe("SELECT to_regclass('public.registros_pago_comprobante')::text AS name"), [{ name: null }]);
  checks.push('all existing shared QA documents, applications and TEF payment rows unchanged; new ledger exists only in the owned test schema');
  const applications = await db.solicitudInscripcion.findMany({ where: { estado: 'APROBADA' }, include: { documentos: { where: { tipo: 'COMPROBANTE_PAGO' } }, usuario: { select: { cuit: true } } } });
  let applied = 0;
  for (const application of applications) for (const doc of application.documentos) {
    const pago = doc.analisis?.pago; assert.equal(doc.estado, 'APROBADO'); assert.equal(pago?.revision, 'CONFIRMADO'); assert.equal(pago.sha256, doc.sha256);
    const record = await db.registroPagoComprobante.findUniqueOrThrow({ where: { id: pago.registroId } });
    assert.equal(record.ambito, 'SOLICITUD:' + application.id); assert.equal(record.cuit, application.usuario.cuit.replace(/\D/g, '')); assert.equal(record.estado, 'APLICADO');
    assert.equal(sha(readFileSync(doc.path)), doc.sha256); applied++;
  }
  assert.ok(applied >= 4); assert.equal(await db.pagoTEF.count(), 0);
  checks.push('every approved synthetic application has its scoped, reviewed, applied payment and untouched bytes; no fiscal TEF payment is invented');
  const bills = await db.documentoSolicitud.findMany({ where: { tipo: 'FACTURA_ELECTRICA' } }); assert.ok(bills.length >= 3);
  for (const bill of bills) { assert.equal(sha(readFileSync(bill.path)), bill.sha256); assert.equal(await db.huellaRecibo.count({ where: { sha256: bill.sha256 } }), 0); assert.equal(bill.analisis.documentKind, 'FACTURA_ELECTRICA'); }
  checks.push('electrical originals and structured evidence retained; electricity never creates a receipt reservation or digest');
  assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0); assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  checks.push('mail remains suppressed, zero attempts or sent timestamps, push providers empty, CAP expired');
  const proof = JSON.parse(readFileSync(path.join(out, 'build-snapshot-v3.json'), 'utf8'));
  const runtime = proof.files.filter((row: { path: string }) => row.path.startsWith('backend/src/') || row.path.startsWith('backend/prisma/') || row.path.startsWith('frontend/src-v6/') || row.path.startsWith('docs/manual/'));
  for (const row of runtime) assert.equal(sha(readFileSync(path.join(root, row.path))), row.sha256, row.path);
  for (const dir of [process.env.QA_WEB_BUILD!, process.env.QA_APP_BUILD!]) {
    for (const name of readdirSync(path.join(dir, 'assets')).filter(name => name.endsWith('.js'))) assert.ok(!readFileSync(path.join(dir, 'assets', name), 'utf8').includes('https://sitrep.ultimamilla.com.ar/api'));
  }
  for (const name of ['manual.css', 'manual.js', 'help-data.js']) assert.equal(sha(readFileSync(path.join(root, 'docs/manual', name))), sha(readFileSync(path.join(process.env.QA_MANUAL_ROOT!, name))));
  checks.push('backend/frontend/schema/manual inputs match the final build snapshot; compiled bundles exclude production API; exact manual renderer/CSS/content');
  writeFileSync(path.join(out, 'payment-electricity-audit.json'), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, schema, sharedOriginalCounts: originalCounts, applications: applications.length, appliedReceipts: applied, electricalBills: bills.length, registry: await db.registroPagoComprobante.count(), aliases: await db.clavePagoComprobante.count(), events: await db.eventoPagoComprobante.count(), suppressedEmails: await db.emailQueue.count(), runtimeSources: runtime.length, capClosed: true, emails: false, push: false, production: false }, null, 2));
  console.log('Payment/electricity final audit: ' + checks.length + ' groups PASS');
} catch (error) { console.error(JSON.stringify({ failed: true, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
finally { await db.$disconnect(); await shared.$disconnect(); }

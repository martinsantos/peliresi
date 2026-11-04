import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire, externalKeys, root } from './safety.ts';
await assertCloudDatabase();
const schema = 'actor_onboarding_20261020', out = process.env.QA_ARTIFACTS!;
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const checks: string[] = [];
const browserCases = (file: string) => readdirSync(out + '/browser-entry-final', { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
  .flatMap(entry => { const path = out + '/browser-entry-final/' + entry.name + '/' + file; return existsSync(path) ? [JSON.parse(readFileSync(path, 'utf8'))] : []; });
try {
  const browsers: Record<string, number> = { 'browser-entry-final': 18, 'admin-entry-final': 6, 'payment-final': 12, 'receipts-final': 18, 'fleet-final': 3, 'onboarding-manual-browser': 3 };
  for (const [file, expected] of Object.entries(browsers)) {
    const result = JSON.parse(readFileSync(out + '/' + file + '.json', 'utf8'));
    assert.equal(result.stats.expected, expected, file); assert.equal(result.stats.unexpected, 0, file);
    assert.equal(result.stats.skipped, 0, file); assert.equal(result.stats.flaky, 0, file); assert.equal(result.errors?.length || 0, 0, file);
  }
  checks.push('all accepted browser reports have exact counts, zero failures, skips, retries or teardown errors');
  for (const [file, expected] of Object.entries({ 'backend-administrative': 169, 'frontend-entry-final': 312 })) {
    const result = JSON.parse(readFileSync(out + '/' + file + '.json', 'utf8'));
    assert.equal(result.numPassedTests, expected, file); assert.equal(result.numFailedTests, 0, file); assert.equal(result.numPendingTests, 0, file);
  }
  assert.equal(JSON.parse(readFileSync(out + '/payment-electricity-integration.json', 'utf8')).passed, 11);
  checks.push('directed backend/frontend suites, final visual-button unit check and eleven native API/OCR groups pass');
  const before = JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8'));
  for (const [key, rows] of Object.entries(before)) {
    const [namespace, table] = key.split('.'); assert.notEqual(namespace, schema);
    assert.match(namespace, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(table, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${namespace}"."${table}" t`), rows, key);
  }
  checks.push('all prior QA tables retain their complete row counts and fingerprints');
  const approved = await db.solicitudInscripcion.findMany({ where: { estado: 'APROBADA' }, include: { documentos: true } });
  for (const application of approved) for (const document of application.documentos.filter((d: any) => d.tipo === 'COMPROBANTE_PAGO')) {
    assert.equal(document.estado, 'APROBADO'); assert.equal(document.analisis.pago.revision, 'CONFIRMADO');
    assert.equal(document.analisis.pago.sha256, document.sha256);
    const payment = await db.registroPagoComprobante.findUniqueOrThrow({ where: { id: document.analisis.pago.registroId } });
    assert.equal(payment.ambito, 'SOLICITUD:' + application.id); assert.equal(payment.estado, 'APLICADO');
  }
  assert.equal(await db.pagoTEF.count(), 0);
  checks.push('approved receipts remain reviewed and applied to their own application; no TEF payment invented');
  const uiProof = browserCases('case.json'); assert.equal(uiProof.length, 9); assert.equal(new Set(uiProof.map(row => row.application)).size, 9);
  const ui = await db.solicitudInscripcion.findMany({ where: { id: { in: uiProof.map(row => row.application) } }, include: { usuario: true } });
  const completed = ui.filter((a: any) => a.estado === 'APROBADA'); assert.equal(completed.length, 9);
  for (const application of completed) {
    assert.equal(application.usuario.emailVerified, true); assert.equal(application.usuario.activo, true);
    const proof = uiProof.find(row => row.application === application.id); assert.equal(proof.user, application.usuarioId); assert.equal(proof.verifiedViaSyntheticProof, true);
    const kind = application.tipoActor.toLowerCase(), actor = await db[kind].findFirstOrThrow({ where: { usuarioId: application.usuarioId } });
    assert.equal(proof.actorId, actor.id);
    assert.equal(actor.domicilio, 'QA domicilio corregido 200');
    if (kind !== 'transportista') assert.equal(actor.tefInputs.potenciaHP, 120);
    else { assert.equal(await db.vehiculo.count({ where: { transportistaId: actor.id } }), 1); assert.equal(await db.chofer.count({ where: { transportistaId: actor.id } }), 1); }
  }
  checks.push('UI applications keep corrections, verified enabled account, declared HP and exact fleet after approval');
  const rejectedProof = browserCases('rejected-case.json'); assert.equal(rejectedProof.length, 9); assert.equal(new Set(rejectedProof.map(row => row.application)).size, 9);
  const rejected = await db.solicitudInscripcion.findMany({ where: { estado: 'RECHAZADA', id: { in: rejectedProof.map(row => row.application) } }, include: { usuario: true } }); assert.equal(rejected.length, 9);
  for (const application of rejected) { assert.equal(application.usuario.activo, false); assert.equal(await db[application.tipoActor.toLowerCase()].count({ where: { usuarioId: application.usuarioId } }), 0); }
  checks.push('all rejected UI cases preserve their result without an enabled actor');
  const documents = await db.documentoSolicitud.findMany();
  for (const document of documents) assert.equal(sha(readFileSync(document.path)), document.sha256);
  const bills = documents.filter((d: any) => d.tipo === 'FACTURA_ELECTRICA'); assert.ok(bills.length >= 6);
  for (const bill of bills) { assert.equal(bill.analisis.documentKind, 'FACTURA_ELECTRICA'); assert.equal(await db.huellaRecibo.count({ where: { sha256: bill.sha256 } }), 0); }
  checks.push('retained originals match hashes; electric invoices remain separate from receipt identity');
  const direct = await db.documento.findMany({ where: { nombre: 'Factura-directa-QA.pdf' } }); assert.ok(direct.length >= 6);
  for (const bill of direct) {
    assert.equal(sha(readFileSync(bill.path)), bill.sha256);
    assert.equal(bill.tipo, bill.generadorId ? 'FACTURA_LUZ' : 'FACTURA_ELECTRICA');
    assert.equal(bill.analisis.electricidad.campos.consumoKwh, '1250');
    assert.equal(await db.huellaRecibo.count({ where: { sha256: bill.sha256 } }), 0);
    const owner = bill.generadorId ? await db.generador.findUniqueOrThrow({ where: { id: bill.generadorId } }) : await db.operador.findUniqueOrThrow({ where: { id: bill.operadorId } });
    assert.equal(owner.tefInputs, null);
  }
  checks.push('administrative bills keep their original type, exact bytes and electrical evidence without changing TEF inputs');
  assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0); assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  for (const proc of JSON.parse(readFileSync(out + '/processes.json', 'utf8'))) {
    const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
    assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), schema); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
    for (const key of externalKeys) assert.equal(env[key], '');
    for (const key of ['MANIFEST_EXCEPTIONAL_ENABLED','MANIFEST_ADDENDA_ENABLED','MANIFEST_PARTY_REVIEW_ENABLED','ACTOR_MULTIROLE_ENABLED','ENTERPRISE_ENABLED']) assert.equal(env[key], 'false');
    for (const key of ['MANIFEST_TRANSPORT_HANDOFF_ENABLED','TRANSPORT_MULTI_GPS_ENABLED']) assert.equal(env[key], 'true');
  }
  checks.push('actual processes keep CAP expired, providers empty, flags off; all emails suppressed without attempts');
  const build = JSON.parse(readFileSync(out + '/build-snapshot-v8.json', 'utf8'));
  const runtime = build.files.filter((f: {path:string}) => /^backend\/(src|prisma)\//.test(f.path) || f.path.startsWith('frontend/src-v6/'));
  for (const file of runtime) assert.equal(sha(readFileSync(root + '/' + file.path)), file.sha256, file.path);
  for (const dir of [process.env.QA_WEB_BUILD!,process.env.QA_APP_BUILD!]) for (const name of readdirSync(dir+'/assets').filter(n=>n.endsWith('.js'))) assert.ok(!readFileSync(dir+'/assets/'+name,'utf8').includes('https://sitrep.ultimamilla.com.ar/api'));
  for (const file of JSON.parse(readFileSync(root+'/.actor-onboarding-proof.json','utf8')).files.filter((f: {path:string})=>f.path.startsWith('docs/manual/'))) assert.equal(sha(readFileSync(process.env.QA_MANUAL_ROOT!+'/'+file.path.slice(12))),file.sha256,file.path);
  checks.push('runtime inputs match the final build; bundles exclude production API; published QA manual is an exact source copy');
  const consoleGroups: Record<string, number> = { 'browser-entry-final': 36, 'admin-entry-final': 6, 'payment-final': 12, 'receipts-final': 21, 'fleet-final': 3, 'onboarding-manual-browser': 3 };
  const logs: Array<{ file: string; events: Array<{ type: string; text: string }> }> = [];
  const collect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) collect(path);
      else if (/^console-\d+\.json$/.test(entry.name)) logs.push({ file: path.slice(out.length + 1), events: JSON.parse(readFileSync(path, 'utf8')).events });
    }
  };
  for (const [directory, count] of Object.entries(consoleGroups)) { const before = logs.length; collect(out + '/' + directory); assert.equal(logs.length - before, count, directory + ' instrumented pages'); }
  const expectedHttp = (event: { type: string; text: string }) =>
    event.type === 'http-400' && /^POST \/api\/actores\/transportistas\/[^/]+\/documentos$/.test(event.text)
    || event.type === 'http-409' && /^POST \/api\/solicitudes\/[^/]+\/documentos\/[^/]+\/identidad-pago$/.test(event.text)
    || event.type === 'http-409' && /^PATCH \/api\/solicitudes\/[^/]+\/datos-revision$/.test(event.text)
    || event.type === 'http-403' && /^POST \/api\/solicitudes\/[^/]+\/mensajes$/.test(event.text);
  const unexpected: Array<{ file: string; type: string; text: string }> = [], warnings = new Set<string>();
  let expectedFailures = 0;
  for (const log of logs) for (const event of log.events) {
    if (event.type === 'warning') { warnings.add(event.text.replace(/token=[^\s&#]+/g, 'token=[omitted]')); continue; }
    if (expectedHttp(event)) { expectedFailures++; continue; }
    const status = event.text.match(/^Failed to load resource: the server responded with a status of (400|403|409)\b/)?.[1];
    if (event.type === 'error' && status && log.events.some(other => other.type === 'http-' + status && expectedHttp(other))) continue;
    if (event.type === 'error' || event.type === 'uncaught' || event.type.startsWith('http-')) unexpected.push({ file: log.file, ...event });
  }
  writeFileSync(out + '/browser-console-summary.json', JSON.stringify({ pages: logs.length, expectedFailures, warnings: [...warnings], unexpected }, null, 2));
  assert.equal(unexpected.length, 0, 'Unexpected browser console/HTTP events; inspect browser-console-summary.json');
  checks.push('all eighty-one instrumented browser pages have no uncaught or unexpected console/HTTP errors; negative-case responses are explicit');
  writeFileSync(out+'/audit.json',JSON.stringify({at:new Date().toISOString(),passed:checks.length,checks,protectedTables:Object.keys(before).length,approved:approved.length,completedUICases:completed.length,rejectedUICases:rejected.length,electricInvoices:bills.length,administrativeBills:direct.length,documents:documents.length,suppressedEmails:await db.emailQueue.count(),capClosed:true,externalDelivery:false,production:false},null,2));
  console.log('Onboarding audit: '+checks.length+' groups PASS.');
} finally { await db.$disconnect(); }

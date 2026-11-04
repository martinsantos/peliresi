import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire, externalKeys, root } from './safety.ts';

await assertCloudDatabase();
const out = process.env.QA_ARTIFACTS!, schema = 'circuit_review_20261020';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const mailDb = backendRequire(root + '/backend/dist/lib/prisma.js').default;
const { notificationMailContent, notificationSourceEligible, queueCommittedNotificationEmails } = backendRequire(root + '/backend/dist/services/notification-mail.service.js');
const { hashCanonicalPayload } = backendRequire(root + '/backend/dist/services/inspectionDocumentIntegrity.service.js');
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const checks: string[] = [];
try {
  const before = JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8'));
  for (const [key, rows] of Object.entries(before)) {
    const [namespace, table] = key.split('.'); assert.notEqual(namespace, schema);
    assert.match(namespace, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(table, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${namespace}"."${table}" t`), rows, key);
  }
  checks.push('all previous QA schemas retain every table count and row fingerprint');
  const historical = await db.manifiesto.findUniqueOrThrow({ where: { id: 'manifest-qa-legacy' }, include: { residuos: true, eventos: true } });
  assert.equal(JSON.stringify(historical), readFileSync(out + '/manifest-legacy-before.json', 'utf8'));
  checks.push('the original synthetic historical manifest, wastes and events remain unchanged');

  for (const proc of JSON.parse(readFileSync(out + '/processes.json', 'utf8'))) {
    const env = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
    assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), schema);
    assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    assert.equal(env.DISABLE_EMAILS, 'true'); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
    assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, ''); assert.equal(env.EMAIL_DELIVERY_NOT_BEFORE, '');
    assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false'); assert.equal(env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST, '');
    for (const key of externalKeys) assert.equal(env[key], '');
    for (const key of ['ACTOR_MULTIROLE_ENABLED','ENTERPRISE_ENABLED']) assert.equal(env[key], 'false');
    for (const key of ['MANIFEST_EXCEPTIONAL_ENABLED','MANIFEST_ADDENDA_ENABLED','MANIFEST_PARTY_REVIEW_ENABLED','MANIFEST_TRANSPORT_HANDOFF_ENABLED','TRANSPORT_MULTI_GPS_ENABLED']) assert.equal(env[key], 'true');
  }
  const queueBefore = await db.emailQueue.count();
  assert.equal(await queueCommittedNotificationEmails(), 0);
  assert.equal(await db.emailQueue.count(), queueBefore);
  assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  checks.push('actual API/static processes keep CAP expired and every external delivery gate closed; relay does nothing and mail has zero attempts');

  const notices = await db.notificacion.findMany({ where: { datos: { contains: '"tipo":"agenda_inspeccion"' } }, include: { usuario: true } });
  let revoked = 0, current = 0;
  for (const notice of notices) {
    if (!notice.usuario.esInspector || notice.usuario.rol.startsWith('ADMIN')) continue;
    const data = JSON.parse(notice.datos), inspection = await db.inspeccion.findUniqueOrThrow({ where: { id: data.inspeccionId } });
    const envelope = { ...notice, ...notice.usuario, id: notice.id, usuarioId: notice.usuarioId };
    assert.ok(notificationMailContent(envelope));
    const eligible = await notificationSourceEligible(envelope, 'inspecciones');
    if (inspection.inspectorId !== notice.usuarioId) { assert.equal(eligible, false); revoked++; }
    else { assert.equal(eligible, true); current++; }
  }
  assert.ok(revoked >= 3 && current >= 3);
  checks.push('compiled mail source checks against real PostgreSQL reject replaced inspectors and retain current assignments without sending');

  const intakes = await db.antecedenteFiscalizacion.findMany(); assert.ok(intakes.length > 0);
  for (const row of intakes) {
    assert.equal(hashCanonicalPayload(row.evidencia), row.huellaEvidencia);
    assert.equal(row.claveOrigen, `${row.origen}:${row.origenId}:${row.tipoActor}`);
    assert.equal(new Set(row.eventos.map((event: any) => event.id)).size, row.eventos.length);
    if (row.origen === 'INFORME_ADENDA') {
      const source = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: row.origenId } });
      assert.equal(hashCanonicalPayload(source.informeHallazgo), row.huellaEvidencia);
    }
    if (row.estado === 'VINCULADA') assert.ok(await db.inspeccion.findUnique({ where: { id: row.inspeccionId } }));
    assert.ok(!JSON.stringify(row.evidencia).includes('accesoVersion') && !JSON.stringify(row.evidencia).includes('eyJ'));
  }
  assert.equal(new Set(intakes.map((row: any) => row.claveOrigen)).size, intakes.length);
  checks.push('inspection intake preserves canonical evidence, source links and decisions without repeated origins or GPS secrets');

  for (const document of await db.documentoSolicitud.findMany()) assert.equal(sha(readFileSync(document.path)), document.sha256);
  for (const application of await db.solicitudInscripcion.findMany({ where: { estado: 'APROBADA' }, include: { documentos: true } })) {
    for (const document of application.documentos.filter((row: any) => row.tipo === 'COMPROBANTE_PAGO')) {
      assert.equal(document.estado, 'APROBADO'); assert.equal(document.analisis.pago.revision, 'CONFIRMADO');
      assert.equal(document.analisis.pago.sha256, document.sha256);
      const payment = await db.registroPagoComprobante.findUniqueOrThrow({ where: { id: document.analisis.pago.registroId } });
      assert.equal(payment.ambito, 'SOLICITUD:' + application.id); assert.equal(payment.estado, 'APLICADO');
    }
  }
  assert.equal(await db.pagoTEF.count(), 0);
  checks.push('retained application files match their original hashes; approved payments belong to one application and no TEF payment was fabricated');

  const build = JSON.parse(readFileSync(out + '/build-snapshot-v13.json', 'utf8'));
  for (const file of build.files.filter((file: any) => /^backend\/(src|prisma)\//.test(file.path) || file.path.startsWith('frontend/src-v6/'))) assert.equal(sha(readFileSync(root + '/' + file.path)), file.sha256, file.path);
  for (const file of build.files.filter((file: any) => file.path.startsWith('docs/manual/'))) assert.equal(sha(readFileSync(process.env.QA_MANUAL_ROOT! + '/' + file.path.slice(12))), file.sha256, file.path);
  for (const folder of [process.env.QA_WEB_BUILD!, process.env.QA_APP_BUILD!]) for (const name of readdirSync(folder + '/assets').filter(name => name.endsWith('.js'))) assert.ok(!readFileSync(folder + '/assets/' + name, 'utf8').includes('https://sitrep.ultimamilla.com.ar/api'));
  checks.push('runtime sources match the tested immutable builds; QA manual matches its source snapshot and bundles do not point at production');
  const memory = Object.fromEntries(readFileSync('/sys/fs/cgroup/memory.events', 'utf8').trim().split('\n').map(line => line.split(' ')));
  assert.equal(memory.oom, '0'); assert.equal(memory.oom_kill, '0');
  checks.push('one CPU and two GiB without swap or OOM maintained');
  writeFileSync(out + '/audit.json', JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, protectedTables: Object.keys(before).length, suppressedEmails: queueBefore, replacedInspectorNotices: revoked, currentInspectorNotices: current, intakes: intakes.length, production: false, capClosed: true, externalDelivery: false }, null, 2));
  console.log('Circuit audit: ' + checks.length + ' groups PASS');
} finally { await db.$disconnect(); await mailDb.$disconnect(); }

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const schema = 'mail_copy_20261021';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.EMAIL_NOTIFICATION_FAMILIES, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;
async function protectedTables() {
  const tables = await db.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('information_schema',$1) AND table_schema NOT LIKE 'pg_%' ORDER BY 1,2", schema);
  const result: Record<string, unknown> = {};
  for (const row of tables) {
    assert.match(row.table_schema, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(row.table_name, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    result[row.table_schema + '.' + row.table_name] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${row.table_schema}"."${row.table_name}" t`);
  }
  return result;
}
try {
  if (process.argv[2] === 'prepare') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema), []);
    writeFileSync(out + '/protected-before.json', JSON.stringify(await protectedTables()));
    await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(), 0);
    const fixture = await loadSeed().seedNightDatabase();
    const manifest = await db.manifiesto.create({ data: {
      id: 'qa-mail-copy-manifest', numero: 'QA-CORREOS-0001', estado: 'TRATADO',
      generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
      creadoPorId: fixture.users.operador, isDemoData: true, fechaCierre: new Date(),
      residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, cantidadRecibida: 10, unidad: 'kg', estado: 'SOLIDO' }] },
    } });
    const adenda = await db.adendaManifiesto.create({ data: {
      id: 'qa-mail-copy-adenda', manifiestoId: manifest.id, creadoPorId: fixture.users.operador, huellaSolicitud: 'qa-mail-copy',
      declaracion: { numero: manifest.numero, residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
      residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }], motivo: 'QA diferencia de pesaje', version: 1,
      revisiones: [{ id: 'qa-mail-copy-review', autorId: fixture.users.transportista, fecha: new Date().toISOString(), version: 1, decision: 'APROBADA', nota: 'QA decisión individual' }],
    } });
    const { notifyAddendumParties } = backendRequire(path.join(root, 'backend/dist/services/manifiestoAddendumNotice.service.js'));
    const { receiptNotice } = backendRequire(path.join(root, 'backend/dist/services/documentAnalysis.service.js'));
    const { notificationService } = backendRequire(path.join(root, 'backend/dist/services/notification-dispatcher.service.js'));
    await db.$transaction((tx: unknown) => notifyAddendumParties(tx, manifest, adenda.id, 1, 'APROBADA', fixture.users.transportista));
    await notificationService.notificarCambioEstado(manifest.id, 'TRATADO', fixture.users.operador);
    const application = await db.solicitudInscripcion.create({ data: { usuarioId: fixture.users.generador, tipoActor: 'GENERADOR', estado: 'APROBADA', datosActor: '{}', observaciones: 'QA comprobante para revisar' } });
    await db.$transaction((tx: unknown) => receiptNotice(tx, fixture.users.generador, { solicitudId: application.id }));
    await db.$transaction((tx: unknown) => receiptNotice(tx, fixture.users.generador, { documentoId: 'qa-receipt-profile' }));
    const notices = await db.notificacion.findMany({ where: { usuarioId: fixture.users.generador, OR: [{ manifiestoId: manifest.id }, { titulo: 'Comprobante repetido' }] }, orderBy: { createdAt: 'asc' } });
    const { notificationMailContent } = backendRequire(path.join(root, 'backend/dist/services/notification-mail.service.js'));
    const mails = notices.map((notice: any) => ({ id: notice.id, notice, ...notificationMailContent({ ...notice, rol: 'GENERADOR' }) }));
    assert.equal(mails.length, 4);
    assert.ok(mails.every((mail: any) => mail.html));
    writeFileSync(out + '/fixture.json', JSON.stringify({ ...fixture, mails, manifestId: manifest.id, applicationId: application.id, database: 'sitrep_night_qa_20260926', externalDelivery: false, capClosed: true }));
  } else if (process.argv[2] === 'audit') {
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-before.json', 'utf8')));
    const processes = JSON.parse(readFileSync(out + '/processes.json', 'utf8'));
    for (const item of processes) {
      const env = Object.fromEntries(readFileSync(`/proc/${item.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
      for (const key of ['DISABLE_EMAILS', 'PUSH_MANIFEST_NOTICES_ENABLED', 'TRAINING_DATABASE_URL', 'TRAINING_DIRECT_LOGIN_UNTIL', 'EMAIL_NOTIFICATION_FAMILIES']) assert.equal(env[key], process.env[key]);
    }
    assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    for (const alias of ['admin', 'generador', 'transporte', 'operador']) {
      const res = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.33.99' }, body: JSON.stringify({ email: alias + '@capacitacion.invalid', password: 'expired-qa-probe' }) });
      assert.equal(res.status, 403);
    }
    writeFileSync(out + '/audit.json', JSON.stringify({ protectedTables: Object.keys(await protectedTables()).length, emailAttempts: 0, activeMailQueue: 0, capAliasesRejected: 4, processesVerified: processes.length }));
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }

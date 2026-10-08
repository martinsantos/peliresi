import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, lstat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { startMultiuserCluster, stopMultiuserCluster } from './multiuser-cluster.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_MULTIUSER, 'true');
const output = process.env.QA_ARTIFACTS!;
const base = 'http://127.0.0.1:3038/api';
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const password = 'OnlyLocal-Multiuser-2026!';
type User = { id: string; email: string; role: string; group: number; token: string; refresh: string; actor?: string; manifest?: string; inspection?: string; ticket?: string };
const users: User[] = [];
const checks: Array<{ name: string; status: string; error?: string }> = [];
const measurements: Array<{ group: string; ms: number; status: number }> = [];
const samples: unknown[] = [];
let cluster: ChildProcess | undefined, nginx: ChildProcess | undefined;
let startedAt: string | undefined, endedAt: string | undefined;
const phases = [{ sessions: 10, seconds: 300 }, { sessions: 25, seconds: 300 }, { sessions: 50, seconds: 1200 }];
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
async function call(user: User | null, route: string, method = 'GET', body?: unknown, expected: number | number[] = 200, key?: string) {
  const started = performance.now();
  const response = await fetch(base + route, { method, signal: AbortSignal.timeout(15000), headers: {
    ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { 'Idempotency-Key': key } : {}),
  }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const bytes = Buffer.from(await response.arrayBuffer());
  measurements.push({ group: route.endsWith('.pdf') || route.includes('/pdf/') || route.endsWith('/download') ? 'pdf' : method === 'GET' ? 'read' : 'write', ms: performance.now() - started, status: response.status });
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${route}: unexpected HTTP ${response.status}`);
  if (response.headers.get('content-type')?.includes('application/pdf')) { assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); return bytes; }
  const json = JSON.parse(bytes.toString());
  return expected === 200 || expected === 201 ? json.data ?? json : { status: response.status, data: json.data };
}
async function check(name: string, task: () => Promise<void>) {
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: String(error) }); throw error; }
}
async function seedUsers() {
  const encoded = await backendRequire('bcryptjs').hash(password, 10);
  for (let index = 0; index < 50; index++) {
    const group = Math.floor(index / 10), role = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'GENERADOR', 'ADMIN'][group];
    const email = `multiuser-${index}@night-qa.invalid`;
    const user = await db.usuario.create({ data: { email, password: encoded, rol: role, esInspector: group === 3,
      nombre: 'QA simultáneo ' + index, activo: true, emailVerified: true, notifEmail: false, notifNuevoRegistro: false, notifWhatsapp: false, notifTelegram: false } });
    const row: User = { id: user.id, email, role, group, token: '', refresh: '' };
    const common = { usuarioId: user.id, razonSocial: 'QA Actor simultáneo ' + index, cuit: `99-${String(40000000 + index)}-0`, email,
      domicilio: 'QA ubicación explícitamente sintética', telefono: '0000000000', activo: true, latitud: -32.89, longitud: -68.84 };
    if (group === 0) row.actor = (await db.generador.create({ data: { ...common, categoria: 'GRAN_GENERADOR', numeroInscripcion: 'QA-MU-G-' + index } })).id;
    if (group === 1) row.actor = (await db.transportista.create({ data: { ...common, numeroHabilitacion: 'QA-MU-T-' + index, vencimientoHabilitacion: new Date('2030-01-01') } })).id;
    if (group === 2) {
      row.actor = (await db.operador.create({ data: { ...common, categoria: 'TRATAMIENTO', numeroHabilitacion: 'QA-MU-O-' + index, modalidades: ['FIJO'], vencimientoHabilitacion: new Date('2030-01-01') } })).id;
    }
    users.push(row);
  }
}
async function files(directory: string, prefix = ''): Promise<Array<{ file: string; sha256: string }>> {
  const result: Array<{ file: string; sha256: string }> = [];
  for (const name of (await readdir(path.join(directory, prefix))).sort()) {
    const file = path.join(prefix, name), absolute = path.join(directory, file), stat = await lstat(absolute);
    assert.ok(!stat.isSymbolicLink(), 'Backup cannot follow a shared or external link');
    if (stat.isDirectory()) result.push(...await files(directory, file));
    else { assert.ok(stat.isFile()); result.push({ file, sha256: hash(await readFile(absolute)) }); }
  }
  return result;
}
async function restoreCheck() {
  await stopMultiuserCluster(cluster!); cluster = undefined;
  const pg = '/usr/lib/postgresql/16/bin/';
  const backup = path.join(output, 'multiuser-database.dump');
  const archive = path.join(output, 'multiuser-uploads.tar.gz');
  const uploads = process.env.UPLOADS_DIR!;
  assert.equal(uploads, path.join(output, 'uploads'));
  const originalFiles = await files(uploads); assert.ok(originalFiles.length > 0);
  const before = await db.$queryRawUnsafe("SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname");
  const counts = Object.fromEntries(await Promise.all(['usuario', 'manifiesto', 'inspeccion', 'ticketSoporte', 'documento', 'mensajeSoporte', 'eventoSoporte'].map(async model => [model, await db[model].count()])));
  execFileSync(pg + 'pg_dump', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa', '-d', 'sitrep_night_qa_20260926', '-Fc', '-f', backup]);
  execFileSync('tar', ['-czf', archive, '-C', uploads, '.']);
  execFileSync(pg + 'createdb', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa', 'sitrep_night_qa_restore_20261008']);
  execFileSync(pg + 'pg_restore', ['-h', '127.0.0.1', '-p', '55440', '-U', 'qa', '-d', 'sitrep_night_qa_restore_20261008', '--exit-on-error', backup]);
  await rename(uploads, path.join(output, 'uploads-before-restore'));
  await mkdir(uploads); execFileSync('tar', ['-xzf', archive, '-C', uploads]);
  assert.deepEqual(await files(uploads), originalFiles);
  const restoredUrl = new URL(process.env.DATABASE_URL!); restoredUrl.pathname = '/sitrep_night_qa_restore_20261008';
  const restored = new PrismaClient({ datasources: { db: { url: restoredUrl.toString() } } });
  try {
    assert.equal((await restored.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, 'sitrep_night_qa_restore_20261008');
    for (const [model, count] of Object.entries(counts)) assert.equal(await restored[model].count(), count, 'Restored row count: ' + model);
    cluster = await startMultiuserCluster(restoredUrl.toString());
    for (const user of users) { const identity = await call(user, '/auth/profile'); assert.equal(identity.user.id, user.id); const ticket = await call(user, '/soporte/' + user.ticket); assert.equal(ticket.autorId, user.id); }
    const document = await restored.documento.findFirstOrThrow({ where: { tipo: 'CERTIFICADO_AMBIENTAL', generadorId: users[0].actor } });
    const bytes = await call(users[0], '/actores/documentos/' + document.id + '/download');
    assert.equal(hash(bytes), hash(await readFile(document.path)));
    const last = await restored.ticketSoporte.aggregate({ _max: { numero: true } });
    const created = await call(users[0], '/soporte', 'POST', { descripcion: 'QA continuidad después de restauración' }, 201, 'qa-restore-reference-20261008');
    assert.ok(created.numero > last._max.numero);
    await writeFile(path.join(output, 'multiuser-restore.json'), JSON.stringify({ at: new Date().toISOString(), sourceDatabase: 'sitrep_night_qa_20260926',
      restoredDatabase: 'sitrep_night_qa_restore_20261008', port: 55440, counts, files: originalFiles, databaseArchiveSha256: hash(await readFile(backup)),
      fileArchiveSha256: hash(await readFile(archive)), authenticatedUsers: 50, originalDownload: true, numberingContinues: true, productionData: false, statsBefore: before }, null, 2));
  } finally { await restored.$disconnect(); }
}

try {
  // Close the earlier browser/API phase before the capacity phase; one VM only.
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(root, 'frontend/cloud-qa/close.ts')]);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await seedUsers();
  cluster = await startMultiuserCluster(process.env.DATABASE_URL!);
  const nginxConfig = path.join(output, 'multiuser-nginx.conf');
  await writeFile(nginxConfig, `daemon off; pid ${output}/multiuser-nginx.pid;
events { worker_connections 256; } http { access_log ${output}/multiuser-nginx-access.log; error_log ${output}/multiuser-nginx-error.log;
server { listen 127.0.0.1:3038; location / { proxy_pass http://127.0.0.1:3037; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto http; proxy_read_timeout 30s; } } }
`);
  nginx = spawn('nginx', ['-c', nginxConfig, '-p', output], { stdio: 'inherit' });
  await new Promise(resolve => setTimeout(resolve, 500));
  await check('fifty real, distinct authenticated sessions enter concurrently through one shared proxy IP', async () => {
    await Promise.all(users.map(async user => {
      const login = await call(null, '/auth/login', 'POST', { email: user.email, password });
      assert.equal(login.user.id, user.id); assert.equal(login.user.rol, user.role);
      user.token = login.tokens.accessToken; user.refresh = login.tokens.refreshToken;
    }));
    assert.equal(new Set(users.map(user => user.id)).size, 50);
    assert.equal(new Set(users.map(user => user.token)).size, 50);
    const pids = await Promise.all(Array.from({ length: 10 }, () => call(null, '/health/live')));
    assert.equal(new Set(pids.map(row => row.pid)).size, 2);
  });
  const admin = users[40], wastes = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8')).wastes;
  await check('concurrent tickets, manifests and assigned inspections preserve unique references and ownership', async () => {
    await Promise.all(users.map(async user => { user.ticket = (await call(user, '/soporte', 'POST', { descripcion: 'QA simultáneo ' + user.id }, 201, 'qa-mu-ticket-' + user.id)).id; }));
    const tickets = await db.ticketSoporte.findMany({ where: { id: { in: users.map(user => user.ticket) } } });
    assert.equal(tickets.length, 50); assert.equal(new Set(tickets.map(ticket => ticket.numero)).size, 50);
    await Promise.all(users.slice(0, 10).map(async (generator, index) => {
      const carrier = users[10 + index], operator = users[20 + index], inspector = users[30 + index];
      const manifest = (await call(generator, '/manifiestos', 'POST', { operadorId: operator.actor, transportistaId: carrier.actor,
        modalidad: 'FIJO', observaciones: 'QA multiusuario sintético', residuos: [{ tipoResiduoId: wastes[0], cantidad: 10, unidad: 'kg' }] }, 201)).manifiesto;
      generator.manifest = carrier.manifest = operator.manifest = manifest.id;
      await call(generator, '/manifiestos/' + manifest.id + '/firmar', 'POST', {});
      await call(carrier, '/manifiestos/' + manifest.id + '/confirmar-retiro', 'POST', { latitud: -32.89, longitud: -68.84 });
      const inspection = await call(admin, '/inspecciones', 'POST', { tipoInspeccion: 'GENERADOR', tipoActor: 'GENERADOR', actorId: generator.actor,
        inspectorId: inspector.id, ubicacion: 'QA ubicación sintética', clienteId: 'qa-mu-inspection-' + index }, 201);
      inspector.inspection = inspection.id;
      await call(inspector, '/inspecciones/' + inspection.id + '/estado', 'POST', { estado: 'EN_CAMPO', version: inspection.version });
    }));
    const manifests = await db.manifiesto.findMany({ where: { id: { in: users.slice(0, 10).map(user => user.manifest) } } });
    assert.equal(manifests.length, 10); assert.equal(new Set(manifests.map(row => row.numero)).size, 10);
    const inspections = await db.inspeccion.findMany({ where: { id: { in: users.slice(30, 40).map(user => user.inspection) } } });
    assert.equal(inspections.length, 10); assert.equal(new Set(inspections.map(row => row.numero)).size, 10);
  });
  await check('a simultaneous field edit keeps one winner and rejects the stale writer without overwriting', async () => {
    const inspector = users[30], route = '/inspecciones/' + inspector.inspection + '/borrador';
    const before = await call(inspector, '/inspecciones/' + inspector.inspection);
    const responses = await Promise.all(['primero', 'segundo'].map(observaciones => call(inspector, route, 'PATCH', { version: before.version, items: [], comparaciones: [], observaciones }, [200, 409])));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const stored = await call(inspector, '/inspecciones/' + inspector.inspection);
    assert.equal(stored.version, before.version + 1); assert.ok(['primero', 'segundo'].includes(stored.observaciones));
    await call(users[31], '/inspecciones/' + inspector.inspection, 'GET', undefined, 403);
  });
  await check('an official certificate is stored and downloaded by its real owner with unchanged bytes', async () => {
    const pdf = Buffer.from('%PDF-1.7\nQA SYNTHETIC CERTIFICATE, NO LEGAL EFFECT\n%%EOF\n');
    const form = new FormData(); form.set('tipo', 'CERTIFICADO_AMBIENTAL'); form.set('anio', '2026'); form.set('archivo', new Blob([pdf], { type: 'application/pdf' }), 'qa-multiuser-certificate.pdf');
    const document = (await call(admin, '/actores/generadores/' + users[0].actor + '/documentos', 'POST', form, 201)).documento;
    assert.equal(hash(await call(users[0], '/actores/documentos/' + document.id + '/download')), hash(pdf));
    await call(users[1], '/actores/documentos/' + document.id + '/download', 'GET', undefined, 403);
  });
  await check('thirty minutes of mixed 10, 25 and 50 sessions retain identity, permissions, writes and PDFs', async () => {
    startedAt = new Date().toISOString();
    for (const phase of phases) {
      const active = Array.from({ length: phase.sessions }, (_, index) => users[(index % 5) * 10 + Math.floor(index / 5)]);
      const until = Date.now() + phase.seconds * 1000; let tick = 0;
      while (Date.now() < until) {
        const lap = performance.now();
        await Promise.all(active.map(async user => {
          const profile = await call(user, '/auth/profile'); assert.equal(profile.user.id, user.id);
          const ticket = await call(user, '/soporte/' + user.ticket); assert.equal(ticket.autorId, user.id);
          if (user.group < 3) assert.equal((await call(user, '/manifiestos/' + user.manifest)).manifiesto.id, user.manifest);
          if (user.group === 1 && tick % 3 === 0) await call(user, '/manifiestos/' + user.manifest + '/ubicacion', 'POST', { latitud: -32.89, longitud: -68.84 });
          if (user.group === 3 && tick % 3 === 0) {
            const current = await call(user, '/inspecciones/' + user.inspection);
            await call(user, '/inspecciones/' + user.inspection + '/borrador', 'PATCH', { version: current.version, items: [], comparaciones: [], observaciones: 'QA persistido ' + phase.sessions + '/' + tick });
          }
          if (user.group === 4 && tick % 3 === 0) await call(user, '/centro-control/actividad?capas=transito,inspecciones');
          if (user.group === 4 && tick % 6 === 0) await call(user, '/reportes/manifiestos?limit=10');
          if (user.group === 2 && tick % 6 === 0) await call(user, '/pdf/manifiesto/' + user.manifest);
          if (tick > 0 && tick % 30 === 0) {
            const renewed = await call(null, '/auth/refresh-token', 'POST', { refreshToken: user.refresh });
            user.token = renewed.accessToken; user.refresh = renewed.refreshToken;
            assert.equal((await call(user, '/auth/profile')).user.id, user.id);
          }
        }));
        if (tick % 3 === 0) {
          const activity = await db.$queryRawUnsafe("SELECT count(*)::integer AS connections, count(*) FILTER(WHERE wait_event_type='Lock')::integer AS locks FROM pg_stat_activity WHERE datname=current_database()");
          const workers = JSON.parse(await readFile(path.join(output, 'multiuser-workers.json'), 'utf8'));
          assert.equal(workers.workers.length, 2); assert.ok(workers.workers.every((row: { rss: number }) => row.rss < 450 * 1048576));
          assert.ok(activity[0].connections <= 45, 'Two bounded twenty-connection pools plus QA observers');
          samples.push({ at: new Date().toISOString(), sessions: phase.sessions, database: activity[0], workers });
          console.log(JSON.stringify({ phase: phase.sessions, tick, requests: measurements.length, connections: activity[0].connections,
            workerRssMB: workers.workers.map((row: { rss: number }) => Math.round(row.rss / 1048576)) }));
        }
        tick++; await new Promise(resolve => setTimeout(resolve, Math.max(0, 10000 - (performance.now() - lap))));
      }
      console.log('Completed sustained phase ' + phase.sessions + ' sessions');
    }
    endedAt = new Date().toISOString(); assert.ok(Date.parse(endedAt) - Date.parse(startedAt) >= 1800000);
    for (const [group, limit] of [['read', 2000], ['write', 3000], ['pdf', 5000]] as const) {
      const times = measurements.filter(row => row.group === group && row.status < 400).map(row => row.ms).sort((a, b) => a - b);
      assert.ok(times.length > 0); assert.ok(times[Math.ceil(times.length * .95) - 1] < limit, `${group} p95 must remain below ${limit}ms`);
    }
  });
  await check('both warm workers reject GPS writes immediately after delivery without a stale per-process cache', async () => {
    const carrier = users[10];
    await Promise.all(Array.from({ length: 8 }, () => call(carrier, '/manifiestos/' + carrier.manifest + '/ubicacion', 'POST', { latitud: -32.89, longitud: -68.84 })));
    await call(carrier, '/manifiestos/' + carrier.manifest + '/confirmar-entrega', 'POST', {});
    const count = await db.trackingGPS.count({ where: { manifiestoId: carrier.manifest } });
    await Promise.all(Array.from({ length: 12 }, () => call(carrier, '/manifiestos/' + carrier.manifest + '/ubicacion', 'POST', { latitud: -32.89, longitud: -68.84 }, 404)));
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: carrier.manifest } }), count);
  });
  await check('fresh database and physical uploads restore with fifty authenticated owners and continuing references', restoreCheck);
} catch (error) {
  console.error(String(error));
  if (!checks.some(row => row.status === 'FAIL')) checks.push({ name: 'startup or unexpected failure', status: 'FAIL', error: String(error) });
  process.exitCode = 1;
} finally {
  if (cluster) await stopMultiuserCluster(cluster);
  if (nginx && nginx.exitCode === null && nginx.signalCode === null) {
    const exited = new Promise<void>(resolve => nginx!.once('exit', () => resolve())); nginx.kill('SIGTERM');
    await Promise.race([exited, new Promise<never>((_, reject) => setTimeout(() => reject(Error('QA proxy did not stop')), 10000).unref())]);
  }
  await db.$disconnect();
  const metrics = ['read', 'write', 'pdf'].map(group => {
    const rows = measurements.filter(row => row.group === group), times = rows.map(row => row.ms).sort((a, b) => a - b);
    return { group, count: rows.length, p95Ms: times[Math.max(0, Math.ceil(times.length * .95) - 1)] ?? null,
      statuses: Object.fromEntries([...new Set(rows.map(row => row.status))].map(status => [status, rows.filter(row => row.status === status).length])) };
  });
  await writeFile(path.join(output, 'multiuser.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, startedAt, endedAt, phases,
    accounts: users.length, distinctAccounts: new Set(users.map(user => user.id)).size, authenticatedAccounts: users.filter(user => user.token).length,
    checks, metrics, samples, externalProvidersDisabled: true, productionDataWritten: false, proxy: 'nginx loopback', backend: 'two Node20 cluster workers',
    limitations: ['Cloud hardware and operating system differ from the production host', 'HTTP sessions are concurrent; browser E2E is separate', 'Physical phones and complete authenticated original APK remain separate'] }, null, 2));
  await writeFile(path.join(output, 'multiuser-closure.json'), JSON.stringify({ at: new Date().toISOString(), clusterStopped: true, nginxStopped: !nginx || nginx.exitCode !== null || nginx.signalCode !== null }));
}

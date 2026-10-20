import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, externalKeys, root } from './safety.ts';
await assertCloudDatabase();
const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema');
assert.ok(['payment_identity_20261020', 'actor_onboarding_20261020'].includes(schema || ''), 'Only the dedicated artificial payment/onboarding schemas');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z'); for (const key of externalKeys) assert.equal(process.env[key], '');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const frontendRequire = createRequire(path.join(root, 'frontend/package.json')), { jsPDF } = frontendRequire('jspdf'), sharp = backendRequire('sharp');
const out = process.env.QA_ARTIFACTS!, checks: string[] = [], prefix = 'QA-PAY-' + randomUUID().slice(0, 8), cases: Record<string, any> = {};
const createdRecords: any[] = [];
let sequence = 0, address = 1;
async function api(route: string, method = 'GET', data?: unknown, token?: string, expected = 200) {
  const headers: Record<string, string> = { 'X-Forwarded-For': `127.11.70.${address++ % 240 + 1}` };
  if (token) headers.Authorization = 'Bearer ' + token;
  const body = data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data);
  if (data !== undefined && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch('http://127.0.0.1:3037/api' + route, { method, headers, body: body as BodyInit, signal: AbortSignal.timeout(30_000) });
  const result = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${result.message || response.status}`); return result;
}
async function login(user: string) { const data = (await api('/auth/login', 'POST', { email: user + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' })).data; return data.accessToken || data.tokens?.accessToken; }
function pdf(lines: string[]) { const doc = new jsPDF(); doc.setFontSize(11); doc.text(lines, 14, 20); return Buffer.from(doc.output('arraybuffer')); }
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function payment(cuit: string, id = String(Date.now()) + ++sequence) { return { emisor: 'ATM_TASAS', idComprobante: id, transaccion: '88' + id, control: '77' + id, cuit, codigoTasa: '162', fechaPago: '2026-10-20', importe: '12500.00', periodo: 'Inscripción 2026', referenciaLiquidacion: 'QA-LIQ-' + id, originalRevisado: true }; }
function ticket(data: any) { return ['ATM ADMINISTRACION TRIBUTARIA MENDOZA', 'ARTIFICIAL - SIN VALIDEZ FISCAL - NO ES UN PAGO', 'ID Comprobante: ' + data.idComprobante, 'Transaccion: ' + data.transaccion, 'Control: ' + data.control, 'CUIT: ' + data.cuit, 'Codigo de Tasa: ' + data.codigoTasa, 'Fecha Pago: 20/10/2026', 'IMPORTE TOTAL: $12.500,00']; }
async function photo(lines: string[]) { const esc = (value: string) => value.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="white"/>${lines.map((line, i) => `<text x="55" y="${75 + i * 70}" font-family="DejaVu Sans" font-size="32" fill="black">${esc(line)}</text>`).join('')}</svg>`; return sharp(Buffer.from(svg)).png().toBuffer(); }
async function attach(candidate: any, tipo: string, bytes: Buffer, mime = 'application/pdf') { const form = new FormData(); form.set('tipo', tipo); form.set('file', new Blob([bytes], { type: mime }), prefix + '-' + tipo + (mime.includes('png') ? '.png' : '.pdf')); return (await api(`/solicitudes/${candidate.id}/documentos`, 'POST', form, candidate.token, 201)).data.documento; }
async function create(type = 'GENERADOR') {
  const n = ++sequence, cuit = `30-${String(Date.now() + n).slice(-8)}-1`;
  const data = (await api('/solicitudes/iniciar', 'POST', { nombre: prefix + '-' + n, email: `${prefix}-${n}@night-qa.invalid`, cuit, password: 'OnlyLocal-NightQA-2026!', tipoActor: type }, undefined, 201)).data;
  const candidate = { id: data.solicitudId, cuit, token: data.tokens.accessToken, type };
  await api(`/solicitudes/${candidate.id}`, 'PUT', { datosActor: { razonSocial: prefix + '-' + n, cuit, domicilio: 'Domicilio artificial Mendoza 123', telefono: '02610000000', tipoOperador: type === 'OPERADOR' ? 'IN_SITU' : undefined, tefPersonal: '32', tefPotencia: '120', tefSuperficie: '1250', tefZona: 'zona_industrial' } }, candidate.token);
  return candidate;
}
async function prepare(type: string, admin: string, identity?: any, mime = 'application/pdf') {
  const candidate = await create(type), data = identity ? { ...identity, cuit: candidate.cuit } : payment(candidate.cuit);
  const requirements = (await api('/solicitudes/requisitos/' + type)).data.documentos;
  const legal = pdf(['ARTIFICIAL - SIN VALIDEZ', prefix, 'Documento de prueba del circuito de alta.']);
  for (const requirement of requirements.filter((row: any) => row.required)) await attach(candidate, requirement.tipo, legal);
  const bytes = mime === 'image/png' ? await photo(ticket(data)) : pdf(ticket(data));
  const doc = await attach(candidate, 'COMPROBANTE_PAGO', bytes, mime);
  await api(`/solicitudes/${candidate.id}/enviar`, 'POST', undefined, candidate.token);
  await api(`/solicitudes/${candidate.id}/revisar`, 'POST', undefined, admin);
  createdRecords.push({ id: candidate.id, cuit: candidate.cuit, docId: doc.id, sha256: doc.sha256, identity: data });
  writeFileSync(path.join(out, prefix + '-records.json'), JSON.stringify(createdRecords, null, 2));
  return { ...candidate, doc, identity: data, bytesHash: hash(bytes) };
}
const identify = (candidate: any, admin: string, expected = 200, change = {}) => api(`/solicitudes/${candidate.id}/documentos/${candidate.doc.id}/identidad-pago`, 'POST', { ...candidate.identity, expectedSha256: candidate.doc.sha256, ...change }, admin, expected);
const review = (candidate: any, admin: string, expected = 200) => api(`/solicitudes/${candidate.id}/documentos/${candidate.doc.id}/revisar`, 'PATCH', { estado: 'APROBADO' }, admin, expected);
try {
  const admin = await login('admin'), wrongSector = await login('admin-operador'); assert.ok(admin && wrongSector);
  const aliases = backendRequire(path.join(root, 'backend/dist/lib/trainingDirectLogin.js')).TRAINING_LOGINS;
  for (const account of aliases) await api('/auth/login', 'POST', { email: account.email, password: 'Unused-QA-2026!' }, undefined, 403);
  const first = await prepare('GENERADOR', admin); cases.first = { id: first.id, docId: first.doc.id, cuit: first.cuit };
  await review(first, admin, 409); await api(`/solicitudes/${first.id}/aprobar`, 'POST', {}, admin, 409);
  await identify(first, first.token, 403); await identify(first, wrongSector, 403);
  await identify(first, admin, 409, { expectedSha256: '0'.repeat(64) }); await identify(first, admin, 409, { cuit: '30999999999' }); await identify(first, admin, 400, { originalRevisado: false });
  checks.push('no approval without identity; applicant, wrong sector, stale bytes, substituted CUIT and unreviewed original refused');
  const confirmed = (await identify(first, admin)).data.documento;
  const events = await db.eventoPagoComprobante.count(); await identify(first, admin); assert.equal(await db.eventoPagoComprobante.count(), events);
  await review(first, admin); await identify(first, admin); assert.equal((await db.documentoSolicitud.findUniqueOrThrow({ where: { id: first.doc.id } })).estado, 'APROBADO');
  const approved = (await api(`/solicitudes/${first.id}/aprobar`, 'POST', {}, admin)).data.solicitud;
  const ledger = await db.registroPagoComprobante.findUniqueOrThrow({ where: { id: confirmed.analisis.pago.registroId } }); assert.equal(ledger.estado, 'APLICADO');
  assert.equal(await db.pagoTEF.count(), 0); assert.equal((await db.generador.findUniqueOrThrow({ where: { id: approved.generadorId } })).tefInputs.potenciaHP, 120);
  checks.push('original confirmed exactly once and applied with the approved registration; no TEF payment or installed-power change invented');
  const second = await prepare('OPERADOR', admin, first.identity, 'image/png'); assert.notEqual(second.doc.sha256, first.doc.sha256);
  assert.equal(second.doc.analisis.duplicado, false); assert.equal(second.doc.analisis.pago.coincidencia, true); assert.equal(second.doc.analisis.motor, 'TESSERACT');
  const refused = await identify(second, admin, 409); assert.ok(!JSON.stringify(refused).includes(first.cuit) && !JSON.stringify(refused).includes(first.id));
  await review(second, admin, 409); await api(`/solicitudes/${second.id}/aprobar`, 'POST', {}, admin, 409);
  checks.push('a real second PNG/OCR photo with different bytes and CUIT cannot reuse a reserved ID or disclose the first holder');
  const altered = await prepare('GENERADOR', admin, { ...first.identity, idComprobante: '999' + first.identity.idComprobante }); await identify(altered, admin, 409);
  checks.push('changing the receipt ID does not bypass the transaction/control alias');
  const actorForm = new FormData(); actorForm.set('tipo', 'COMPROBANTE_PAGO'); actorForm.set('anio', '2027'); actorForm.set('archivo', new Blob([pdf(ticket(first.identity))], { type: 'application/pdf' }), prefix + '-actor.pdf');
  const actorDoc = (await api(`/actores/generadores/${approved.generadorId}/documentos`, 'POST', actorForm, admin, 201)).data.documento;
  await api(`/actores/documentos/${actorDoc.id}/identidad-pago`, 'POST', { ...first.identity, expectedSha256: actorDoc.sha256 }, admin, 409);
  await api(`/actores/documentos/${actorDoc.id}/revisar`, 'PATCH', { estado: 'APROBADO' }, admin, 409);
  checks.push('the same payment cannot be reused as an actor attachment or another year');
  const replace = await prepare('GENERADOR', admin); await identify(replace, admin); await review(replace, admin);
  await api(`/solicitudes/${replace.id}/observar`, 'POST', { observaciones: 'Prueba artificial de otra foto: conservar la identidad.' }, admin);
  const newDoc = await attach(replace, 'COMPROBANTE_PAGO', await photo(ticket(replace.identity)), 'image/png');
  assert.notEqual(newDoc.id, replace.doc.id); assert.notEqual(newDoc.sha256, replace.doc.sha256); assert.equal(newDoc.estado, 'PENDIENTE');
  const renewed = { ...replace, doc: newDoc }; await identify(renewed, admin);
  assert.equal(await db.registroPagoComprobante.count({ where: { ambito: 'SOLICITUD:' + replace.id } }), 1);
  assert.equal(await db.eventoPagoComprobante.count({ where: { documentoId: replace.doc.id, accion: 'REEMPLAZADO' } }), 1);
  await api(`/solicitudes/${replace.id}/documentos/${newDoc.id}`, 'DELETE', undefined, replace.token);
  const afterRemoval = await prepare('GENERADOR', admin, replace.identity); await identify(afterRemoval, admin, 409);
  checks.push('replacement requires the new file review, keeps one reservation and an event; removing bytes never frees the payment');
  const raceIdentity = payment(''), raceA = await prepare('GENERADOR', admin, raceIdentity), raceB = await prepare('OPERADOR', admin, raceIdentity);
  const raceResults = await Promise.all([raceA, raceB].map(async candidate => { const response = await fetch(`http://127.0.0.1:3037/api/solicitudes/${candidate.id}/documentos/${candidate.doc.id}/identidad-pago`, { method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...candidate.identity, expectedSha256: candidate.doc.sha256 }) }); return response.status; }));
  assert.deepEqual(raceResults.sort(), [200, 409]);
  checks.push('two concurrent applications: exactly one reservation commits, the other gets 409');
  const legacy = await prepare('GENERADOR', admin), legacy2 = await prepare('OPERADOR', admin), untouched = await prepare('GENERADOR', admin);
  for (const candidate of [legacy, legacy2]) await db.documentoSolicitud.update({ where: { id: candidate.doc.id }, data: { estado: 'APROBADO', analisis: { version: 1, duplicado: false, lectura: 'NO_DISPONIBLE', motor: null, texto: '', alcance: 'Lectura histórica artificial no disponible.', aviso: 'Revisión manual' } } });
  await api(`/solicitudes/${legacy.id}/observar`, 'POST', { observaciones: 'Conciliación artificial de identidad histórica; mantener el original.' }, admin);
  await api(`/solicitudes/${legacy.id}/documentos/${legacy.doc.id}`, 'DELETE', undefined, legacy.token, 409);
  await identify(untouched, admin, 409);
  const legacyHash = legacy.doc.sha256; await identify(legacy, admin); await identify(legacy2, admin); await identify(untouched, admin);
  assert.equal((await db.documentoSolicitud.findUniqueOrThrow({ where: { id: legacy.doc.id } })).estado, 'APROBADO'); assert.equal((await db.documentoSolicitud.findUniqueOrThrow({ where: { id: legacy.doc.id } })).sha256, legacyHash);
  checks.push('unidentified historical approvals block new payments; each original can be reconciled without deadlocking the batch or changing its decision/bytes');
  const issuers = ['EDEMSA', 'EDESTESA', 'Cooperativa Empresa Electrica de Godoy Cruz', 'Cooperativa Alto Verde y Algarrobo Grande', 'Cooperativa Popular Rivadavia', 'CECSAGAL', 'Cooperativa Electrica Medrano', 'Cooperativa Electrica Monte Coman', 'COSPAC Bowen', 'Cooperativa Electrica Santa Rosa', 'Cooperativa Sud Rio Tunuyan'];
  const catalog = backendRequire(path.join(root, 'backend/dist/domain/electricityReading.js')).MENDOZA_DISTRIBUTORS;
  const billProof: any[] = [];
  for (let index = 0; index < issuers.length; index++) {
    const bytes = await photo([issuers[index], 'FACTURA ARTIFICIAL - SIN VALIDEZ', 'Tarifa: T2 R BT', 'Consumo facturado: 1.250 kWh', 'Potencia contratada: 45 kW', 'Potencia registrada: 42 kW', 'NIC: 900000001', 'Periodo: 2026/10']);
    const form = new FormData(); form.set('tipo', 'FACTURA_ELECTRICA'); form.set('file', new Blob([bytes], { type: 'image/png' }), 'factura-artificial.png');
    const data = (await api('/solicitudes/analizar-documento', 'POST', form)).data;
    assert.equal(data.persistido, false); assert.equal(data.analisis.motor, 'TESSERACT'); assert.equal(data.analisis.electricidad.distribuidora, catalog[index].id);
    assert.equal(data.analisis.electricidad.campos.categoriaTarifaria, 'T2RBT'); assert.equal(data.analisis.electricidad.campos.consumoKwh, '1250'); assert.equal(data.analisis.electricidad.campos.potenciaContratadaKw, '45');
    billProof.push({ issuer: catalog[index].id, sha256: hash(bytes), reading: data.analisis.electricidad, synthetic: true });
  }
  checks.push('eleven Mendoza supplier headers pass native Spanish OCR in synthetic invoice layouts; explicit tariff/kWh/kW evidence, no persisted anonymous file');
  const hybridPhoto = await photo(['EDEMSA', 'FACTURA ARTIFICIAL - SIN VALIDEZ', 'Tarifa: T2 R BT', 'Consumo facturado: 1.250 kWh', 'Potencia contratada: 45 kW', 'NIC: 900000001', 'Periodo: 2026/10']);
  const hybrid = new jsPDF(); hybrid.setFontSize(11); hybrid.text('EDEMSA - FACTURA ARTIFICIAL CON CAPA PARCIAL', 14, 15);
  hybrid.addImage(hybridPhoto.toString('base64'), 'PNG', 14, 30, 180, 135);
  const hybridBytes = Buffer.from(hybrid.output('arraybuffer')), hybridForm = new FormData();
  hybridForm.set('tipo', 'FACTURA_ELECTRICA'); hybridForm.set('file', new Blob([hybridBytes], { type: 'application/pdf' }), 'factura-hibrida-artificial.pdf');
  const hybridRead = (await api('/solicitudes/analizar-documento', 'POST', hybridForm)).data;
  assert.equal(hybridRead.persistido, false); assert.equal(hybridRead.analisis.motor, 'TESSERACT');
  assert.equal(hybridRead.analisis.electricidad.distribuidora, 'EDEMSA'); assert.equal(hybridRead.analisis.electricidad.campos.categoriaTarifaria, 'T2RBT');
  assert.equal(hybridRead.analisis.electricidad.campos.consumoKwh, '1250'); assert.match(hybridRead.analisis.alcance, /Texto del PDF y OCR/);
  billProof.push({ issuer: 'EDEMSA', sha256: hash(hybridBytes), reading: hybridRead.analisis.electricidad, synthetic: true, layout: 'hybrid-pdf' });
  checks.push('a hybrid PDF with a partial digital header still OCRs its invoice image and recovers the explicit tariff and consumption');
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    const clean = await prepare('GENERADOR', admin), conflict = await prepare('OPERADOR', admin, first.identity);
    cases[project] = { clean: { id: clean.id, docId: clean.doc.id, sha256: clean.doc.sha256, identity: clean.identity }, conflict: { id: conflict.id, docId: conflict.doc.id, sha256: conflict.doc.sha256, identity: conflict.identity } };
  }
  if (schema === 'actor_onboarding_20261020') {
    const baseline = JSON.parse(readFileSync(path.join(out, 'protected-schemas-before.json'), 'utf8'));
    for (const [key, rows] of Object.entries(baseline)) {
      const [namespace, table] = key.split('.'); assert.notEqual(namespace, schema);
      assert.match(namespace, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(table, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
      assert.deepEqual(await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${namespace}"."${table}" t`), rows, key);
    }
  } else {
    const baseline = JSON.parse(readFileSync(path.join(out, 'shared-qa-original-records.json'), 'utf8'));
    const sharedUrl = new URL(process.env.DATABASE_URL!); sharedUrl.searchParams.set('schema', 'public'); const shared = new PrismaClient({ datasources: { db: { url: sharedUrl.toString() } } });
    try { for (const [table, rows] of Object.entries(baseline.tables)) assert.deepEqual((await shared[table].findMany({ orderBy: { id: 'asc' } })).map((row: any) => ({ id: row.id, hash: createHash('sha256').update(JSON.stringify(row)).digest('hex') })), rows); }
    finally { await shared.$disconnect(); }
  }
  assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0); assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  checks.push('shared QA history untouched; all generated mail suppressed with zero delivery attempts, CAP still closed');
  writeFileSync(path.join(out, 'payment-electricity-fixture.json'), JSON.stringify({ prefix, cases, synthetic: true, production: false }, null, 2));
  writeFileSync(path.join(out, 'payment-electricity-integration.json'), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, billProof, ledger: await db.registroPagoComprobante.count(), events: await db.eventoPagoComprobante.count(), suppressedEmails: await db.emailQueue.count(), namespace: schema, capClosed: true, production: false }, null, 2));
  console.log('Payment/electricity integration: ' + checks.length + ' groups PASS, twelve native synthetic invoice reads');
} catch (error) { writeFileSync(path.join(out, prefix + '-failure.json'), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, error: error instanceof Error ? error.message : String(error) }, null, 2)); console.error(JSON.stringify({ failed: true, prefix, passed: checks.length, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
finally { await db.$disconnect(); }

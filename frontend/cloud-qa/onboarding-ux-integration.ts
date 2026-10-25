import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { jsPDF } = createRequire(root + '/frontend/package.json')('jspdf'), sharp = backendRequire('sharp');
const run = 'onboarding-ux-' + randomUUID().slice(0, 8), password = 'OnlyLocal-NightQA-2026!';
const out = process.env.QA_ARTIFACTS!, cases: any[] = [], checks: string[] = [];
let requests = 0, sequence = 0;
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
async function api(route: string, token?: string, body?: any, expected = 200, method = body === undefined ? 'GET' : 'POST', headers = {}) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, {
    method, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  requests++; const result = await response.json();
  assert.equal(response.status, expected, route + ': ' + JSON.stringify(result)); return result.data;
}
const login = async (email: string) => (await api('/auth/login', undefined, { email, password })).tokens.accessToken;
function pdf(lines: string[]) { const doc = new jsPDF(); doc.setFontSize(10); doc.text(['ARTIFICIAL - SIN VALIDEZ - NO ES UN PAGO', run, ...lines], 14, 20); return Buffer.from(doc.output('arraybuffer')); }
async function image(lines: string[]) {
  const esc = (value: string) => value.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  return sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><rect width="1600" height="1100" fill="white"/>' + ['ARTIFICIAL - SIN VALIDEZ', ...lines].map((line, i) => '<text x="40" y="' + (70 + i * 65) + '" font-family="DejaVu Sans" font-size="32">' + esc(line) + '</text>').join('') + '</svg>')).png().toBuffer();
}
const ticket = (p: any) => ['ATM ADMINISTRACION TRIBUTARIA MENDOZA', 'ID Comprobante: ' + p.idComprobante, 'Transaccion: ' + p.transaccion, 'Control: ' + p.control, 'CUIT: ' + p.cuit, 'Codigo de Tasa: 162', 'Fecha Pago: 25/10/2026', 'IMPORTE TOTAL: $12.500,00'];
async function attach(c: any, tipo: string, bytes: Buffer, mime = 'application/pdf') {
  const form = new FormData(); form.set('tipo', tipo); form.set('file', new Blob([bytes], { type: mime }), run + '-' + tipo + (mime === 'image/png' ? '.png' : '.pdf'));
  return (await api('/solicitudes/' + c.id + '/documentos', c.token, form, 201)).documento;
}
async function candidate(type: string, owner?: any) {
  const email = owner?.email || run + '-' + (++sequence) + '@night-qa.invalid', cuit = owner?.cuit || syntheticCuit(Date.now() + sequence * 101);
  const response = owner
    ? await api('/solicitudes/actividad-adicional', owner.token, { tipoActor: type }, 201)
    : await api('/solicitudes/iniciar', undefined, { nombre: 'QA alta ' + type, email, cuit, password, tipoActor: type }, 201);
  const id = owner ? response.solicitud.id : response.solicitudId;
  if (!owner) {
    const person = await db.usuario.findUniqueOrThrow({ where: { email } });
    assert.equal(person.activo, false); assert.equal(person.emailVerified, false);
    // Fixture-only token delivery: use the actual verification endpoint, no mail.
    const token = randomUUID();
    await db.usuario.update({ where: { id: person.id }, data: { emailVerificationToken: hash(token) } });
    await api('/auth/verify-email?token=' + token);
  }
  const token = owner?.token || await login(email);
  const c = { id, email, cuit, token, type };
  const datosActor = {
    razonSocial: 'QA ' + run, cuit, domicilio: 'Domicilio artificial 123', telefono: '02610000000', emailContacto: email,
    numeroInscripcion: 'QA-INS', numeroHabilitacion: 'QA-HAB', categoria: 'Medianos Generadores', vencimientoHabilitacion: '2028-12-31',
    domicilioLegalCalle: 'Legal artificial', domicilioLegalLocalidad: 'Mendoza', domicilioLegalDepto: 'Capital',
    domicilioRealCalle: 'Sede artificial', domicilioRealLocalidad: 'Mendoza', domicilioRealDepto: 'Capital',
    coordenadas: '-32.89,-68.84', tipoOperador: 'IN_SITU', corrientesY: 'Y8, Y12', corrientesControl: 'Y8, Y12', corrientesAutorizadas: 'Y8, Y12',
    tefPersonal: '32', tefPotencia: '120', tefSuperficie: '1250', tefZona: 'zona_industrial',
    ...(type === 'TRANSPORTISTA' ? { vehiculosJson: JSON.stringify([{ patente: 'QA' + Date.now().toString().slice(-7), marca: 'QA', modelo: 'Artificial', anio: '2026', capacidad: '12500', vencimiento: '2028-12-31' }]), choferesJson: JSON.stringify([{ nombre: 'Chofer', apellido: 'Artificial', dni: '90000001', licencia: 'QA-LIC', vencimiento: '2028-12-31' }]) } : {}),
  };
  const current = (await api('/solicitudes/' + id, token)).solicitud;
  await api('/solicitudes/' + id, token, { datosActor, expectedUpdatedAt: current.updatedAt }, 200, 'PUT');
  await api('/solicitudes/' + id + '/enviar', token, {}, 400);
  cases.push(c); writeFileSync(out + '/onboarding-ux-fixture.json', JSON.stringify(cases.map(({ token: _, ...c }) => c), null, 2));
  return c;
}
async function documents(c: any, identity?: any, photo = false) {
  const n = String(Date.now()) + (++sequence);
  const payment = { emisor: 'ATM_TASAS', idComprobante: n, transaccion: '88' + n, control: '77' + n, codigoTasa: '162', fechaPago: '2026-10-25', importe: '12500.00', periodo: 'Inscripción 2026', referenciaLiquidacion: run + '-' + n, ...identity, cuit: c.cuit, originalRevisado: true };
  const required = (await api('/solicitudes/requisitos/' + c.type)).documentos.filter((d: any) => d.required || d.tipo === 'COMPROBANTE_PAGO');
  const docs = [];
  for (const item of required) {
    const lines = item.tipo === 'COMPROBANTE_PAGO' ? ticket(payment) : [c.id, item.tipo, 'Documento artificial para probar el alta'];
    docs.push(await attach(c, item.tipo, photo && item.tipo === 'COMPROBANTE_PAGO' ? await image(lines) : pdf(lines), photo && item.tipo === 'COMPROBANTE_PAGO' ? 'image/png' : 'application/pdf'));
  }
  if (c.type !== 'TRANSPORTISTA') {
    const electricity = await attach(c, 'FACTURA_ELECTRICA', await image([c.type === 'GENERADOR' ? 'EDEMSA' : 'Cooperativa Empresa Electrica de Godoy Cruz', 'Tarifa: T2 R BT', 'Consumo facturado: 1.250 kWh', 'Potencia contratada: 45 kW', 'NIC: 900000001', 'Periodo: 2026/10']), 'image/png');
    assert.equal(electricity.analisis.electricidad.campos.consumoKwh, '1250');
    assert.equal(electricity.analisis.electricidad.campos.potenciaContratadaKw, '45');
    assert.equal(electricity.analisis.electricidad.campos.categoriaTarifaria, 'T2RBT');
    c.electricityId = electricity.id;
  }
  c.docs = docs; c.payment = payment;
  await api('/solicitudes/' + c.id + '/enviar', c.token, {});
  return docs.find((d: any) => d.tipo === 'COMPROBANTE_PAGO');
}
try {
  const manifestBefore = hash(JSON.stringify(await db.manifiesto.findMany({ orderBy: { id: 'asc' } })));
  const admin = await login('admin@night-qa.invalid');
  const approve = async (c: any, observation = false) => {
    const paymentDoc = await documents(c);
    await api('/solicitudes/' + c.id + '/revisar', admin, {});
    if (observation) {
      const doc = c.docs.find((d: any) => d.tipo === 'CONSTANCIA_AFIP');
      await api('/solicitudes/' + c.id + '/documentos/' + doc.id + '/revisar', admin, { estado: 'RECHAZADO', observaciones: 'QA original ilegible' }, 200, 'PATCH');
      await api('/solicitudes/' + c.id + '/observar', admin, { observaciones: 'Reemplazá la constancia ilegible.' });
      const corrected = await attach(c, 'CONSTANCIA_AFIP', pdf([c.id, 'Constancia corregida artificial']));
      c.docs = c.docs.map((d: any) => d.id === doc.id ? corrected : d);
      await api('/solicitudes/' + c.id + '/enviar', c.token, {});
      await api('/solicitudes/' + c.id + '/revisar', admin, {});
    }
    const identify = '/solicitudes/' + c.id + '/documentos/' + paymentDoc.id + '/identidad-pago';
    await api(identify, c.token, { ...c.payment, expectedSha256: paymentDoc.sha256 }, 403);
    await api(identify, admin, { ...c.payment, expectedSha256: '0'.repeat(64) }, 409);
    await api(identify, admin, { ...c.payment, expectedSha256: paymentDoc.sha256 });
    for (const d of c.docs) await api('/solicitudes/' + c.id + '/documentos/' + d.id + '/revisar', admin, { estado: 'APROBADO' }, 200, 'PATCH');
    const approved = (await api('/solicitudes/' + c.id + '/aprobar', admin, {})).solicitud;
    c.actorId = approved.generadorId || approved.transportistaId || approved.operadorId;
    c.token = await login(c.email);
    const actor = await db[c.type.toLowerCase()].findUniqueOrThrow({ where: { id: c.actorId } });
    if (c.type !== 'TRANSPORTISTA') assert.equal(actor.tefInputs.potenciaHP, 120);
    checks.push(c.type + ': documentos, revisión ATM, aprobación y acceso operativo' + (observation ? ', observación y corrección' : ''));
  };
  const owner = await candidate('GENERADOR'); await approve(owner, true);
  for (const type of ['TRANSPORTISTA', 'OPERADOR']) { const c = await candidate(type); await approve(c); }
  for (const type of ['TRANSPORTISTA', 'OPERADOR']) { const c = await candidate(type, owner); await approve(c); }
  const duplicate = await candidate('GENERADOR'), dupDoc = await documents(duplicate, owner.payment, true);
  await api('/solicitudes/' + duplicate.id + '/revisar', admin, {});
  assert.notEqual(dupDoc.sha256, owner.docs.find((d: any) => d.tipo === 'COMPROBANTE_PAGO').sha256);
  await api('/solicitudes/' + duplicate.id + '/documentos/' + dupDoc.id + '/identidad-pago', admin, { ...duplicate.payment, expectedSha256: dupDoc.sha256 }, 409);
  checks.push('Otro CUIT y otra foto no reutilizan el pago reservado');
  const company = (await api('/empresas', owner.token)).empresas[0], route = '/empresas/' + company.id;
  let detail = await api(route, owner.token); assert.equal(detail.actividades.length, 3); assert.equal(detail.cupoPersonas.ocupados, 1);
  const template = await db.usuario.findUniqueOrThrow({ where: { email: owner.email } });
  const member = await db.usuario.create({ data: { email: run + '-member@night-qa.invalid', nombre: 'QA segunda persona', password: template.password, rol: 'GENERADOR', activo: true, emailVerified: true } });
  for (const activity of detail.actividades) await api(route + '/personas', owner.token, { email: member.email, actividadId: activity.id, todosEstablecimientos: true, establecimientoIds: [] }, 201);
  detail = await api(route, owner.token); assert.equal(detail.cupoPersonas.ocupados, 2); assert.equal(detail.cupoPersonas.maximo, 2);
  await api(route + '/invitaciones', owner.token, { email: run + '-third@night-qa.invalid', actividadId: detail.actividades[0].id, todosEstablecimientos: true, establecimientoIds: [] }, 409);
  const memberToken = await login(member.email);
  for (const activity of detail.actividades) {
    const profile = (await api('/auth/profile', memberToken, undefined, 200, 'GET', { 'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id })).user;
    assert.equal(profile.rol, activity.rol); assert.equal(profile.empresaContexto.empresaId, company.id);
  }
  checks.push('Tres actividades, dos personas totales, tercer representante bloqueado y contexto de cada rol autorizado');
  assert.equal(hash(JSON.stringify(await db.manifiesto.findMany({ orderBy: { id: 'asc' } }))), manifestBefore);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
  writeFileSync(out + '/onboarding-ux-fixture.json', JSON.stringify({ cases: cases.map(({ token: _, ...c }) => c), companyId: company.id, owner: owner.email, member: member.email }, null, 2));
  writeFileSync(out + '/onboarding-ux-http.json', JSON.stringify({ at: new Date().toISOString(), run, requests, checks, manifestBefore, manifestsUntouched: true, emailsSent: 0, push: false, capClosed: true }, null, 2));
  console.log('PASS onboarding integration: ' + checks.length + ' groups; ' + requests + ' requests');
} catch (error) {
  writeFileSync(out + '/onboarding-ux-failure.json', JSON.stringify({ run, requests, checks, error: String(error) }, null, 2)); throw error;
} finally { await db.$disconnect(); }

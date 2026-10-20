import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const initial = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/fixture.json', 'utf8'));
const stamp = randomUUID().slice(0, 8), users: Record<string, any> = {}, actors: Record<string, any> = {};
try {
  assert.equal(existsSync(process.env.QA_ARTIFACTS + '/intake-fixture.json'), false, 'Preserve an initialized fixture; do not rerun it');
  const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8);
  for (const [name, rol] of Object.entries({ generator: 'GENERADOR', carrier: 'TRANSPORTISTA', operator: 'OPERADOR', 'foreign-operator': 'OPERADOR', 'foreign-generator': 'GENERADOR', inspector2: 'GENERADOR' })) {
    users[name] = await db.usuario.findUnique({ where: { email: name + '@night-qa.invalid' } }) || await db.usuario.create({ data: { email: name + '@night-qa.invalid', nombre: 'QA ' + name, password, rol, activo: true, emailVerified: true, notifEmail: false, esInspector: name === 'inspector2' } });
    assert.equal(users[name].rol, rol);
    if (name.startsWith('inspector')) continue;
    const common = { usuarioId: users[name].id, razonSocial: 'QA artificial ' + name + ' ' + stamp, cuit: '99-ARTIFICIAL-' + name + '-' + stamp,
      domicilio: 'QA sin domicilio real', telefono: 'QA sin teléfono', email: users[name].email };
    const args = { where: { usuarioId: users[name].id } };
    actors[name] = rol === 'GENERADOR' ? await db.generador.findUnique(args) || await db.generador.create({ data: { ...common, categoria: 'QA', numeroInscripcion: 'QA-no-oficial' } })
      : rol === 'TRANSPORTISTA' ? await db.transportista.findUnique(args) || await db.transportista.create({ data: { ...common, numeroHabilitacion: 'QA-no-oficial' } })
      : await db.operador.findUnique(args) || await db.operador.create({ data: { ...common, categoria: 'QA', numeroHabilitacion: 'QA-no-oficial', corrientesY: 'Y1 / Y2' } });
  }
  const waste = await db.tipoResiduo.findUnique({ where: { codigo: 'Y1' } }) || await db.tipoResiduo.create({ data: { codigo: 'Y1', nombre: 'Residuo artificial QA', categoria: 'QA', peligrosidad: 'QA' } });
  let index = 0;
  const trip = (state = 'RECIBIDO') => db.manifiesto.create({ data: {
    numero: `QA-HALLAZGO-${stamp}-${++index}`, generadorId: actors.generator.id, operadorId: actors.operator.id, transportistaId: actors.carrier.id,
    creadoPorId: users.generator.id, estado: state, modalidad: 'FIJO', isDemoData: true,
    ...(state === 'EN_TRANSITO' ? { fechaRetiro: new Date() } : {}), residuos: { create: [{ tipoResiduoId: waste.id, cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] },
  } });
  const http: Record<string, any> = {};
  for (const name of ['finding', 'quantity', 'clean', 'unknown', 'concurrent', 'driver']) http[name] = await trip(name === 'driver' ? 'EN_TRANSITO' : 'RECIBIDO');
  const cases: Record<string, any> = {};
  for (const project of ['web-desktop', 'web-responsive', 'app']) cases[project] = { finding: await trip(), handoff: await trip('EN_TRANSITO') };
  writeFileSync(process.env.QA_ARTIFACTS + '/intake-fixture.json', JSON.stringify({ stamp, users: Object.fromEntries(Object.entries(users).map(([name, user]) => [name, { id: user.id, email: user.email }])), actors, cases, http, initialUsers: initial.users, synthetic: true }, null, 2));
  console.log('Fresh artificial accounts and manifests created only in the private QA schema.');
} finally { await db.$disconnect(); }

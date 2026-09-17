import bcrypt from 'bcryptjs';
import { PrismaClient, Rol } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || '';
if (process.env.QA_CONFIRM_ISOLATED !== 'YES') {
  throw new Error('QA_CONFIRM_ISOLATED=YES is required');
}
if (process.env.NODE_ENV === 'production' || !/(localhost|127\.0\.0\.1)/i.test(databaseUrl)) {
  throw new Error('QA fixture refuses non-local or production-like DATABASE_URL');
}
if (/(sitrep_prod|trazabilidad_rrpp|rptrazar)/i.test(databaseUrl)) {
  throw new Error('QA fixture refuses a production-like database name');
}

const adminEmail = process.env.QA_ADMIN_EMAIL || 'qa.admin@sitrep.local';
const configuredPassword = process.env.QA_ADMIN_PASSWORD;
if (!configuredPassword || configuredPassword.length < 12) {
  throw new Error('Set QA_ADMIN_PASSWORD (at least 12 characters)');
}
const adminPassword: string = configuredPassword;

const prisma = new PrismaClient();

async function upsertUser(email: string, nombre: string, passwordHash: string, role: Rol = Rol.ADMIN) {
  return prisma.usuario.upsert({
    where: { email },
    update: {
      password: passwordHash,
      rol: role,
      nombre,
      apellido: 'QA',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
    create: {
      email,
      password: passwordHash,
      rol: role,
      nombre,
      apellido: 'QA',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
  });
}

async function upsertGenerator(userId: string, email: string, suffix: string) {
  return prisma.generador.upsert({
    where: { usuarioId: userId },
    update: {
      razonSocial: `QA Generador ${suffix}`,
      cuit: `30-9999999${suffix === 'A' ? '1' : '2'}-7`,
      domicilio: 'QA local aislado',
      telefono: '0000000000',
      email,
      numeroInscripcion: `QA-GEN-${suffix}`,
      categoria: 'B',
      activo: true,
    },
    create: {
      usuarioId: userId,
      razonSocial: `QA Generador ${suffix}`,
      cuit: `30-9999999${suffix === 'A' ? '1' : '2'}-7`,
      domicilio: 'QA local aislado',
      telefono: '0000000000',
      email,
      numeroInscripcion: `QA-GEN-${suffix}`,
      categoria: 'B',
      activo: true,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await upsertUser(adminEmail, 'QA Admin', passwordHash);
  const actorEmail = 'qa.generador.a@sitrep.local';
  const secondActorEmail = 'qa.generador.b@sitrep.local';
  const actorUser = await prisma.usuario.upsert({
    where: { email: actorEmail },
    update: {
      password: passwordHash,
      rol: Rol.GENERADOR,
      nombre: 'QA Generador A',
      apellido: 'Fixture',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
    create: {
      email: actorEmail,
      password: passwordHash,
      rol: Rol.GENERADOR,
      nombre: 'QA Generador A',
      apellido: 'Fixture',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
  });
  const secondActorUser = await prisma.usuario.upsert({
    where: { email: secondActorEmail },
    update: {
      password: passwordHash,
      rol: Rol.GENERADOR,
      nombre: 'QA Generador B',
      apellido: 'Fixture',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
    create: {
      email: secondActorEmail,
      password: passwordHash,
      rol: Rol.GENERADOR,
      nombre: 'QA Generador B',
      apellido: 'Fixture',
      activo: true,
      emailVerified: true,
      esDemo: false,
      forcePasswordChange: false,
    },
  });
  const actor = await upsertGenerator(actorUser.id, actorEmail, 'A');
  const secondActor = await upsertGenerator(secondActorUser.id, secondActorEmail, 'B');
  const transportEmail = 'qa.transportista@sitrep.local';
  const operatorEmail = 'qa.operador@sitrep.local';
  const transportUser = await upsertUser(transportEmail, 'Transportista QA', passwordHash, Rol.TRANSPORTISTA);
  const operatorUser = await upsertUser(operatorEmail, 'Operador QA', passwordHash, Rol.OPERADOR);
  const transportista = await prisma.transportista.upsert({
    where: { usuarioId: transportUser.id }, update: {},
    create: { usuarioId: transportUser.id, razonSocial: 'Transporte QA', cuit: '30999999937', domicilio: 'QA', telefono: '0000000000', email: transportEmail, numeroHabilitacion: 'QA-TRANS-1', vencimientoHabilitacion: new Date('2028-01-01') },
  });
  const operador = await prisma.operador.upsert({
    where: { usuarioId: operatorUser.id }, update: {},
    create: { usuarioId: operatorUser.id, razonSocial: 'Operador QA', cuit: '30999999947', domicilio: 'QA', telefono: '0000000000', email: operatorEmail, numeroHabilitacion: 'QA-OP-1', categoria: 'B', vencimientoHabilitacion: new Date('2028-01-01') },
  });
  const residue = await prisma.tipoResiduo.upsert({
    where: { codigo: 'QA-Y1' }, update: {},
    create: { codigo: 'QA-Y1', nombre: 'Residuo sintético de prueba', categoria: 'Y1', peligrosidad: 'QA' },
  });
  await prisma.tratamientoAutorizado.upsert({
    where: { operadorId_tipoResiduoId_metodo: { operadorId: operador.id, tipoResiduoId: residue.id, metodo: 'QA-TRATAMIENTO' } }, update: {},
    create: { operadorId: operador.id, tipoResiduoId: residue.id, metodo: 'QA-TRATAMIENTO', fechaVencimiento: new Date('2028-01-01') },
  });
  if (!await prisma.vehiculo.findFirst({ where: { transportistaId: transportista.id } })) await prisma.vehiculo.create({ data: { transportistaId: transportista.id, patente: 'QA123AB', marca: 'QA', modelo: 'QA', anio: 2025, capacidad: 10000, numeroHabilitacion: 'QA-VEH-1', vencimiento: new Date('2028-01-01') } });
  if (!await prisma.chofer.findFirst({ where: { transportistaId: transportista.id } })) await prisma.chofer.create({ data: { transportistaId: transportista.id, nombre: 'Chofer', apellido: 'QA', dni: '99999999', licencia: 'QA-LIC-1', telefono: '0000000000', vencimiento: new Date('2028-01-01') } });
  await Promise.all([
    upsertUser('qa.admin.generador@sitrep.local', 'Admin Generador QA', passwordHash, Rol.ADMIN_GENERADOR),
    upsertUser('qa.admin.operador@sitrep.local', 'Admin Operador QA', passwordHash, Rol.ADMIN_OPERADOR),
    upsertUser('qa.admin.transportista@sitrep.local', 'Admin Transporte QA', passwordHash, Rol.ADMIN_TRANSPORTISTA),
    upsertUser('qa.auditor@sitrep.local', 'Auditor QA', passwordHash, Rol.AUDITOR),
  ]);

  console.log(JSON.stringify({
    adminEmail,
    actorId: actor.id,
    secondActorId: secondActor.id,
    transportistaId: transportista.id,
    operadorId: operador.id,
    tipoResiduoId: residue.id,
  }));
  void admin;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

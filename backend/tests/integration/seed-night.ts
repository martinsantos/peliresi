import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

// This fixture must never be usable against a production or shared development DB.
export function assertNightDatabase(): void {
  const url = new URL(process.env.DATABASE_URL || '');
  if (process.env.ALLOW_SYNTHETIC_QA !== '1' || url.hostname !== '127.0.0.1'
    || url.port !== '55440' || !/^\/sitrep_night_qa_\d{8}$/.test(url.pathname)) {
    throw new Error('Night QA requires explicit authorization and its isolated loopback database');
  }
}

export const qaPassword = 'OnlyLocal-NightQA-2026!';
export const qaEmail = (name: string) => `${name}@night-qa.invalid`;

export async function seedNightDatabase() {
  assertNightDatabase();
  const prisma = new PrismaClient();
  try {
    const password = await bcrypt.hash(qaPassword, 10);
    const definitions: [string, Rol, boolean][] = [
      ['admin', 'ADMIN', true], ['inspector', 'GENERADOR', true],
      ['inspector2', 'GENERADOR', true], ['generador', 'GENERADOR', false],
      ['sin-actor', 'GENERADOR', false],
      ['generador2', 'GENERADOR', false], ['transportista', 'TRANSPORTISTA', false],
      ['transportista2', 'TRANSPORTISTA', false], ['operador', 'OPERADOR', false],
      ['operador2', 'OPERADOR', false], ['jefe-generadores', 'ADMIN_GENERADOR', true],
      ['jefe-transporte', 'ADMIN_TRANSPORTISTA', true], ['jefe-operadores', 'ADMIN_OPERADOR', true],
    ];
    const users: Record<string, string> = {};
    for (const [name, rol, esInspector] of definitions) {
      const data = { password, rol, esInspector, nombre: `QA ${name}`, activo: true,
        emailVerified: true, notifEmail: false, notifNuevoRegistro: false,
        notifWhatsapp: false, notifTelegram: false };
      const user = await prisma.usuario.upsert({ where: { email: qaEmail(name) },
        create: { ...data, email: qaEmail(name) }, update: data });
      users[name] = user.id;
    }
    const wastes: string[] = [];
    for (let index = 1; index <= 30; index++) {
      const data = { nombre: `QA Corriente Y${index}`, categoria: 'PELIGROSO', peligrosidad: 'TOXICO' };
      const waste = await prisma.tipoResiduo.upsert({ where: { codigo: `Y${index}` },
        create: { ...data, codigo: `Y${index}` }, update: data });
      wastes.push(waste.id);
    }
    const actors: Record<string, string> = {};
    for (let index = 1; index <= 2; index++) {
      const suffix = index === 1 ? '' : '2';
      const common = { domicilio: 'QA SIN DOMICILIO REAL', telefono: '0000000000',
        latitud: -32.89 + index * 0.01, longitud: -68.84, activo: true };
      const currents = Array.from({ length: index === 1 ? 30 : 2 }, (_, i) => `Y${i + 1}`).join('/');
      const generator = await prisma.generador.upsert({ where: { usuarioId: users[`generador${suffix}`] },
        create: { ...common, usuarioId: users[`generador${suffix}`], razonSocial: `QA Generador ${index}`,
          cuit: `99-0000000${index}-0`, email: qaEmail(`generador${suffix}`),
          numeroInscripcion: `QA-GEN-${index}`, categoria: 'GRAN_GENERADOR', corrientesControl: currents }, update: {} });
      const transporter = await prisma.transportista.upsert({ where: { usuarioId: users[`transportista${suffix}`] },
        create: { ...common, usuarioId: users[`transportista${suffix}`], razonSocial: `QA Transporte ${index}`,
          cuit: `99-1000000${index}-0`, email: qaEmail(`transportista${suffix}`),
          numeroHabilitacion: `QA-TRA-${index}`, corrientesAutorizadas: currents,
          vencimientoHabilitacion: new Date('2030-01-01') }, update: {} });
      const operator = await prisma.operador.upsert({ where: { usuarioId: users[`operador${suffix}`] },
        create: { ...common, usuarioId: users[`operador${suffix}`], razonSocial: `QA Operador ${index}`,
          cuit: `99-2000000${index}-0`, email: qaEmail(`operador${suffix}`),
          numeroHabilitacion: `QA-OPE-${index}`, categoria: 'TRATAMIENTO', corrientesY: currents,
          modalidades: ['FIJO', 'IN_SITU'], vencimientoHabilitacion: new Date('2030-01-01') }, update: {} });
      actors[`generador${suffix}`] = generator.id;
      actors[`transportista${suffix}`] = transporter.id;
      actors[`operador${suffix}`] = operator.id;
      for (const tipoResiduoId of wastes.slice(0, index === 1 ? 30 : 2)) {
        await prisma.tratamientoAutorizado.upsert({
          where: { operadorId_tipoResiduoId_metodo: { operadorId: operator.id, tipoResiduoId, metodo: 'QA ESTABILIZACION' } },
          create: { operadorId: operator.id, tipoResiduoId, metodo: 'QA ESTABILIZACION' }, update: {},
        });
      }
      await prisma.vehiculo.upsert({ where: { id: `night-qa-vehicle-${index}` },
        create: { id: `night-qa-vehicle-${index}`, transportistaId: transporter.id, patente: `QA000${index}`,
          marca: 'QA', modelo: 'SINTETICO', anio: 2026, capacidad: 1000,
          numeroHabilitacion: `QA-VEH-${index}`, vencimiento: new Date('2030-01-01') }, update: {} });
      await prisma.chofer.upsert({ where: { id: `night-qa-driver-${index}` },
        create: { id: `night-qa-driver-${index}`, transportistaId: transporter.id, nombre: 'QA',
          apellido: 'Sintetico', dni: `0000000${index}`, licencia: `QA-${index}`,
          vencimiento: new Date('2030-01-01'), telefono: '0000000000' }, update: {} });
    }
    return { users, actors, wastes };
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) {
  seedNightDatabase().then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}

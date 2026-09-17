/**
 * Deterministic, synthetic training dataset for the isolated demo database.
 * Never point DATABASE_URL at trazabilidad_rrpp when running this script.
 */
import { PrismaClient, EstadoManifiesto, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BATCH = process.env.DEMO_BATCH || 'DEMO-CAP-20260917';
const PASSWORD = process.env.DEMO_TRAINING_PASSWORD;
const PROD_DATABASE = 'trazabilidad_rrpp';

const distribution: Array<[EstadoManifiesto, number]> = [
  ['BORRADOR', 3], ['APROBADO', 4], ['EN_TRANSITO', 4], ['ENTREGADO', 4],
  ['RECIBIDO', 5], ['EN_TRATAMIENTO', 5], ['TRATADO', 8], ['RECHAZADO', 2],
  ['CANCELADO', 1],
];

const demoUsers = [
  { key: 'admin', email: 'capacitacion.admin@sitrep.invalid', role: 'ADMIN' as Rol, name: 'Administración · DEMO', cuit: '99-00000001-1' },
  { key: 'alfaGen', email: 'alfa.generador@sitrep.invalid', role: 'GENERADOR' as Rol, name: 'ALFA SERVICE — Generador · DEMO', cuit: '99-00000002-1' },
  { key: 'alfaTrans', email: 'alfa.transporte@sitrep.invalid', role: 'TRANSPORTISTA' as Rol, name: 'ALFA SERVICE — Transporte · DEMO', cuit: '99-00000003-1' },
  { key: 'alfaOp', email: 'alfa.operador@sitrep.invalid', role: 'OPERADOR' as Rol, name: 'ALFA SERVICE — Operador · DEMO', cuit: '99-00000004-1' },
  { key: 'bodega', email: 'bodega.cordillera@sitrep.invalid', role: 'GENERADOR' as Rol, name: 'Bodega Cordillera · DEMO', cuit: '99-00000005-1' },
  { key: 'metal', email: 'metalurgica.cuyo@sitrep.invalid', role: 'GENERADOR' as Rol, name: 'Metalúrgica Cuyo · DEMO', cuit: '99-00000006-1' },
  { key: 'lab', email: 'laboratorio.andino@sitrep.invalid', role: 'GENERADOR' as Rol, name: 'Laboratorio Andino · DEMO', cuit: '99-00000007-1' },
  { key: 'logistica', email: 'logistica.andina@sitrep.invalid', role: 'TRANSPORTISTA' as Rol, name: 'Logística Andina · DEMO', cuit: '99-00000008-1' },
  { key: 'eco', email: 'eco.tratamientos@sitrep.invalid', role: 'OPERADOR' as Rol, name: 'Eco Tratamientos · DEMO', cuit: '99-00000009-1' },
  { key: 'planta', email: 'planta.cuyo@sitrep.invalid', role: 'OPERADOR' as Rol, name: 'Planta Cuyo · DEMO', cuit: '99-00000010-1' },
];

function assertSafeDatabase() {
  const url = process.env.DATABASE_URL || '';
  if (!url || url.includes(`/${PROD_DATABASE}`) || !url.includes('/trazabilidad_demo')) {
    throw new Error('ABORTADO: el seed sólo puede ejecutarse sobre la base trazabilidad_demo.');
  }
  if (!PASSWORD || PASSWORD.length < 12) {
    throw new Error('DEMO_TRAINING_PASSWORD debe estar definido y tener al menos 12 caracteres.');
  }
}

const atDaysAgo = (days: number, hour = 10) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, 0, 0, 0);
  return value;
};
const plusHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

async function main() {
  assertSafeDatabase();
  const existing = await prisma.manifiesto.count({ where: { numero: { startsWith: BATCH } } });
  if (existing > 0) {
    throw new Error(`El lote ${BATCH} ya existe (${existing} manifiestos). Verifique o ejecute el rollback específico.`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD!, 12);

  await prisma.$transaction(async tx => {
    const users: Record<string, { id: string }> = {};
    for (const item of demoUsers) {
      users[item.key] = await tx.usuario.upsert({
        where: { email: item.email },
        update: {
          password: passwordHash, rol: item.role, nombre: item.name, cuit: item.cuit,
          empresa: item.name, activo: true, esDemo: false, demoExpiresAt: null,
          emailVerified: true, notifNuevoRegistro: false, notifEmail: false,
          notifWhatsapp: false, notifTelegram: false, forcePasswordChange: false,
        },
        create: {
          email: item.email, password: passwordHash, rol: item.role, nombre: item.name,
          cuit: item.cuit, empresa: item.name, telefono: '+54 261 000 0000', activo: true,
          esDemo: false, emailVerified: true, notifNuevoRegistro: false, notifEmail: false,
          notifWhatsapp: false, notifTelegram: false,
        },
        select: { id: true },
      });
    }

    const generatorDefs = [
      ['alfaGen', 'ALFA SERVICE — GENERADOR · DEMO', '99-00000002-1', 'GEN-DEMO-001', -32.8895, -68.8458],
      ['bodega', 'BODEGA CORDILLERA · DEMO', '99-00000005-1', 'GEN-DEMO-002', -33.0050, -68.8700],
      ['metal', 'METALÚRGICA CUYO · DEMO', '99-00000006-1', 'GEN-DEMO-003', -32.9300, -68.7900],
      ['lab', 'LABORATORIO ANDINO · DEMO', '99-00000007-1', 'GEN-DEMO-004', -32.8750, -68.8300],
    ] as const;
    const generators = [];
    for (const [key, name, cuit, registration, lat, lng] of generatorDefs) {
      generators.push(await tx.generador.upsert({
        where: { cuit },
        update: { razonSocial: name, usuarioId: users[key].id, activo: true },
        create: {
          usuarioId: users[key].id, razonSocial: name, cuit, domicilio: 'Domicilio sintético, Mendoza',
          telefono: '+54 261 000 0000', email: `${key}@sitrep.invalid`, numeroInscripcion: registration,
          categoria: 'Categoría demo', actividad: 'Actividad sintética para capacitación',
          corrientesControl: 'Y8/Y9/Y12', latitud: lat, longitud: lng, activo: true,
        },
      }));
    }

    const transporterDefs = [
      ['alfaTrans', 'ALFA SERVICE — TRANSPORTISTA · DEMO', '99-00000003-1', 'TRP-DEMO-001', -32.8950, -68.8500],
      ['logistica', 'LOGÍSTICA ANDINA · DEMO', '99-00000008-1', 'TRP-DEMO-002', -32.9100, -68.8200],
    ] as const;
    const transporters = [];
    for (const [key, name, cuit, permit, lat, lng] of transporterDefs) {
      const transporter = await tx.transportista.upsert({
        where: { cuit },
        update: { razonSocial: name, usuarioId: users[key].id, activo: true },
        create: {
          usuarioId: users[key].id, razonSocial: name, cuit, domicilio: 'Base sintética, Mendoza',
          telefono: '+54 261 000 0000', email: `${key}@sitrep.invalid`, numeroHabilitacion: permit,
          localidad: 'Mendoza', corrientesAutorizadas: 'Y8/Y9/Y12', latitud: lat, longitud: lng, activo: true,
        },
      });
      transporters.push(transporter);
      const vehicle = await tx.vehiculo.findFirst({ where: { transportistaId: transporter.id, patente: `DEM${transporters.length}01` } });
      if (!vehicle) await tx.vehiculo.create({ data: {
        transportistaId: transporter.id, patente: `DEM${transporters.length}01`, marca: 'Vehículo', modelo: 'Capacitación',
        anio: 2026, capacidad: 12000, numeroHabilitacion: `VH-DEMO-${transporters.length}`,
        vencimiento: atDaysAgo(-365), activo: true,
      }});
      const driver = await tx.chofer.findFirst({ where: { transportistaId: transporter.id, dni: `9900000${transporters.length}` } });
      if (!driver) await tx.chofer.create({ data: {
        transportistaId: transporter.id, nombre: 'Chofer', apellido: `Demo ${transporters.length}`,
        dni: `9900000${transporters.length}`, licencia: `LIC-DEMO-${transporters.length}`,
        vencimiento: atDaysAgo(-365), telefono: '+54 261 000 0000', activo: true,
      }});
    }

    const operatorDefs = [
      ['alfaOp', 'ALFA SERVICE — OPERADOR · DEMO', '99-00000004-1', 'OP-DEMO-001', -32.9450, -68.7800],
      ['eco', 'ECO TRATAMIENTOS · DEMO', '99-00000009-1', 'OP-DEMO-002', -33.0200, -68.9000],
      ['planta', 'PLANTA CUYO · DEMO', '99-00000010-1', 'OP-DEMO-003', -32.8600, -68.7600],
    ] as const;
    const operators = [];
    for (const [key, name, cuit, permit, lat, lng] of operatorDefs) {
      operators.push(await tx.operador.upsert({
        where: { cuit },
        update: { razonSocial: name, usuarioId: users[key].id, activo: true },
        create: {
          usuarioId: users[key].id, razonSocial: name, cuit, domicilio: 'Planta sintética, Mendoza',
          telefono: '+54 261 000 0000', email: `${key}@sitrep.invalid`, numeroHabilitacion: permit,
          categoria: 'Operador demo', tipoOperador: 'FIJO', tecnologia: 'Tratamiento sintético',
          corrientesY: 'Y8/Y9/Y12', modalidades: ['FIJO'], latitud: lat, longitud: lng, activo: true,
        },
      }));
    }

    const wasteDefs = [
      ['Y8-DEMO', 'Aceites minerales usados · DEMO', 'Líquidos', 'Inflamable'],
      ['Y9-DEMO', 'Emulsiones de aceite y agua · DEMO', 'Líquidos', 'Tóxico'],
      ['Y12-DEMO', 'Residuos de pinturas · DEMO', 'Sólidos', 'Inflamable'],
      ['Y34-DEMO', 'Soluciones ácidas · DEMO', 'Líquidos', 'Corrosivo'],
    ] as const;
    const wastes = [];
    for (const [codigo, nombre, categoria, peligrosidad] of wasteDefs) {
      wastes.push(await tx.tipoResiduo.upsert({
        where: { codigo }, update: { nombre, activo: true },
        create: { codigo, nombre, categoria, peligrosidad, descripcion: 'Catálogo sintético de capacitación', activo: true },
      }));
    }

    let index = 0;
    for (const [state, count] of distribution) {
      for (let local = 0; local < count; local += 1) {
        index += 1;
        const createdAt = atDaysAgo(29 - ((index * 7) % 30), 8 + (index % 9));
        const signedAt = state === 'BORRADOR' || state === 'CANCELADO' ? null : plusHours(createdAt, 2);
        const retiredAt = ['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(state) ? plusHours(createdAt, 8) : null;
        const deliveredAt = ['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(state) ? plusHours(createdAt, 12) : null;
        const receivedAt = ['RECIBIDO','EN_TRATAMIENTO','TRATADO'].includes(state) ? plusHours(createdAt, 14) : null;
        const closedAt = state === 'TRATADO' ? plusHours(createdAt, 30) : null;
        const generator = generators[(index - 1) % generators.length];
        const transporter = transporters[(index - 1) % transporters.length];
        const operator = operators[(index - 1) % operators.length];
        const generatorUser = demoUsers.find(u => u.cuit === generator.cuit)!;
        const transporterUser = demoUsers.find(u => u.cuit === transporter.cuit)!;
        const operatorUser = demoUsers.find(u => u.cuit === operator.cuit)!;
        const number = `${BATCH}-${String(index).padStart(3, '0')}`;
        const receivedQuantity = ['RECIBIDO','EN_TRATAMIENTO','TRATADO'].includes(state) ? 180 + index * 11 - (index % 3) : null;

        const manifest = await tx.manifiesto.create({ data: {
          numero: number, generadorId: generator.id, transportistaId: transporter.id, operadorId: operator.id,
          creadoPorId: users[generatorUser.key].id, estado: state,
          observaciones: '[DATOS SINTÉTICOS · CAPACITACIÓN] Caso controlado para prácticas; no representa una operación real.',
          fechaFirma: signedAt, fechaRetiro: retiredAt, fechaEntrega: deliveredAt,
          fechaRecepcion: receivedAt, fechaCierre: closedAt, fechaEstimadaRetiro: null,
          modalidad: 'FIJO', isDemoData: true, createdAt,
          updatedAt: closedAt || receivedAt || deliveredAt || retiredAt || signedAt || plusHours(createdAt, state === 'CANCELADO' ? 3 : 1),
          residuos: { create: [
            {
              tipoResiduoId: wastes[(index - 1) % wastes.length].id, cantidad: 180 + index * 11,
              cantidadRecibida: receivedQuantity, tipoDiferencia: receivedQuantity ? (index % 3 ? 'FALTANTE' : 'NINGUNA') : null,
              unidad: 'kg', estado: state === 'TRATADO' ? 'TRATADO' : 'DECLARADO',
              descripcion: 'Residuo sintético de capacitación', observaciones: 'DEMO', createdAt,
            },
            ...(index % 3 === 0 ? [{
              tipoResiduoId: wastes[index % wastes.length].id, cantidad: 40 + index,
              cantidadRecibida: receivedQuantity ? 40 + index : null, tipoDiferencia: receivedQuantity ? 'NINGUNA' as const : null,
              unidad: 'kg', estado: state === 'TRATADO' ? 'TRATADO' : 'DECLARADO',
              descripcion: 'Segundo residuo sintético', observaciones: 'DEMO', createdAt,
            }] : []),
          ]},
        }});

        const events: Array<{ tipo: string; descripcion: string; usuarioId: string; createdAt: Date }> = [
          { tipo: 'CREACION', descripcion: 'Manifiesto sintético creado para capacitación', usuarioId: users[generatorUser.key].id, createdAt },
        ];
        if (signedAt) events.push({ tipo: 'FIRMA', descripcion: 'Firma simulada del generador', usuarioId: users[generatorUser.key].id, createdAt: signedAt });
        if (retiredAt) events.push({ tipo: 'RETIRO', descripcion: 'Retiro simulado por transportista', usuarioId: users[transporterUser.key].id, createdAt: retiredAt });
        if (deliveredAt) events.push({ tipo: 'ENTREGA', descripcion: 'Entrega simulada en planta', usuarioId: users[transporterUser.key].id, createdAt: deliveredAt });
        if (receivedAt) events.push({ tipo: 'RECEPCION', descripcion: 'Recepción simulada por operador', usuarioId: users[operatorUser.key].id, createdAt: receivedAt });
        if (['EN_TRATAMIENTO','TRATADO'].includes(state)) events.push({ tipo: 'TRATAMIENTO', descripcion: 'Tratamiento sintético iniciado', usuarioId: users[operatorUser.key].id, createdAt: plusHours(receivedAt!, 3) });
        if (closedAt) events.push({ tipo: 'CIERRE', descripcion: 'Tratamiento sintético completado', usuarioId: users[operatorUser.key].id, createdAt: closedAt });
        if (state === 'RECHAZADO') events.push({ tipo: 'RECHAZO', descripcion: 'Rechazo simulado por incompatibilidad documental', usuarioId: users[operatorUser.key].id, createdAt: plusHours(deliveredAt!, 1) });
        if (state === 'CANCELADO') events.push({ tipo: 'CANCELACION', descripcion: 'Cancelación simulada por el generador', usuarioId: users[generatorUser.key].id, createdAt: plusHours(createdAt, 3) });
        await tx.eventoManifiesto.createMany({ data: events.map(event => ({ ...event, manifiestoId: manifest.id, isDemoData: true })) });

        if (retiredAt) {
          await tx.trackingGPS.createMany({ data: Array.from({ length: 6 }, (_, point) => ({
            manifiestoId: manifest.id, latitud: -32.89 - point * 0.008 + (index % 3) * 0.002,
            longitud: -68.84 - point * 0.006, velocidad: state === 'EN_TRANSITO' ? 35 + point * 3 : 0,
            direccion: 215, precision: 8, isDemoData: true, timestamp: plusHours(retiredAt, point * 0.35),
          })) });
        }

        await tx.auditoria.create({ data: {
          accion: state === 'TRATADO' ? 'CIERRE_DEMO' : 'ACTIVIDAD_DEMO', modulo: 'MANIFIESTOS',
          datosDespues: JSON.stringify({ batch: BATCH, numero: number, estado: state, sintetico: true }),
          ip: '127.0.0.1', userAgent: 'SITREP training seed', usuarioId: users[operatorUser.key].id,
          manifiestoId: manifest.id, generadorId: generator.id, operadorId: operator.id,
          transportistaId: transporter.id, createdAt: manifest.updatedAt,
        }});
      }
    }
  }, { timeout: 120_000 });

  console.log(JSON.stringify({ batch: BATCH, manifests: 36, emails: demoUsers.map(user => user.email) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

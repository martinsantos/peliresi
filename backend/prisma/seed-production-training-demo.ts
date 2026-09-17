/**
 * Adds a reversible synthetic training batch to the existing SITREP database.
 * It reuses existing training/Alfa actors and never changes users or credentials.
 */
import { PrismaClient, EstadoManifiesto } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH = process.env.DEMO_BATCH || 'DEMO-CAP-20260917-P';
const CONFIRM = process.env.ALLOW_PRODUCTION_TRAINING_SEED;

const distribution: Array<[EstadoManifiesto, number]> = [
  ['BORRADOR', 3], ['APROBADO', 4], ['EN_TRANSITO', 4], ['ENTREGADO', 4],
  ['RECIBIDO', 5], ['EN_TRATAMIENTO', 5], ['TRATADO', 8], ['RECHAZADO', 2],
  ['CANCELADO', 1],
];

const plusHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);
const createdDate = (index: number) => new Date(Date.now() - 2 * 3_600_000 - ((index * 7) % 30) * 86_400_000);

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('/trazabilidad_rrpp') || CONFIRM !== 'YES_ADD_REVERSIBLE_DEMO_DATA') {
    throw new Error('ABORTADO: requiere trazabilidad_rrpp y confirmación explícita ALLOW_PRODUCTION_TRAINING_SEED.');
  }
  const existing = await prisma.manifiesto.count({ where: { numero: { startsWith: BATCH } } });
  if (existing) throw new Error(`El lote ${BATCH} ya existe (${existing}).`);

  const [alfa, demoGenerator, demoTransporter, demoOperator] = await Promise.all([
    prisma.usuario.findUnique({ where: { email: 'transportista.30711235961@sitrep.local' }, include: { generador: true, transportista: true, operador: true } }),
    prisma.usuario.findUnique({ where: { email: 'quimica.mendoza@industria.com' }, include: { generador: true } }),
    prisma.usuario.findUnique({ where: { email: 'transportes.andes@logistica.com' }, include: { transportista: true } }),
    prisma.usuario.findUnique({ where: { email: 'tratamiento.residuos@planta.com' }, include: { operador: true } }),
  ]);
  if (!alfa?.generador || !alfa.transportista || !alfa.operador || !demoGenerator?.generador || !demoTransporter?.transportista || !demoOperator?.operador) {
    throw new Error('Faltan relaciones de los actores existentes requeridos; no se creó ningún dato.');
  }
  const wastes = await prisma.tipoResiduo.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' }, take: 8 });
  if (wastes.length < 2) throw new Error('Catálogo de residuos insuficiente; no se creó ningún dato.');

  const baseline = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
    pushSubscriptions: await prisma.pushSubscripcion.count(),
  };

  await prisma.$transaction(async tx => {
    let index = 0;
    for (const [state, count] of distribution) {
      for (let local = 0; local < count; local += 1) {
        index += 1;
        const createdAt = createdDate(index);
        const signedAt = ['BORRADOR', 'CANCELADO'].includes(state) ? null : plusHours(createdAt, 2);
        const retiredAt = ['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(state) ? plusHours(createdAt, 6) : null;
        const deliveredAt = ['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO'].includes(state) ? plusHours(createdAt, 10) : null;
        const receivedAt = ['RECIBIDO','EN_TRATAMIENTO','TRATADO'].includes(state) ? plusHours(createdAt, 12) : null;
        const closedAt = state === 'TRATADO' ? plusHours(createdAt, 24) : null;

        const useAlfaGenerator = index % 3 !== 0;
        const useAlfaTransporter = index % 2 !== 0;
        const useAlfaOperator = index % 3 !== 0;
        const generator = useAlfaGenerator ? alfa.generador : demoGenerator.generador;
        const transporter = useAlfaTransporter ? alfa.transportista : demoTransporter.transportista;
        const operator = useAlfaOperator ? alfa.operador : demoOperator.operador;
        const generatorUserId = useAlfaGenerator ? alfa.id : demoGenerator.id;
        const transporterUserId = useAlfaTransporter ? alfa.id : demoTransporter.id;
        const operatorUserId = useAlfaOperator ? alfa.id : demoOperator.id;
        const number = `${BATCH}${String(index).padStart(3, '0')}`;
        const quantity = 160 + index * 13;

        const manifest = await tx.manifiesto.create({ data: {
          numero: number, generadorId: generator.id, transportistaId: transporter.id,
          operadorId: operator.id, creadoPorId: generatorUserId, estado: state,
          modalidad: 'FIJO', isDemoData: true, fechaEstimadaRetiro: null,
          observaciones: '[DATOS SINTÉTICOS · CAPACITACIÓN] Lote reversible. No representa una operación real ni debe generar comunicaciones.',
          fechaFirma: signedAt, fechaRetiro: retiredAt, fechaEntrega: deliveredAt,
          fechaRecepcion: receivedAt, fechaCierre: closedAt, createdAt,
          updatedAt: closedAt || receivedAt || deliveredAt || retiredAt || signedAt || plusHours(createdAt, 1),
          residuos: { create: [{
            tipoResiduoId: wastes[(index - 1) % wastes.length].id, cantidad: quantity, unidad: 'kg',
            cantidadRecibida: receivedAt ? quantity - (index % 4) : null,
            tipoDiferencia: receivedAt ? (index % 4 ? 'FALTANTE' : 'NINGUNA') : null,
            descripcion: 'Residuo sintético para capacitación', observaciones: 'DEMO',
            estado: state === 'TRATADO' ? 'TRATADO' : 'DECLARADO', createdAt,
          }]},
        }});

        const events: Array<{ tipo: string; descripcion: string; usuarioId: string; createdAt: Date }> = [
          { tipo: 'CREACION', descripcion: 'Manifiesto sintético creado para capacitación', usuarioId: generatorUserId, createdAt },
        ];
        if (signedAt) events.push({ tipo: 'FIRMA', descripcion: 'Firma simulada del generador', usuarioId: generatorUserId, createdAt: signedAt });
        if (retiredAt) events.push({ tipo: 'RETIRO', descripcion: 'Retiro simulado por transportista', usuarioId: transporterUserId, createdAt: retiredAt });
        if (deliveredAt) events.push({ tipo: 'ENTREGA', descripcion: 'Entrega simulada en planta', usuarioId: transporterUserId, createdAt: deliveredAt });
        if (receivedAt) events.push({ tipo: 'RECEPCION', descripcion: 'Recepción simulada por operador', usuarioId: operatorUserId, createdAt: receivedAt });
        if (['EN_TRATAMIENTO','TRATADO'].includes(state)) events.push({ tipo: 'TRATAMIENTO', descripcion: 'Tratamiento sintético iniciado', usuarioId: operatorUserId, createdAt: plusHours(receivedAt!, 3) });
        if (closedAt) events.push({ tipo: 'CIERRE', descripcion: 'Tratamiento sintético completado', usuarioId: operatorUserId, createdAt: closedAt });
        if (state === 'RECHAZADO') events.push({ tipo: 'RECHAZO', descripcion: 'Rechazo sintético de capacitación', usuarioId: operatorUserId, createdAt: plusHours(deliveredAt!, 1) });
        if (state === 'CANCELADO') events.push({ tipo: 'CANCELACION', descripcion: 'Cancelación sintética de capacitación', usuarioId: generatorUserId, createdAt: plusHours(createdAt, 2) });
        await tx.eventoManifiesto.createMany({ data: events.map(event => ({ ...event, manifiestoId: manifest.id, isDemoData: true })) });

        if (retiredAt) await tx.trackingGPS.createMany({ data: Array.from({ length: 5 }, (_, point) => ({
          manifiestoId: manifest.id, latitud: -32.89 - point * 0.009, longitud: -68.84 - point * 0.006,
          velocidad: state === 'EN_TRANSITO' ? 35 + point * 4 : 0, direccion: 215, precision: 8,
          isDemoData: true, timestamp: plusHours(retiredAt, point * 0.4),
        })) });

        await tx.auditoria.create({ data: {
          accion: 'ACTIVIDAD_DEMO', modulo: 'MANIFIESTOS', usuarioId: operatorUserId,
          manifiestoId: manifest.id, generadorId: generator.id, transportistaId: transporter.id, operadorId: operator.id,
          datosDespues: JSON.stringify({ batch: BATCH, numero: number, estado: state, sintetico: true }),
          ip: '127.0.0.1', userAgent: 'SITREP production training seed', createdAt: manifest.updatedAt,
        }});
      }
    }
  }, { timeout: 120_000 });

  const after = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
    pushSubscriptions: await prisma.pushSubscripcion.count(),
  };
  if (JSON.stringify(baseline) !== JSON.stringify(after)) {
    throw new Error(`Salvaguarda fallida: comunicaciones cambiaron ${JSON.stringify({ baseline, after })}`);
  }
  console.log(JSON.stringify({ batch: BATCH, manifests: 36, communicationsUnchanged: true, baseline }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

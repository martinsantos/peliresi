/**
 * Adds one reversible TEF authorization for each demo actor used by the
 * certified production training batch. Real actors and credentials are never
 * modified, and direct Prisma writes do not invoke notification dispatchers.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CERTIFIED_BATCH = 'DEMO-CAP-20260917-P';
const BATCH = process.env.DEMO_BATCH || CERTIFIED_BATCH;
const CONFIRM = process.env.ALLOW_PRODUCTION_TRAINING_HABILITATIONS;
const DEMO_YEAR = 2026;
const RESOLUTION_MARKER = `${CERTIFIED_BATCH} · HABILITACIÓN SINTÉTICA`;
const GEDO_MARKER = `${CERTIFIED_BATCH}-TEF-${DEMO_YEAR}`;

type DemoActor = {
  type: 'GENERADOR' | 'OPERADOR';
  id: string;
  userId: string;
  name: string;
};

async function getDemoActors(): Promise<DemoActor[]> {
  const manifests = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: BATCH }, isDemoData: true },
    select: {
      generador: {
        select: { id: true, razonSocial: true, activo: true, usuario: { select: { id: true, esDemo: true } } },
      },
      operador: {
        select: { id: true, razonSocial: true, activo: true, usuario: { select: { id: true, esDemo: true } } },
      },
    },
  });

  const actors = new Map<string, DemoActor>();
  for (const manifest of manifests) {
    if (manifest.generador.activo && manifest.generador.usuario.esDemo) {
      actors.set(`GENERADOR:${manifest.generador.id}`, {
        type: 'GENERADOR',
        id: manifest.generador.id,
        userId: manifest.generador.usuario.id,
        name: manifest.generador.razonSocial,
      });
    }
    if (manifest.operador?.activo && manifest.operador.usuario.esDemo) {
      actors.set(`OPERADOR:${manifest.operador.id}`, {
        type: 'OPERADOR',
        id: manifest.operador.id,
        userId: manifest.operador.usuario.id,
        name: manifest.operador.razonSocial,
      });
    }
  }
  return [...actors.values()];
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl.includes('/trazabilidad_rrpp')) {
    throw new Error('ABORTADO: la conexión no apunta a trazabilidad_rrpp.');
  }
  if (BATCH !== CERTIFIED_BATCH || CONFIRM !== 'YES_ADD_DEMO_HABILITATIONS') {
    throw new Error('ABORTADO: lote o confirmación de habilitaciones demo inválidos.');
  }

  const batchCount = await prisma.manifiesto.count({
    where: { numero: { startsWith: BATCH }, isDemoData: true },
  });
  if (batchCount !== 36) {
    throw new Error(`ABORTADO: se esperaban 36 manifiestos demo y se encontraron ${batchCount}.`);
  }

  const actors = await getDemoActors();
  const generatorActors = actors.filter(actor => actor.type === 'GENERADOR');
  const operatorActors = actors.filter(actor => actor.type === 'OPERADOR');
  if (generatorActors.length !== 1 || operatorActors.length !== 1) {
    throw new Error(
      `ABORTADO: se esperaba 1 generador demo y 1 operador demo; se encontraron ${generatorActors.length} y ${operatorActors.length}.`,
    );
  }

  const existing = await prisma.pagoTEF.findMany({
    where: {
      anio: DEMO_YEAR,
      OR: actors.map(actor => actor.type === 'GENERADOR'
        ? { generadorId: actor.id }
        : { operadorId: actor.id }),
    },
    select: { id: true, generadorId: true, operadorId: true, resolucion: true },
  });
  if (existing.length > 0) {
    throw new Error(`ABORTADO: ${existing.length} actor(es) demo ya tienen un registro TEF ${DEMO_YEAR}; no se sobrescribió nada.`);
  }

  const notificationBaseline = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
    pushSubscriptions: await prisma.pushSubscripcion.count(),
    taggedEmails: await prisma.emailQueue.count({
      where: { OR: [{ subject: { contains: CERTIFIED_BATCH } }, { html: { contains: CERTIFIED_BATCH } }] },
    }),
    taggedNotifications: await prisma.notificacion.count({
      where: {
        OR: [
          { titulo: { contains: CERTIFIED_BATCH } },
          { mensaje: { contains: CERTIFIED_BATCH } },
          { datos: { contains: CERTIFIED_BATCH } },
        ],
      },
    }),
  };

  const paidAt = new Date('2026-09-16T12:00:00.000Z');
  const notifiedAt = new Date('2026-09-15T12:00:00.000Z');

  const created = await prisma.$transaction(async tx => {
    const rows = [];
    for (const actor of actors) {
      const row = await tx.pagoTEF.create({
        data: {
          generadorId: actor.type === 'GENERADOR' ? actor.id : null,
          operadorId: actor.type === 'OPERADOR' ? actor.id : null,
          anio: DEMO_YEAR,
          montoTEF: actor.type === 'GENERADOR' ? 52_000 : 145_000,
          resolucion: RESOLUTION_MARKER,
          notificado: true,
          fechaNotificado: notifiedAt,
          fechaPago: paidAt,
          pagoFueraTermino: false,
          habilitado: true,
          gedoResolucion: GEDO_MARKER,
          gedoNotificacion: GEDO_MARKER,
        },
      });

      await tx.auditoria.create({
        data: {
          accion: 'HABILITACION_TEF_DEMO',
          modulo: 'CAPACITACION',
          usuarioId: actor.userId,
          generadorId: actor.type === 'GENERADOR' ? actor.id : null,
          operadorId: actor.type === 'OPERADOR' ? actor.id : null,
          datosDespues: JSON.stringify({
            batch: CERTIFIED_BATCH,
            synthetic: true,
            pagoTEFId: row.id,
            actorType: actor.type,
            year: DEMO_YEAR,
            habilitado: true,
          }),
          ip: '127.0.0.1',
          userAgent: 'SITREP certified demo authorization seed',
        },
      });
      rows.push({ id: row.id, actorType: actor.type, actor: actor.name });
    }
    return rows;
  });

  const notificationAfter = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
    pushSubscriptions: await prisma.pushSubscripcion.count(),
    taggedEmails: await prisma.emailQueue.count({
      where: { OR: [{ subject: { contains: CERTIFIED_BATCH } }, { html: { contains: CERTIFIED_BATCH } }] },
    }),
    taggedNotifications: await prisma.notificacion.count({
      where: {
        OR: [
          { titulo: { contains: CERTIFIED_BATCH } },
          { mensaje: { contains: CERTIFIED_BATCH } },
          { datos: { contains: CERTIFIED_BATCH } },
        ],
      },
    }),
  };
  const communicationsUnchanged = JSON.stringify(notificationBaseline) === JSON.stringify(notificationAfter);
  if (!communicationsUnchanged) {
    throw new Error('SALVAGUARDA: los contadores de comunicaciones cambiaron durante el seed.');
  }

  console.log(JSON.stringify({
    batch: CERTIFIED_BATCH,
    year: DEMO_YEAR,
    created,
    realActorsChanged: false,
    credentialsChanged: false,
    communicationsUnchanged,
    communicationBaseline: notificationBaseline,
    communicationAfter: notificationAfter,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Promotes the two explicitly approved Mendoza accounts to the application
 * role ADMIN (shown as "Super Administrador"). Passwords and actor relations
 * are preserved. The production privileged-access allowlist is a prerequisite.
 */
import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.ALLOW_SUPERADMIN_PROMOTION;
const TARGETS: Array<{ email: string; previousRole: Rol }> = [
  { email: 'ipintos@mendoza.gov.ar', previousRole: Rol.ADMIN_GENERADOR },
  { email: 'mardengo@mendoza.gov.ar', previousRole: Rol.ADMIN_OPERADOR },
];

const normalizedAllowlist = (process.env.PRIVILEGED_ACCESS_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl.includes('/trazabilidad_rrpp')) {
    throw new Error('ABORTADO: la conexión no apunta a trazabilidad_rrpp.');
  }
  if (CONFIRM !== 'YES_PROMOTE_APPROVED_SUPERADMINS') {
    throw new Error('ABORTADO: falta la confirmación exacta de promoción.');
  }
  if (!TARGETS.every(target => normalizedAllowlist.includes(target.email))) {
    throw new Error('ABORTADO: una cuenta no pertenece a PRIVILEGED_ACCESS_EMAILS.');
  }

  const users = await prisma.usuario.findMany({
    where: { email: { in: TARGETS.map(target => target.email) } },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      esDemo: true,
      password: true,
      forcePasswordChange: true,
    },
  });
  if (users.length !== TARGETS.length) {
    throw new Error(`ABORTADO: se esperaban ${TARGETS.length} usuarios y se encontraron ${users.length}.`);
  }

  for (const target of TARGETS) {
    const user = users.find(candidate => candidate.email.toLowerCase() === target.email);
    if (!user || !user.activo || user.esDemo || user.forcePasswordChange || user.rol !== target.previousRole) {
      throw new Error(`ABORTADO: ${target.email} no conserva el estado previo esperado.`);
    }
  }

  const communicationBaseline = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
  };

  const promoted = await prisma.$transaction(async tx => {
    const result = [];
    for (const target of TARGETS) {
      const user = users.find(candidate => candidate.email.toLowerCase() === target.email)!;
      const updated = await tx.usuario.update({
        where: { id: user.id },
        data: { rol: Rol.ADMIN },
        select: { id: true, email: true, rol: true, activo: true },
      });
      await tx.auditoria.create({
        data: {
          accion: 'PROMOCION_SUPERADMIN_AUTORIZADA',
          modulo: 'USUARIOS',
          usuarioId: user.id,
          datosAntes: JSON.stringify({ email: user.email, rol: target.previousRole }),
          datosDespues: JSON.stringify({ email: user.email, rol: Rol.ADMIN, authorized: true }),
          ip: '127.0.0.1',
          userAgent: 'SITREP approved superadmin promotion',
        },
      });
      result.push(updated);
    }
    return result;
  });

  const after = await prisma.usuario.findMany({
    where: { id: { in: users.map(user => user.id) } },
    select: { id: true, email: true, rol: true, password: true },
  });
  const credentialsUnchanged = users.every(before =>
    after.some(current => current.id === before.id && current.password === before.password),
  );
  const communicationAfter = {
    emailQueue: await prisma.emailQueue.count(),
    notifications: await prisma.notificacion.count(),
  };
  const communicationsUnchanged = JSON.stringify(communicationBaseline) === JSON.stringify(communicationAfter);
  if (!credentialsUnchanged || !communicationsUnchanged) {
    throw new Error('SALVAGUARDA: cambiaron credenciales o contadores de comunicaciones.');
  }

  console.log(JSON.stringify({
    promoted,
    credentialsUnchanged,
    communicationsUnchanged,
    privilegedAllowlistVerified: true,
    serviceRestartRequired: false,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

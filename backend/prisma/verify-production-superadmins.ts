import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();
const EMAILS = ['ipintos@mendoza.gov.ar', 'mardengo@mendoza.gov.ar'];
const privileged = (process.env.PRIVILEGED_ACCESS_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  const users = await prisma.usuario.findMany({
    where: { email: { in: EMAILS } },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      esDemo: true,
      forcePasswordChange: true,
      bloqueadoHasta: true,
    },
    orderBy: { email: 'asc' },
  });
  const audits = await prisma.auditoria.count({
    where: {
      accion: 'PROMOCION_SUPERADMIN_AUTORIZADA',
      usuarioId: { in: users.map(user => user.id) },
    },
  });

  const checks = {
    exactCount: users.length === 2,
    allAdmin: users.every(user => user.rol === Rol.ADMIN),
    allActive: users.every(user => user.activo),
    noneDemo: users.every(user => !user.esDemo),
    noForcedPasswordChange: users.every(user => !user.forcePasswordChange),
    noneBlocked: users.every(user => !user.bloqueadoHasta || user.bloqueadoHasta <= new Date()),
    allPrivilegedAllowlisted: users.every(user => privileged.includes(user.email.toLowerCase())),
    exactAuditCount: audits === 2,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ users, checks, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

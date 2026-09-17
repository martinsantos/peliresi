/** Restores the two approved accounts to their exact prior sector-admin roles. */
import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.ALLOW_SUPERADMIN_PROMOTION_ROLLBACK;
const TARGETS: Array<{ email: string; previousRole: Rol }> = [
  { email: 'ipintos@mendoza.gov.ar', previousRole: Rol.ADMIN_GENERADOR },
  { email: 'mardengo@mendoza.gov.ar', previousRole: Rol.ADMIN_OPERADOR },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl.includes('/trazabilidad_rrpp')) {
    throw new Error('ABORTADO: la conexión no apunta a trazabilidad_rrpp.');
  }
  if (CONFIRM !== 'YES_RESTORE_SECTOR_ADMIN_ROLES') {
    throw new Error('ABORTADO: falta la confirmación exacta del rollback.');
  }

  const users = await prisma.usuario.findMany({
    where: { email: { in: TARGETS.map(target => target.email) } },
    select: { id: true, email: true, rol: true, activo: true, esDemo: true },
  });
  if (users.length !== 2 || users.some(user => user.rol !== Rol.ADMIN || !user.activo || user.esDemo)) {
    throw new Error('ABORTADO: las cuentas no conservan el estado ADMIN esperado.');
  }

  await prisma.$transaction(async tx => {
    for (const target of TARGETS) {
      const user = users.find(candidate => candidate.email.toLowerCase() === target.email)!;
      await tx.usuario.update({ where: { id: user.id }, data: { rol: target.previousRole } });
      await tx.auditoria.create({
        data: {
          accion: 'ROLLBACK_PROMOCION_SUPERADMIN',
          modulo: 'USUARIOS',
          usuarioId: user.id,
          datosAntes: JSON.stringify({ email: user.email, rol: Rol.ADMIN }),
          datosDespues: JSON.stringify({ email: user.email, rol: target.previousRole }),
          ip: '127.0.0.1',
          userAgent: 'SITREP approved superadmin rollback',
        },
      });
    }
  });

  console.log(JSON.stringify({ restored: TARGETS, credentialsChanged: false }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

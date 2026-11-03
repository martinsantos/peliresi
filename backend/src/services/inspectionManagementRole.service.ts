import prisma from '../lib/prisma';
/** Explicit capability, never inferred from sector administration. */
export async function hasInspectionManagementRole(userId: string): Promise<boolean> {
  if (process.env.INSPECTION_FIELD_MODEL_ENABLED !== 'true') return false;
  const rows = await prisma.$queryRaw<Array<{ activo: boolean }>>`SELECT "activo" FROM "inspection_staff_roles" WHERE "usuarioId" = ${userId} AND "role" = 'ADMIN_INSPECCIONES'`;
  return rows[0]?.activo === true;
}
export async function inspectionManagementRecipientIds(): Promise<string[]> {
  if (process.env.INSPECTION_FIELD_MODEL_ENABLED !== 'true') return [];
  const rows = await prisma.$queryRaw<Array<{ usuarioId: string }>>`SELECT r."usuarioId" FROM "inspection_staff_roles" r JOIN "usuarios" u ON u.id = r."usuarioId" WHERE r."activo" = true AND u."activo" = true`;
  return rows.map(r => r.usuarioId);
}

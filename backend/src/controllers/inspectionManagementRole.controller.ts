import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { inspectionManagementRecipientIds } from '../services/inspectionManagementRole.service';
function assertAdmin(req: AuthRequest) {
  if (req.user?.rol !== 'ADMIN' || req.user?.impersonatedBy || req.user?.restricted) throw new AppError('Sólo Super Admin puede designar jefatura de inspecciones.', 403);
  if (process.env.INSPECTION_FIELD_MODEL_ENABLED !== 'true') throw new AppError('La gestión de jefatura todavía no está habilitada.', 404);
}
export async function listInspectionManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertAdmin(req); const ids = await inspectionManagementRecipientIds();
    const users = await prisma.usuario.findMany({ where: { activo: true, OR: [{ esInspector: true }, { rol: { in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] } }] }, select: { id: true, nombre: true, apellido: true, rol: true, esInspector: true }, orderBy: { nombre: 'asc' } });
    res.json({ success: true, data: users.map(u => ({ ...u, esJefeInspecciones: ids.includes(u.id) })) });
  } catch (e) { next(e); }
}
export async function setInspectionManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertAdmin(req); const input = z.object({ usuarioId: z.string().min(1), activo: z.boolean() }).strict().parse(req.body);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "usuarios" WHERE id = ${input.usuarioId} FOR UPDATE`;
      const user = await tx.usuario.findUnique({ where: { id: input.usuarioId } });
      if (!user || !user.activo || (!user.esInspector && !String(user.rol).startsWith('ADMIN'))) throw new AppError('Elegí una cuenta activa del equipo de inspección o administración.', 400);
      const before = await tx.$queryRaw`SELECT "activo" FROM "inspection_staff_roles" WHERE "usuarioId" = ${input.usuarioId}`;
      await tx.auditoria.create({ data: { accion: 'DESIGNAR_JEFATURA_INSPECCIONES', modulo: 'inspecciones', usuarioId: req.user.id, datosAntes: JSON.stringify(before), datosDespues: JSON.stringify(input) } });
      await tx.$executeRaw`INSERT INTO "inspection_staff_roles" ("usuarioId", "role", "activo", "asignadoPorId", "updatedAt") VALUES (${input.usuarioId}, 'ADMIN_INSPECCIONES', ${input.activo}, ${req.user.id}, CURRENT_TIMESTAMP) ON CONFLICT ("usuarioId") DO UPDATE SET "activo" = EXCLUDED."activo", "asignadoPorId" = EXCLUDED."asignadoPorId", "updatedAt" = CURRENT_TIMESTAMP`;
    });
    res.json({ success: true, data: input });
  } catch (e) { next(e); }
}

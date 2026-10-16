import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

export const externalTrackingQuery = z.object({
  rol: z.enum(['generador', 'transportista']).default('generador'),
  identificacion: z.string().trim().max(500).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();

/** Reuses the existing designated-reviewer boundary, not every administrator. */
export function externalTrackingScope(user: AuthRequest['user']): string | null {
  if (user?.rol === 'OPERADOR' && user.operador?.id) return user.operador.id;
  if (user?.rol === 'ADMIN' && !user.impersonatedBy &&
    (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(Boolean).includes(user.id)) return null;
  throw new AppError('Seguimiento reservado al operador y revisor designado', 403);
}

/** Read-only declared movements. No actor merging, registration verdict or notification. */
export async function externalTracking(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const operatorId = externalTrackingScope(req.user);
    const parsed = externalTrackingQuery.safeParse(req.query);
    if (!parsed.success) throw new AppError('Filtros de seguimiento inválidos', 400);
    const { rol, identificacion, page } = parsed.data;
    const where = Prisma.sql`COALESCE(r.datos -> ${rol} ->> 'padronId', '') = ''
      ${operatorId ? Prisma.sql`AND r."operadorId" = ${operatorId}` : Prisma.empty}
      ${identificacion ? Prisma.sql`AND btrim(COALESCE(r.datos -> ${rol} ->> 'identificacion', '')) = ${identificacion}` : Prisma.empty}`;
    // Aggregate all matches, not the visible page. Repeatable-read keeps the
    // three bounded queries on one snapshot while another user records a trip.
    const result = await prisma.$transaction(async tx => {
      const [summary] = await tx.$queryRaw<Array<{ total: number; primera: Date | null; ultima: Date | null }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total, MIN(r."createdAt") AS primera, MAX(r."createdAt") AS ultima
        FROM registros_manifiesto_excepcional r WHERE ${where}`);
      const cantidades = await tx.$queryRaw<Array<{ corriente: string; unidad: string; cantidad: string }>>(Prisma.sql`
        SELECT w ->> 'corriente' AS corriente, w ->> 'unidad' AS unidad,
          SUM((w ->> 'cantidad')::numeric)::text AS cantidad
        FROM registros_manifiesto_excepcional r
        CROSS JOIN LATERAL jsonb_array_elements(r.datos -> 'residuos') w
        WHERE ${where} GROUP BY w ->> 'corriente', w ->> 'unidad'
        ORDER BY corriente, unidad`);
      const registros = await tx.$queryRaw<Array<{ id: string; createdAt: Date; etapa: string; operador: string;
        participante: Prisma.JsonValue; residuos: Prisma.JsonValue }>>(Prisma.sql`
        SELECT r.id, r."createdAt", r.etapa, COALESCE(o."razonSocial", 'Operador no disponible') AS operador,
          r.datos -> ${rol} AS participante, r.datos -> 'residuos' AS residuos
        FROM registros_manifiesto_excepcional r LEFT JOIN operadores o ON o.id = r."operadorId"
        WHERE ${where} ORDER BY r."createdAt" DESC, r.id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`);
      return { ...summary, cantidades, registros, page, pageSize: 20, rol };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

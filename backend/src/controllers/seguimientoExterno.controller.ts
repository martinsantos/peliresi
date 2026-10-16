import { NextFunction, Response } from 'express';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { csvCell } from '../domain/conciliacionExterna';

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

function trackingWhere(rol: string, identificacion: string, operatorId: string | null) {
  return Prisma.sql`COALESCE(r.datos -> ${rol} ->> 'padronId', '') = ''
    ${operatorId ? Prisma.sql`AND r."operadorId" = ${operatorId}` : Prisma.empty}
    ${identificacion ? Prisma.sql`AND btrim(COALESCE(r.datos -> ${rol} ->> 'identificacion', '')) = ${identificacion}` : Prisma.empty}`;
}

/** Read-only declared movements. Reconciled records stay present and counted exactly once. */
export async function externalTracking(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const operatorId = externalTrackingScope(req.user);
    const parsed = externalTrackingQuery.safeParse(req.query);
    if (!parsed.success) throw new AppError('Filtros de seguimiento inválidos', 400);
    const { rol, identificacion, page } = parsed.data;
    const where = trackingWhere(rol, identificacion, operatorId);
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

/** Full filtered export, bounded by waste rows; never silently truncates a page. */
export async function exportExternalTracking(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const operatorId = externalTrackingScope(req.user);
    const parsed = externalTrackingQuery.omit({ page: true }).safeParse(req.query);
    if (!parsed.success) throw new AppError('Filtros de exportación inválidos', 400);
    const { rol, identificacion } = parsed.data;
    const where = trackingWhere(rol, identificacion, operatorId);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT 'BI-' || r.id AS referencia, r."createdAt" AS fecha_utc, ${rol} AS rol,
        r.datos -> ${rol} ->> 'nombre' AS nombre_declarado,
        r.datos -> ${rol} ->> 'identificacion' AS identificacion_declarada,
        r.datos -> ${rol} ->> 'domicilio' AS domicilio_declarado,
        r.datos -> ${rol} ->> 'telefono' AS telefono_declarado,
        o."razonSocial" AS operador, r.etapa,
        w.ordinality AS renglon_original, w.item ->> 'corriente' AS corriente,
        w.item ->> 'cantidad' AS cantidad_original, w.item ->> 'unidad' AS unidad,
        COALESCE(c.accion, 'PENDIENTE') AS conciliacion, c."actorId" AS ficha_id,
        c.ficha ->> 'razonSocial' AS ficha_nombre, c.ficha ->> 'cuit' AS ficha_cuit,
        c.revision, c.motivo AS motivo_conciliacion, c."autorId" AS revisor_id, c."createdAt" AS conciliacion_utc
      FROM registros_manifiesto_excepcional r LEFT JOIN operadores o ON o.id = r."operadorId"
      CROSS JOIN LATERAL jsonb_array_elements(r.datos -> 'residuos') WITH ORDINALITY w(item, ordinality)
      LEFT JOIN LATERAL (SELECT * FROM conciliaciones_participantes_externos e
        WHERE e."registroId" = r.id AND e.rol = ${rol} ORDER BY e.revision DESC LIMIT 1) c ON true
      WHERE ${where} ORDER BY r."createdAt" DESC, r.id DESC, w.ordinality LIMIT 10001`);
    if (rows.length > 10000) throw new AppError('La exportación supera 10.000 renglones. Filtrá por identificación para descargarla completa.', 422);
    const headers = ['referencia', 'fecha_utc', 'rol', 'nombre_declarado', 'identificacion_declarada', 'domicilio_declarado',
      'telefono_declarado', 'operador', 'etapa', 'renglon_original', 'corriente', 'cantidad_original', 'unidad',
      'conciliacion', 'ficha_id', 'ficha_nombre', 'ficha_cuit', 'revision', 'motivo_conciliacion', 'revisor_id', 'conciliacion_utc'];
    const csv = [headers, ...rows.map(row => headers.map(key => row[key] instanceof Date ? (row[key] as Date).toISOString() : row[key]))]
      .map(row => row.map(csvCell).join(';')).join('\r\n');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="participantes-externos.csv"');
    const bytes = Buffer.from('\uFEFF' + csv, 'utf8');
    res.setHeader('X-Content-SHA256', createHash('sha256').update(bytes).digest('hex'));
    res.setHeader('X-Content-Bytes', String(bytes.length));
    res.type('text/csv; charset=utf-8').send(bytes);
  } catch (error) { next(error); }
}

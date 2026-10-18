import { NextFunction, Response } from 'express';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { csvCell } from '../domain/conciliacionExterna';
import { exceptionalDesignatedReviewer } from './manifiesto-excepcional.controller';

export const externalTrackingQuery = z.object({
  rol: z.enum(['generador', 'transportista', 'operador']).default('generador'),
  identificacion: z.string().trim().max(500).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();

/** Spec v2 §5: the designated reviewer reads all; the creator and registered parties only their own records. */
export function externalTrackingAccess(user: AuthRequest['user']): { reviewer: boolean; filter: Prisma.Sql | null } {
  if (exceptionalDesignatedReviewer(user)) return { reviewer: true, filter: null };
  if (user?.id && !user.restricted) {
    const own = Prisma.sql`r."creadoPorId" = ${user.id}`;
    if (user.rol === 'ADMIN') return { reviewer: false, filter: own };
    if (user.rol === 'OPERADOR' && user.operador?.id) return { reviewer: false, filter: Prisma.sql`(${own} OR r."operadorId" = ${user.operador.id})` };
    if (user.rol === 'GENERADOR' && user.generador?.id) return { reviewer: false, filter: Prisma.sql`(${own} OR r.datos -> 'generador' ->> 'padronId' = ${user.generador.id})` };
    if (user.rol === 'TRANSPORTISTA' && user.transportista?.id) return { reviewer: false, filter: Prisma.sql`(${own} OR r.datos -> 'transportista' ->> 'padronId' = ${user.transportista.id})` };
  }
  throw new AppError('Seguimiento reservado a las partes del eventual y al revisor designado', 403);
}

function trackingWhere(rol: string, identificacion: string, access: Prisma.Sql | null) {
  // Legacy rows have no datos.operador but a registered operator: external means no operadorId.
  const external = rol === 'operador' ? Prisma.sql`r."operadorId" IS NULL` : Prisma.sql`COALESCE(r.datos -> ${rol} ->> 'padronId', '') = ''`;
  return Prisma.sql`${external}
    ${access ? Prisma.sql`AND ${access}` : Prisma.empty}
    ${identificacion ? Prisma.sql`AND btrim(COALESCE(r.datos -> ${rol} ->> 'identificacion', '')) = ${identificacion}` : Prisma.empty}`;
}
const operatorName = Prisma.sql`COALESCE(o."razonSocial", NULLIF(r.datos -> 'operador' ->> 'nombre', ''), 'Operador no disponible')`;

/** Read-only declared movements. Reconciled records stay present and counted exactly once. */
export async function externalTracking(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const access = externalTrackingAccess(req.user).filter;
    const parsed = externalTrackingQuery.safeParse(req.query);
    if (!parsed.success) throw new AppError('Filtros de seguimiento inválidos', 400);
    const { rol, identificacion, page } = parsed.data;
    const where = trackingWhere(rol, identificacion, access);
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
        SELECT r.id, r."createdAt", r.etapa, ${operatorName} AS operador,
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
    const access = externalTrackingAccess(req.user).filter;
    const parsed = externalTrackingQuery.omit({ page: true }).safeParse(req.query);
    if (!parsed.success) throw new AppError('Filtros de exportación inválidos', 400);
    const { rol, identificacion } = parsed.data;
    const where = trackingWhere(rol, identificacion, access);
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT 'BI-' || r.id AS referencia, r."createdAt" AS fecha_utc, ${rol} AS rol,
        r.datos -> ${rol} ->> 'nombre' AS nombre_declarado,
        r.datos -> ${rol} ->> 'identificacion' AS identificacion_declarada,
        r.datos -> ${rol} ->> 'domicilio' AS domicilio_declarado,
        r.datos -> ${rol} ->> 'telefono' AS telefono_declarado,
        ${operatorName} AS operador, r.etapa,
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

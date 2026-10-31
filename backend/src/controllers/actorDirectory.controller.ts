import { Prisma } from '@prisma/client';
import type { NextFunction, Response } from 'express';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { directoryActorIdScope } from '../utils/roleFilter';

type ActorType = 'generador' | 'transportista' | 'operador';
type DirectoryRow = {
  id: string; razonSocial: string; cuit: string; domicilio: string;
  telefono: string; email: string; activo: boolean; tipo: ActorType;
};
const types: ActorType[] = ['generador', 'transportista', 'operador'];

function option(value: unknown, name: string, allowed: readonly string[], fallback: string): string {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new AppError(`Filtro ${name} inválido`, 400);
  return value;
}

function positiveInteger(value: unknown, name: string, fallback: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(`Filtro ${name} inválido`, 400);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new AppError(`Filtro ${name} inválido`, 400);
  return number;
}

/** A small, globally paginated directory; it never broadens the existing actor scope. */
export async function getActorDirectory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rawSearch = req.query.search;
    if (rawSearch !== undefined && (typeof rawSearch !== 'string' || rawSearch.length > 160)) {
      throw new AppError('Filtro búsqueda inválido', 400);
    }
    const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
    const type = option(req.query.tipo, 'tipo', ['todos', ...types], 'todos');
    const state = option(req.query.estado, 'estado', ['todos', 'activo', 'inactivo'], 'todos');
    const sort = option(req.query.sortBy, 'orden', ['actor', 'tipo', 'estado'], 'actor');
    const direction = option(req.query.sortOrder, 'dirección', ['asc', 'desc'], 'asc');
    const requestedPage = positiveInteger(req.query.page, 'página', 1, 1_000_000);
    const limit = positiveInteger(req.query.limit, 'límite', 20, 100);

    function scope(type: ActorType): Prisma.Sql {
      const allowed = directoryActorIdScope(req.user, type);
      if (allowed === undefined) return Prisma.sql`TRUE`;
      return typeof allowed === 'string' ? Prisma.sql`"id" = ${allowed}` : Prisma.sql`FALSE`;
    }
    const permitted = Prisma.sql`
      SELECT "id", "razonSocial", "cuit", "domicilio", "telefono", "email", "activo", 'generador'::text AS tipo
        FROM "generadores" WHERE ${scope('generador')}
      UNION ALL
      SELECT "id", "razonSocial", "cuit", "domicilio", "telefono", "email", "activo", 'transportista'::text AS tipo
        FROM "transportistas" WHERE ${scope('transportista')}
      UNION ALL
      SELECT "id", "razonSocial", "cuit", "domicilio", "telefono", "email", "activo", 'operador'::text AS tipo
        FROM "operadores" WHERE ${scope('operador')}`;
    const searchWhere = search
      ? Prisma.sql`(strpos(lower("razonSocial"), lower(${search})) > 0 OR strpos(lower("cuit"), lower(${search})) > 0)`
      : Prisma.sql`TRUE`;
    const stateWhere = state === 'todos' ? Prisma.sql`TRUE` : Prisma.sql`"activo" = ${state === 'activo'}`;
    const cte = Prisma.sql`WITH permitted AS (${permitted}), matching AS (
      SELECT * FROM permitted WHERE ${searchWhere} AND ${stateWhere}
    )`;
    const typeWhere = type === 'todos' ? Prisma.sql`TRUE` : Prisma.sql`tipo = ${type}`;
    const order = sort === 'tipo' ? Prisma.sql`tipo`
      : sort === 'estado' ? Prisma.sql`CASE WHEN "activo" THEN 0 ELSE 1 END`
      : Prisma.sql`lower("razonSocial")`;
    const orderDirection = direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;

    // The totals and rows come from the same snapshot even if a directory changes.
    const result = await prisma.$transaction(async tx => {
      const grouped = await tx.$queryRaw<Array<{ tipo: ActorType; total: number }>>(Prisma.sql`
        ${cte} SELECT tipo, count(*)::int AS total FROM matching GROUP BY tipo`);
      const counts: Record<ActorType, number> = { generador: 0, transportista: 0, operador: 0 };
      for (const group of grouped) counts[group.tipo] = group.total;
      const total = type === 'todos' ? types.reduce((sum, item) => sum + counts[item], 0) : counts[type as ActorType];
      const pages = Math.ceil(total / limit);
      const page = Math.min(requestedPage, Math.max(1, pages));
      const rows = await tx.$queryRaw<DirectoryRow[]>(Prisma.sql`
        ${cte} SELECT * FROM matching WHERE ${typeWhere}
        ORDER BY ${order} ${orderDirection}, lower("razonSocial") ASC, tipo ASC, "id" ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`);
      return { items: rows, counts, pagination: { page, limit, total, pages } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

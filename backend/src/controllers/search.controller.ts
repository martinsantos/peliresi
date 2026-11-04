import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { applyRoleFilter, directoryActorIdScope } from '../utils/roleFilter';
import { EstadoManifiesto, Prisma } from '@prisma/client';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q, estado } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.json({ success: true, data: { manifiestos: [], generadores: [], transportistas: [], operadores: [], totalHits: 0 } });
      return;
    }

    const query = q.trim();
    if (query.length > 200) throw new AppError('Usá hasta 200 caracteres para buscar', 400);
    if (estado !== undefined && (typeof estado !== 'string' || !Object.values(EstadoManifiesto).includes(estado as EstadoManifiesto))) {
      throw new AppError('Filtro de estado inválido', 400);
    }

    // Reuse the list policy, including company/site scope and missing actor denial.
    const manifiestoWhere: Prisma.ManifiestoWhereInput = {
      OR: [
        { numero: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { generador: { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { generador: { domicilio: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { transportista: { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { transportista: { localidad: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { operador: { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { operador: { domicilio: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    };

    if (estado && typeof estado === 'string') {
      manifiestoWhere.estado = estado as EstadoManifiesto;
    }

    applyRoleFilter(manifiestoWhere, req.user);

    const generadorWhere = {
      id: directoryActorIdScope(req.user, 'generador'),
      OR: [
        { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { cuit: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { domicilio: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const transportistaWhere = {
      id: directoryActorIdScope(req.user, 'transportista'),
      OR: [
        { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { cuit: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { localidad: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const operadorWhere = {
      id: directoryActorIdScope(req.user, 'operador'),
      OR: [
        { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { cuit: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { domicilio: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const [manifiestos, generadores, transportistas, operadores] = await Promise.all([
      prisma.manifiesto.findMany({
        where: manifiestoWhere,
        select: {
          id: true,
          numero: true,
          estado: true,
          createdAt: true,
          generador: { select: { razonSocial: true } },
        },
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      prisma.generador.findMany({
        where: generadorWhere,
        select: { id: true, razonSocial: true, cuit: true, categoria: true },
        take: 3,
        orderBy: [{ razonSocial: 'asc' }, { id: 'asc' }],
      }),
      prisma.transportista.findMany({
        where: transportistaWhere,
        select: { id: true, razonSocial: true, cuit: true },
        take: 3,
        orderBy: [{ razonSocial: 'asc' }, { id: 'asc' }],
      }),
      prisma.operador.findMany({
        where: operadorWhere,
        select: { id: true, razonSocial: true, cuit: true, categoria: true },
        take: 3,
        orderBy: [{ razonSocial: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const totalHits = manifiestos.length + generadores.length + transportistas.length + operadores.length;

    res.json({
      success: true,
      data: { manifiestos, generadores, transportistas, operadores, totalHits },
    });
  } catch (error) {
    next(error);
  }
};

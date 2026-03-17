import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q, estado } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.json({ success: true, data: { manifiestos: [], generadores: [], transportistas: [], operadores: [], totalHits: 0 } });
      return;
    }

    const query = q.trim();

    // Role-based filter for manifiestos (mirrors getManifiestos lines 152-158)
    const manifiestoWhere: any = {
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
      manifiestoWhere.estado = estado;
    }

    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      manifiestoWhere.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      manifiestoWhere.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      manifiestoWhere.operadorId = req.user.operador.id;
    }

    const generadorWhere = {
      OR: [
        { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { cuit: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { domicilio: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const transportistaWhere = {
      OR: [
        { razonSocial: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { cuit: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { localidad: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    };

    const operadorWhere = {
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.generador.findMany({
        where: generadorWhere,
        select: { id: true, razonSocial: true, cuit: true, categoria: true },
        take: 3,
      }),
      prisma.transportista.findMany({
        where: transportistaWhere,
        select: { id: true, razonSocial: true, cuit: true },
        take: 3,
      }),
      prisma.operador.findMany({
        where: operadorWhere,
        select: { id: true, razonSocial: true, cuit: true, categoria: true },
        take: 3,
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

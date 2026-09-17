import { Response, NextFunction } from 'express';
import { EstadoEntidadExterior, TipoEntidadExterior } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

const tipos = new Set(Object.values(TipoEntidadExterior));
const estados = new Set(Object.values(EstadoEntidadExterior));

function parseTipo(value: unknown): TipoEntidadExterior | undefined {
  if (typeof value !== 'string' || !tipos.has(value as TipoEntidadExterior)) return undefined;
  return value as TipoEntidadExterior;
}

function parseEstado(value: unknown): EstadoEntidadExterior | undefined {
  if (typeof value !== 'string' || !estados.has(value as EstadoEntidadExterior)) return undefined;
  return value as EstadoEntidadExterior;
}

export async function getEntidadesExteriores(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tipo = parseTipo(req.query.tipo);
    const requestedEstado = parseEstado(req.query.estado);
    const isAdmin = ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(req.user.rol);
    const estado = isAdmin ? requestedEstado : EstadoEntidadExterior.APROBADO;
    const entidades = await prisma.entidadExterior.findMany({
      where: { ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) },
      orderBy: [{ pais: 'asc' }, { razonSocial: 'asc' }],
    });
    res.json({ success: true, data: { entidadesExteriores: entidades } });
  } catch (error) { next(error); }
}

export async function createEntidadExterior(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tipo = parseTipo(req.body?.tipo);
    const razonSocial = String(req.body?.razonSocial || '').trim();
    const pais = String(req.body?.pais || '').trim();
    if (!tipo || !razonSocial || !pais) throw new AppError('Tipo, razón social y país son obligatorios', 400);
    const estado = parseEstado(req.body?.estado) || EstadoEntidadExterior.PENDIENTE;
    const entidad = await prisma.entidadExterior.create({
      data: {
        tipo,
        razonSocial,
        pais,
        identificacionFiscal: req.body?.identificacionFiscal?.trim() || undefined,
        domicilio: req.body?.domicilio?.trim() || undefined,
        telefono: req.body?.telefono?.trim() || undefined,
        email: req.body?.email?.trim() || undefined,
        numeroHabilitacion: req.body?.numeroHabilitacion?.trim() || undefined,
        estado,
      },
    });
    res.status(201).json({ success: true, data: { entidadExterior: entidad } });
  } catch (error) { next(error); }
}

export async function updateEntidadExterior(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.entidadExterior.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Entidad exterior no encontrada', 404);
    const tipo = req.body?.tipo === undefined ? undefined : parseTipo(req.body.tipo);
    const estado = req.body?.estado === undefined ? undefined : parseEstado(req.body.estado);
    if (req.body?.tipo !== undefined && !tipo) throw new AppError('Tipo de entidad exterior inválido', 400);
    if (req.body?.estado !== undefined && !estado) throw new AppError('Estado de entidad exterior inválido', 400);
    const entidad = await prisma.entidadExterior.update({
      where: { id: req.params.id },
      data: {
        ...(tipo ? { tipo } : {}),
        ...(req.body?.razonSocial !== undefined ? { razonSocial: String(req.body.razonSocial).trim() } : {}),
        ...(req.body?.pais !== undefined ? { pais: String(req.body.pais).trim() } : {}),
        ...(req.body?.identificacionFiscal !== undefined ? { identificacionFiscal: req.body.identificacionFiscal?.trim() || null } : {}),
        ...(req.body?.domicilio !== undefined ? { domicilio: req.body.domicilio?.trim() || null } : {}),
        ...(req.body?.telefono !== undefined ? { telefono: req.body.telefono?.trim() || null } : {}),
        ...(req.body?.email !== undefined ? { email: req.body.email?.trim() || null } : {}),
        ...(req.body?.numeroHabilitacion !== undefined ? { numeroHabilitacion: req.body.numeroHabilitacion?.trim() || null } : {}),
        ...(estado ? { estado } : {}),
      },
    });
    res.json({ success: true, data: { entidadExterior: entidad } });
  } catch (error) { next(error); }
}

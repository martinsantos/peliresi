import type { NextFunction, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { isInspectionAdministrator, isInspectionGeneralManager, isInspectionStaff } from '../domain/inspectionOperations';
import { intakeDecisionSchema, intakeScope } from '../domain/inspectionIntake';
import { assertIntakeInspection } from '../services/inspectionIntake.service';
import { canAccessInspection } from './inspeccion.controller';

export async function listInspectionIntakes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!isInspectionStaff(req.user)) throw new AppError('Acceso reservado a fiscalización', 403);
    const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page) || 1)));
    const estado = String(req.query.estado || '');
    if (estado && !['PENDIENTE', 'EN_EVALUACION', 'VINCULADA', 'DESCARTADA'].includes(estado)) throw new AppError('Estado de antecedente inválido', 400);
    const tipoActor = String(req.query.tipoActor || '');
    if (tipoActor && !['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(tipoActor)) throw new AppError('Tipo de actor inválido', 400);
    const search = String(req.query.search || '').trim().slice(0, 100);
    const where: Prisma.AntecedenteFiscalizacionWhereInput = { AND: [intakeScope(req.user),
      ...(estado ? [{ estado }] : []), ...(tipoActor ? [{ tipoActor: tipoActor as 'GENERADOR' }] : []),
      ...(search ? [{ OR: [{ referencia: { contains: search, mode: 'insensitive' as const } }, { actorNombre: { contains: search, mode: 'insensitive' as const } }] }] : []),
    ] };
    const [items, total] = await Promise.all([
      prisma.antecedenteFiscalizacion.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20,
        include: { inspeccion: { select: { id: true, numero: true, estado: true, inspectorId: true, tipoActor: true } } } }),
      prisma.antecedenteFiscalizacion.count({ where }),
    ]);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: { items: items.map(item => ({ ...item,
      inspeccion: item.inspeccion && canAccessInspection(req.user, item.inspeccion) ? item.inspeccion : null,
    })), total, page, puedeEvaluar: isInspectionAdministrator(req.user) && !req.user.impersonatedBy, puedeAbrirExterno: isInspectionGeneralManager(req.user) && !req.user.impersonatedBy } });
  } catch (error) { next(error); }
}

export async function decideInspectionIntake(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!isInspectionAdministrator(req.user) || req.user.impersonatedBy) throw new AppError('Evalúa la administración competente desde su propia sesión', 403);
    const command = intakeDecisionSchema.parse(req.body);
    const row = await prisma.$transaction(async tx => {
      const current = await tx.antecedenteFiscalizacion.findFirst({ where: { AND: [{ id: req.params.antecedenteId }, intakeScope(req.user)] } });
      if (!current) throw new AppError('Antecedente no encontrado', 404);
      const events = current.eventos as Array<{ id: string; autorId: string; version: number; accion: string; motivo: string; inspeccionId?: string }>;
      const repeated = events.find(event => event.id === command.id);
      if (repeated) {
        if (repeated.autorId !== req.user.id || repeated.version !== command.version || repeated.accion !== command.accion || repeated.motivo !== command.motivo || repeated.inspeccionId !== command.inspeccionId) throw new AppError('La decisión ya tiene otro contenido', 409);
        return current;
      }
      if (current.version !== command.version || current.estado === 'VINCULADA') throw new AppError('El antecedente cambió o ya está vinculado; actualizá la cola', 409);
      let inspection = null;
      if (command.inspeccionId) {
        inspection = await tx.inspeccion.findUnique({ where: { id: command.inspeccionId } });
        if (!inspection || !canAccessInspection(req.user, inspection)) throw new AppError('Expediente no encontrado', 404);
        assertIntakeInspection(current, inspection);
      }
      const reserved = await tx.antecedenteFiscalizacion.updateMany({ where: { id: current.id, version: command.version }, data: {
        estado: command.accion, version: { increment: 1 }, ...(inspection ? { inspeccionId: inspection.id } : {}),
        eventos: [...events, { ...command, autorId: req.user.id, fecha: new Date().toISOString() }],
      } });
      if (reserved.count !== 1) throw new AppError('Otra persona evaluó este antecedente; actualizá', 409);
      if (inspection) await tx.eventoInspeccion.create({ data: { inspeccionId: inspection.id, usuarioId: req.user.id, tipo: 'ANTECEDENTE_VINCULADO', titulo: 'Antecedente de fiscalización vinculado',
        detalle: command.motivo, visibleActor: false, metadata: { antecedenteId: current.id, origen: current.origen, origenId: current.origenId, referencia: current.referencia, huellaEvidencia: current.huellaEvidencia } } });
      return tx.antecedenteFiscalizacion.findUniqueOrThrow({ where: { id: current.id } });
    });
    res.json({ success: true, data: row });
  } catch (error) { next(error); }
}

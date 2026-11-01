import { createHash } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { canAccessManifiesto } from '../utils/roleFilter';
import { updateRollingHash } from '../services/manifestIntegrity.service';
import { domainEvents } from '../services/domainEvent.service';
import { notifyManifestOperationalEvent } from '../services/manifestOperationalNotice.service';
import { notificationService } from '../services/notification-dispatcher.service';

const incidentSchema = z.object({
  referencia: z.string().uuid('La referencia del incidente no es válida'),
  tipo: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().min(1, 'La descripción es requerida').max(1000),
  latitud: z.number().finite().min(-90).max(90).optional(),
  longitud: z.number().finite().min(-180).max(180).optional(),
}).strict().refine(value => (value.latitud === undefined) === (value.longitud === undefined),
  { message: 'La ubicación debe incluir latitud y longitud.' });

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type LockedManifest = { id: string; estado: string; generadorId: string; transportistaId: string | null;
  operadorId: string; contextoEmpresa: unknown; observaciones: string | null; isDemoData: boolean };
type Receipt = { version: number; requestHash: string; eventoId: string };

/** A separate endpoint fails closed when an older server cannot verify a retry. */
export async function registrarIncidenteIdempotente(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params, user = req.user;
    if (!user || !['TRANSPORTISTA', 'ADMIN'].includes(user.rol)) throw new AppError('Solo los transportistas pueden registrar incidentes', 403);
    const parsed = incidentSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Revisá los datos del incidente.', 400);
    const { referencia, tipo, descripcion, latitud, longitud } = parsed.data;
    const company = user.empresaContexto;
    const scope = [String(user.id), user.rol, user.transportista?.id ?? null, company?.empresaId ?? null,
      company?.actividadId ?? null, company?.establecimientoId ?? null, user.impersonatedBy?.id ?? null];
    const receiptId = 'manifest-incident-v1:' + sha([id, referencia.toLowerCase()]);
    const requestHash = sha([scope, tipo, descripcion, latitud ?? null, longitud ?? null]);
    const description = `INCIDENTE: ${tipo}. ${descripcion}`;

    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<LockedManifest[]>`
        SELECT id, estado, "generadorId", "transportistaId", "operadorId", "contextoEmpresa", observaciones, "isDemoData"
        FROM manifiestos WHERE id = ${id} FOR UPDATE
      `;
      const current = rows[0];
      if (!current || !canAccessManifiesto(user, current)) throw new AppError('Manifiesto no encontrado', 404);
      const previous = await tx.auditoria.findUnique({ where: { id: receiptId } });
      if (previous) {
        let receipt: Partial<Receipt> = {};
        try { receipt = JSON.parse(previous.datosDespues || '{}'); } catch { /* Fail closed on a damaged receipt. */ }
        if (previous.usuarioId !== user.id || previous.manifiestoId !== id || previous.modulo !== 'MANIFIESTOS'
          || previous.accion !== 'REGISTRAR_INCIDENTE_V1' || receipt.version !== 1 || receipt.requestHash !== requestHash
          || typeof receipt.eventoId !== 'string') {
          throw new AppError('La referencia corresponde a otro envío. Revisá el incidente guardado.', 409);
        }
        const event = await tx.eventoManifiesto.findUnique({ where: { id: receipt.eventoId } });
        if (!event || event.manifiestoId !== id || event.tipo !== 'INCIDENTE' || event.usuarioId !== user.id
          || event.descripcion !== description || (event.latitud ?? null) !== (latitud ?? null)
          || (event.longitud ?? null) !== (longitud ?? null)) {
          throw new AppError('No se pudo verificar el incidente anterior. Revisá el historial antes de continuar.', 409);
        }
        return { evento: event, repetido: true, notices: [] };
      }
      if (current.estado !== 'EN_TRANSITO') throw new AppError('Solo se pueden registrar incidentes en transportes activos', 400);
      const evento = await tx.eventoManifiesto.create({ data: { manifiestoId: id, tipo: 'INCIDENTE',
        descripcion: description, latitud, longitud, usuarioId: user.id, isDemoData: current.isDemoData } });
      const observaciones = `${current.observaciones || ''} [INCIDENTE: ${tipo}]`.trim();
      await tx.manifiesto.update({ where: { id }, data: { observaciones } });
      await updateRollingHash(tx, id, current.estado, new Date(), observaciones, evento.id);
      const notices = await notifyManifestOperationalEvent(tx, { tipo: 'INCIDENTE', eventoId: evento.id,
        manifiestoId: id, authorId: user.id, descripcion });
      const receipt: Receipt = { version: 1, requestHash, eventoId: evento.id };
      await tx.auditoria.create({ data: { id: receiptId, usuarioId: user.id, manifiestoId: id,
        modulo: 'MANIFIESTOS', accion: 'REGISTRAR_INCIDENTE_V1', datosDespues: JSON.stringify(receipt) } });
      return { evento, repetido: false, notices };
    });

    result.notices.forEach(notice => notificationService.programarCanalesDeNotificacion(notice));
    res.json({ success: true, data: { evento: result.evento, idempotencia: { version: 1, referencia, repetido: result.repetido } } });
    if (!result.repetido) domainEvents.emit({ type: 'INCIDENTE_REGISTRADO', manifiestoId: id,
      tipoIncidente: tipo, descripcion, userId: user.id, avisosConfirmados: true, latitud, longitud });
  } catch (error) { next(error); }
}

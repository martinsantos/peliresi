import { createHash } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { canAccessManifiesto } from '../utils/roleFilter';
import { updateRollingHash } from '../services/manifestIntegrity.service';
import { domainEvents } from '../services/domainEvent.service';
import { notifyManifestDelivery } from '../services/manifestDeliveryNotice.service';
import { notificationService } from './notification.controller';
import { invalidateGpsCache } from './manifiesto-gps.controller';

const deliverySchema = z.object({
  referencia: z.string().uuid('La referencia de la entrega no es válida'),
  observaciones: z.string().max(1000).optional(),
  latitud: z.number().finite().min(-90).max(90).optional(),
  longitud: z.number().finite().min(-180).max(180).optional(),
}).strict().refine(value => (value.latitud === undefined) === (value.longitud === undefined),
  { message: 'La ubicación debe incluir latitud y longitud.' });

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const includeActors = { generador: true, transportista: true, operador: true } as const;
type LockedManifest = { id: string; estado: string; modalidad: string | null; fechaEntrega: Date | null;
  generadorId: string; transportistaId: string | null; operadorId: string; contextoEmpresa: unknown; isDemoData: boolean };
type Receipt = { version: number; requestHash: string; fechaEntrega: string; eventoId: string };

/** A new endpoint fails closed against old servers which do not understand references. */
export async function confirmarEntregaIdempotente(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params, user = req.user;
    if (!user || !['TRANSPORTISTA', 'ADMIN'].includes(user.rol)) throw new AppError('Solo los transportistas pueden confirmar entregas', 403);
    const parsed = deliverySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Revisá los datos de la entrega.', 400);
    const { referencia, latitud, longitud, observaciones } = parsed.data;
    const company = user.empresaContexto;
    const scope = [user.rol, user.transportista?.id ?? null, company?.empresaId ?? null,
      company?.actividadId ?? null, company?.establecimientoId ?? null, user.impersonatedBy?.id ?? null];
    const receiptId = 'manifest-delivery-v1:' + sha([id, String(user.id), referencia.toLowerCase()]);
    const requestHash = sha([scope, latitud ?? null, longitud ?? null, observaciones ?? null]);

    const result = await prisma.$transaction(async tx => {
      // Serialize with deliveries, reversions, and GPS writes, and check the
      // current authorization again inside the same transaction.
      const rows = await tx.$queryRaw<LockedManifest[]>`
        SELECT id, estado, modalidad, "fechaEntrega", "generadorId", "transportistaId", "operadorId", "contextoEmpresa", "isDemoData"
        FROM manifiestos WHERE id = ${id} FOR UPDATE
      `;
      const current = rows[0];
      if (!current || !canAccessManifiesto(user, current)) throw new AppError('Manifiesto no encontrado', 404);
      const previous = await tx.auditoria.findUnique({ where: { id: receiptId } });
      if (previous) {
        let receipt: Partial<Receipt> = {};
        try { receipt = JSON.parse(previous.datosDespues || '{}'); } catch { /* A damaged receipt is never accepted. */ }
        if (previous.usuarioId !== user.id || previous.manifiestoId !== id || previous.modulo !== 'MANIFIESTOS'
          || previous.accion !== 'CONFIRMAR_ENTREGA_V1' || receipt.version !== 1 || receipt.requestHash !== requestHash
          || typeof receipt.fechaEntrega !== 'string' || typeof receipt.eventoId !== 'string') {
          throw new AppError('La referencia de esta entrega corresponde a otros datos. Revisá el envío guardado.', 409);
        }
        // A reverted delivery is a historical receipt, not permission to
        // silently apply an old command again in a later trip.
        if (!current.fechaEntrega || current.fechaEntrega.toISOString() !== receipt.fechaEntrega
          || ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO'].includes(current.estado)) {
          throw new AppError('La entrega anterior fue modificada. Revisá el estado del manifiesto antes de continuar.', 409);
        }
        const event = await tx.eventoManifiesto.findUnique({ where: { id: receipt.eventoId },
          select: { manifiestoId: true, tipo: true, usuarioId: true, descripcion: true, latitud: true, longitud: true } });
        if (!event || event.manifiestoId !== id || event.tipo !== 'ENTREGA' || event.usuarioId !== user.id
          || event.descripcion !== (observaciones || 'Carga entregada en planta de tratamiento')
          || (event.latitud ?? null) !== (latitud ?? null) || (event.longitud ?? null) !== (longitud ?? null)) {
          throw new AppError('No se pudo verificar el registro de la entrega. Revisá el manifiesto antes de continuar.', 409);
        }
        const manifiesto = await tx.manifiesto.findUnique({ where: { id }, include: includeActors });
        if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
        return { manifiesto, repetido: true, notices: [] };
      }
      if (current.modalidad === 'IN_SITU') throw new AppError('Los manifiestos in situ no requieren entrega por transportista', 400);
      if (current.estado !== 'EN_TRANSITO') throw new AppError('El manifiesto debe estar en transito', 400);
      const fechaEntrega = new Date();
      const manifiesto = await tx.manifiesto.update({ where: { id }, data: { estado: 'ENTREGADO', fechaEntrega }, include: includeActors });
      const evento = await tx.eventoManifiesto.create({ data: { manifiestoId: id, tipo: 'ENTREGA',
        descripcion: observaciones || 'Carga entregada en planta de tratamiento', latitud, longitud,
        usuarioId: user.id, isDemoData: current.isDemoData } });
      await tx.tramoTransporte.updateMany({ where: { manifiestoId: id, fin: null },
        data: { fin: fechaEntrega, accesoVersion: null, accesoHasta: null } });
      await updateRollingHash(tx, id, 'ENTREGADO', fechaEntrega, manifiesto.observaciones, evento.id);
      const notices = await notifyManifestDelivery(tx, manifiesto, evento.id, user.id);
      const receipt: Receipt = { version: 1, requestHash, fechaEntrega: fechaEntrega.toISOString(), eventoId: evento.id };
      await tx.auditoria.create({ data: { id: receiptId, usuarioId: user.id, manifiestoId: id,
        modulo: 'MANIFIESTOS', accion: 'CONFIRMAR_ENTREGA_V1', datosDespues: JSON.stringify(receipt) } });
      return { manifiesto, repetido: false, notices };
    });

    invalidateGpsCache(id);
    result.notices.forEach(notice => notificationService.programarCanalesDeNotificacion(notice));
    res.json({ success: true, data: { manifiesto: result.manifiesto,
      idempotencia: { version: 1, referencia, repetido: result.repetido } } });
    if (!result.repetido) domainEvents.emit({ type: 'MANIFIESTO_ESTADO_CAMBIADO', manifiestoId: result.manifiesto.id,
      estadoAnterior: 'EN_TRANSITO', estadoNuevo: 'ENTREGADO', numero: result.manifiesto.numero, userId: user.id, avisosConfirmados: true });
  } catch (error) { next(error); }
}

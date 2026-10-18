import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { isActorActivity } from '../domain/actorActivities';

/** Authenticated additional application. Reuses identity, never credentials or approval. */
export async function startActorActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (process.env.ACTOR_MULTIROLE_ENABLED !== 'true') throw new AppError('Alta multirol no habilitada', 404);
    const type = req.body?.tipoActor;
    if (!isActorActivity(type)) throw new AppError('Actividad inválida', 400);
    if (!req.user || req.user.impersonatedBy || !isActorActivity(req.user.rol)
      || (!req.user.activo && req.user.motivoInactividad !== 'PENDIENTE_APROBACION')) {
      throw new AppError('Ingresá con tu cuenta verificada para solicitar otra actividad', 403);
    }
    const application = await prisma.$transaction(async tx => {
      // Serializes retries and competing requests for this identity, not all applications.
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${req.user.id} FOR UPDATE`;
      const account = await tx.usuario.findUniqueOrThrow({ where: { id: req.user.id },
        include: { generador: true, transportista: true, operador: true } });
      if ((!account.activo && account.motivoInactividad !== 'PENDIENTE_APROBACION')
        || !account.emailVerified || !isActorActivity(account.rol)) throw new AppError('Se requiere cuenta no suspendida con correo verificado', 403);
      const key = type.toLowerCase() as 'generador' | 'transportista' | 'operador';
      if (account[key]) throw new AppError('La cuenta ya tiene una ficha para esta actividad', 409);
      const existing = await tx.solicitudInscripcion.findFirst({
        where: { usuarioId: account.id, tipoActor: type, estado: { in: ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA', 'APROBADA'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;
      return tx.solicitudInscripcion.create({ data: {
        usuarioId: account.id, tipoActor: type, estado: 'BORRADOR',
        datosActor: JSON.stringify({ nombre: account.nombre, razonSocial: account.empresa || account.nombre,
          cuit: account.cuit || '', telefono: account.telefono || '', emailContacto: account.email }),
      } });
    });
    res.status(201).json({ success: true, data: { solicitud: application } });
  } catch (error) { next(error); }
}

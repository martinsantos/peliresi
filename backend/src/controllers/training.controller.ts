import { NextFunction, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { inOperationalSession, inTrainingSession, isTrainingSession } from '../lib/trainingScope';
import { getUsuarios } from './admin.controller';
import { generateTokens } from './auth.controller';

function requireTrainingEntry(req: AuthRequest) {
  if (req.user?.rol !== 'ADMIN' || req.user?.impersonatedBy || isTrainingSession()) {
    throw new AppError('Ingresá desde tu cuenta administradora para practicar', 403);
  }
  if (!process.env.TRAINING_DATABASE_URL) throw new AppError('Las cuentas de capacitación todavía no están habilitadas', 503);
}

export async function getTrainingUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    requireTrainingEntry(req);
    // The training connection cannot query public. IDs only carry a UI namespace;
    // the namespace never authorizes access without the administrator session.
    const wrapped = Object.create(res) as Response;
    wrapped.json = ((body: any) => res.json({ ...body, data: { ...body.data, usuarios: body.data.usuarios.map((u: any) => ({ ...u, id: 'training:' + u.id })) } })) as Response['json'];
    await inTrainingSession(() => getUsuarios(req, wrapped, next));
  } catch (error) { next(error); }
}

export async function impersonateTrainingUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    requireTrainingEntry(req);
    const operator = req.user;
    const targetId = String(req.params.userId);
    const result = await inTrainingSession(async () => {
      const user = await prisma.usuario.findUnique({ where: { id: targetId }, include: { generador: true, transportista: true, operador: true } });
      if (!user?.activo || !user.email.endsWith('@capacitacion.invalid')) throw new AppError('Cuenta de capacitación no disponible', 404);
      // FK placeholder for support/audit. No password or personal data is copied
      // from production; this inactive placeholder cannot log in.
      const supervisorEmail = 'supervisor-' + operator.id + '@capacitacion.invalid';
      const supervisor = await prisma.usuario.upsert({ where: { id: operator.id }, update: {},
        create: { id: operator.id, email: supervisorEmail,
          password: randomBytes(48).toString('hex'), rol: 'ADMIN', nombre: 'Supervisor de capacitación',
          activo: false, emailVerified: false, notifEmail: false, notifNuevoRegistro: false } });
      if (supervisor.activo || supervisor.email !== supervisorEmail) throw new AppError('Conflicto de identidad de capacitación; no se inició la sesión', 409);
      const tokens = generateTokens(user.id, false, undefined, operator.id);
      return { user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, training: true }, tokens };
    });
    // Unlike legacy impersonation, failure to record the entry is blocking.
    await inOperationalSession(() => prisma.auditoria.create({ data: {
      usuarioId: operator.id, accion: 'CAPACITACION_INICIO', modulo: 'AUTH',
      datosDespues: JSON.stringify({ trainingUserId: targetId }), ip: req.ip,
    } }));
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { inTrainingSession, TRAINING_REALM } from '../lib/trainingScope';
import { AppError } from './errorHandler';

// Training is opt-in and fail-closed. A missing configuration never routes a
// signed school token into production. The JWT is verified again by auth.
export function trainingSession(req: Request, res: Response, next: NextFunction) {
  const token = req.path === '/api/auth/refresh-token' && typeof req.body?.refreshToken === 'string' ? req.body.refreshToken
    : req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  if (!token) return next();
  let claim: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET as string);
    if (typeof decoded === 'string') return next();
    claim = decoded;
  } catch { return next(); } // Existing route authentication handles invalid tokens.
  if (claim.realm === undefined) return next();
  if (claim.realm !== TRAINING_REALM) return next(new AppError('Ámbito de sesión inválido', 401));
  if (!process.env.TRAINING_DATABASE_URL || typeof claim.impersonatedBy !== 'string') {
    return next(new AppError('Capacitación no habilitada. Volvé a tu cuenta administradora.', 403));
  }
  // No irreversible documents, delivery settings, job invocation or public
  // account creation through training. These capabilities need dedicated QA
  // before they can be enabled in school mode.
  let path: string;
  try { path = decodeURIComponent(req.path); } catch { return next(new AppError('Ruta inválida', 400)); }
  const allowed = /^\/api\/(?:auth\/(?:profile|logout|refresh-token)|manifiestos|catalogos|actores|reportes|analytics|centro-control|inspecciones|soporte|notificaciones|search)(?:\/|$)/;
  if (!allowed.test(path) || /\.pdf(?:\/|$)/i.test(path) || /(?:\/pdf|\/certificado|\/blockchain|\/verificar|\/email|\/push)(?:\/|$)/.test(path)) {
    return next(new AppError('Esta función no está habilitada en capacitación; no se modificaron datos reales.', 403));
  }
  res.setHeader('X-SITREP-Training', 'true');
  res.setHeader('Cache-Control', 'no-store');
  return inTrainingSession(next);
}

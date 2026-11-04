import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';
import { isTrainingSession, TRAINING_REALM } from './trainingScope';

// Explicit classroom aliases, never operational accounts or client-selected roles.
export const TRAINING_LOGINS = [
  { email: 'admin@capacitacion.invalid', id: 'cap-20261012-admin-1', rol: 'ADMIN' },
  { email: 'generador@capacitacion.invalid', id: 'cap-20261012-generador-1', rol: 'GENERADOR' },
  { email: 'transporte@capacitacion.invalid', id: 'cap-20261012-transportista-1', rol: 'TRANSPORTISTA' },
  { email: 'operador@capacitacion.invalid', id: 'cap-20261012-operador-1', rol: 'OPERADOR' },
] as const;

export const isTrainingLoginEmail = (email?: string): boolean =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith('@capacitacion.invalid');

export function trainingLoginDeadline(): number {
  const raw = process.env.TRAINING_DIRECT_LOGIN_UNTIL;
  const deadline = raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw) ? Date.parse(raw) : NaN;
  if (!process.env.TRAINING_DATABASE_URL || !Number.isFinite(deadline) || deadline <= Date.now()) {
    throw new AppError('El acceso directo de capacitación no está habilitado o ya terminó.', 403);
  }
  return Math.floor(deadline / 1000);
}

/** Accept only already signature-verified claims; no fallback to public. */
export function validateDirectTrainingClaim(claim: jwt.JwtPayload): void {
  trainingLoginDeadline();
  if (claim.realm !== TRAINING_REALM || claim.trainingDirect !== true || claim.impersonatedBy !== undefined
    || claim.restricted || claim.registrationDraft || !TRAINING_LOGINS.some(account => account.id === claim.id)) {
    throw new AppError('Sesión de capacitación inválida', 401);
  }
}

export function generateDirectTrainingTokens(userId: string) {
  if (!isTrainingSession()) throw new AppError('Ámbito de capacitación requerido', 403);
  const claim = { id: userId, realm: TRAINING_REALM, trainingDirect: true };
  validateDirectTrainingClaim(claim);
  const remaining = trainingLoginDeadline() - Math.floor(Date.now() / 1000);
  if (remaining <= 0) throw new AppError('La capacitación terminó', 403);
  return {
    accessToken: jwt.sign(claim, config.JWT_SECRET as string, { expiresIn: Math.min(1800, remaining) }),
    refreshToken: jwt.sign(claim, config.JWT_SECRET as string, { expiresIn: remaining }),
  };
}

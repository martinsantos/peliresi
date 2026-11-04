import { createHash } from 'node:crypto';
import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { AdmissionStore } from '../services/apiAdmission.service';
import { admissionCounter, networkAdmissionIdentity } from './apiAdmission';

function identityKey(req: Request): string {
  const cuit = typeof req.body?.cuit === 'string' ? req.body.cuit.replace(/\D/g, '') : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const identity = cuit ? 'cuit:' + cuit : email ? 'email:' + email : '';
  // Limit a repeated identity even when the source IP changes. Never retain
  // cleartext email/CUIT in the store; malformed requests fall back to the IP.
  return identity ? createHash('sha256').update(identity).digest('hex') : 'ip:' + ipKeyGenerator(req.ip || 'unknown');
}

export function createAuthenticationLimiters(store?: AdmissionStore) {
  if (store) {
    return {
      login: [
        admissionCounter(store, { namespace: 'auth:network', limit: 100, identity: networkAdmissionIdentity, skipSuccessfulRequests: true,
          message: 'Demasiados intentos de autenticación desde esta red, intente de nuevo en un minuto' }),
        admissionCounter(store, { namespace: 'auth:identity', limit: 5, identity: identityKey, skipSuccessfulRequests: true,
          message: 'Demasiados intentos de autenticación para esta cuenta, intente de nuevo en un minuto' }),
      ],
      registration: admissionCounter(store, { namespace: 'auth:registration', limit: 5, identity: networkAdmissionIdentity,
        message: 'Demasiados intentos de autenticación, intente de nuevo en un minuto' }),
    };
  }
  // In-memory adapter retained only for isolated middleware fixtures. The server
  // explicitly supplies the shared PostgreSQL store above.

  const network = rateLimit({
    windowMs: 60_000,
    max: 100,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos de autenticación desde esta red, intente de nuevo en un minuto' },
  });
  const identity = rateLimit({
    windowMs: 60_000,
    max: 5,
    keyGenerator: identityKey,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos de autenticación para esta cuenta, intente de nuevo en un minuto' },
  });
  const registration = rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos de autenticación, intente de nuevo en un minuto' },
  });
  return { login: [network, identity], registration };
}

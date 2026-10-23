import type { Request, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { isTrainingSession, TRAINING_REALM } from '../lib/trainingScope';
import { validateDirectTrainingClaim } from '../lib/trainingDirectLogin';
import type { AdmissionStore } from '../services/apiAdmission.service';
import logger from '../utils/logger';

export type AdmissionFamily = 'reads' | 'gps' | 'writes' | 'documents';
export const API_ADMISSION_WINDOW_MS = 60_000;
// Preserve the existing 600/min budget independently for each signed-in human
// and work family. Values require workload calibration before further changes.
export const API_ADMISSION_LIMIT = 600;

export function admissionFamily(req: Pick<Request, 'method' | 'originalUrl'>): AdmissionFamily {
  let path = req.originalUrl.split('?')[0];
  try { path = decodeURIComponent(path).toLowerCase().replace(/\/+$/, ''); } catch { /* route validation handles malformed paths */ }
  if (req.method === 'POST' && /^\/api\/(?:manifiestos|seguimiento-relevo)\/[^/]+\/ubicacion$/.test(path)) return 'gps';
  if (/^\/api\/pdf(?:\/|$)/.test(path) || /(?:\/pdf|\.pdf)$/.test(path)
    || /^\/api\/manifiestos\/[^/]+\/(?:certificados|documentos-cap)\/[^/]+\/archivo$/.test(path)) return 'documents';
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'reads' : 'writes';
}

export function networkAdmissionIdentity(req: Pick<Request, 'ip'>): string {
  return 'ip:' + ipKeyGenerator(req.ip || 'unknown');
}

/** Signed claims identify only whose quota to charge. Every protected route
 * STILL runs isAuthenticated, checks active account, scope and permissions.
 * No jwt.decode, client-selected header or request body can choose an identity.
 */
export function verifiedAdmissionIdentity(req: Pick<Request, 'headers'>): string | undefined {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return undefined;
  try {
    // Access tokens are signed with HS256 in auth.controller/trainingDirectLogin.
    const claim = jwt.verify(authorization.slice(7), config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof claim === 'string' || claim.purpose !== undefined || typeof claim.id !== 'string' || !claim.id
      || typeof claim.exp !== 'number' || !Number.isFinite(claim.exp)) return undefined;
    if (claim.realm !== undefined && (!isTrainingSession() || claim.realm !== TRAINING_REALM)) return undefined;
    if (claim.trainingDirect !== undefined) validateDirectTrainingClaim(claim);
    if (claim.impersonatedBy !== undefined && (typeof claim.impersonatedBy !== 'string' || !claim.impersonatedBy)) return undefined;
    return JSON.stringify([claim.realm || 'operational', claim.impersonatedBy || claim.id]);
  } catch { return undefined; }
}

interface CounterOptions {
  namespace: string;
  limit: number;
  windowMs?: number;
  identity: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  message?: string;
}

export function admissionCounter(store: AdmissionStore, options: CounterOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const receipt = await store.consume(options.namespace, options.identity(req), options.windowMs ?? API_ADMISSION_WINDOW_MS);
      res.setHeader('RateLimit-Limit', String(options.limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, options.limit - receipt.hits)));
      res.setHeader('RateLimit-Reset', String(receipt.retryAfterSeconds));
      if (receipt.hits > options.limit) {
        res.setHeader('Retry-After', String(receipt.retryAfterSeconds));
        return void res.status(429).json({ success: false, code: 'RATE_LIMITED', retryAfterSeconds: receipt.retryAfterSeconds,
          message: options.message || 'Alcanzaste el límite temporal de solicitudes. Esperá un momento y volvé a intentar.' });
      }
      if (options.skipSuccessfulRequests) {
        res.once('finish', () => {
          if (res.statusCode < 400) void store.release(receipt).catch(() => logger.warn('Could not release successful authentication quota'));
        });
      }
      next();
    } catch {
      // Never silently use a per-process counter or bypass admission if the
      // shared store fails. No DB details or credentials leak in the response.
      logger.error('Shared admission store unavailable');
      res.setHeader('Retry-After', '5');
      res.status(503).json({ success: false, code: 'ADMISSION_UNAVAILABLE', retryAfterSeconds: 5,
        message: 'No pudimos comprobar la disponibilidad. Esperá unos segundos y volvé a intentar.' });
    }
  };
}

export function createApiAdmission(store: AdmissionStore, options: { windowMs?: number; limit?: number } = {}): RequestHandler {
  const limit = options.limit ?? API_ADMISSION_LIMIT;
  // Liveness must not depend on the database, otherwise a DB outage triggers
  // process restart loops. This public, constant response keeps a local IP cap;
  // it is not a fail-open fallback for any authenticated/business operation.
  const liveness = rateLimit({ windowMs: options.windowMs ?? API_ADMISSION_WINDOW_MS, limit,
    standardHeaders: true, legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message: 'Demasiadas solicitudes de estado. Intentá de nuevo en un momento.' },
  });
  const anonymous = admissionCounter(store, { namespace: 'api:anonymous', limit, windowMs: options.windowMs, identity: networkAdmissionIdentity });
  // Resolve the signed identity once, before handing off to async counters.
  const identities = new WeakMap<Request, string>();
  const families = Object.fromEntries((['reads', 'gps', 'writes', 'documents'] as const).map(family => [family,
    admissionCounter(store, { namespace: `api:person:${family}`, limit, windowMs: options.windowMs,
      identity: req => identities.get(req)! })])) as Record<AdmissionFamily, RequestHandler>;
  return (req, res, next) => {
    if (['GET','HEAD'].includes(req.method) && /^\/api\/health\/live\/?(?:\?|$)/i.test(req.originalUrl)) return liveness(req, res, next);
    // Public authentication cannot evade the IP budget by attaching a token.
    const isPublicAuthentication = /^\/api\/auth\/(?:login|register)(?:[/?]|$)/i.test(req.originalUrl);
    const identity = isPublicAuthentication ? undefined : verifiedAdmissionIdentity(req);
    if (!identity) return anonymous(req, res, next);
    identities.set(req, identity);
    return families[admissionFamily(req)](req, res, next);
  };
}

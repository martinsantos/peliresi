import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { normalizeAuthRateLimitEmail } from '../utils/rateLimitKey';

export function buildAuthRateLimitKey(req: Pick<Request, 'ip' | 'body'>): string {
  // Keep the ipKeyGenerator call visible in this keyGenerator path. Besides
  // normalizing IPv6 subnets, express-rate-limit validates this at startup.
  return `${ipKeyGenerator(req.ip || '0.0.0.0')}:${normalizeAuthRateLimitEmail(req.body?.email)}`;
}

export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    // Government traffic arrives through a shared VPN/load-balancer address.
    // Successful logins must not consume the failure budget for other trainees.
    skipSuccessfulRequests: true,
    keyGenerator: buildAuthRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Demasiados intentos de autenticación, intente de nuevo en un minuto',
    },
  });
}

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config';
import { AppError } from './errorHandler';

/**
 * Cloudflare Turnstile captcha verification middleware.
 *
 * Skips verification if TURNSTILE_SECRET_KEY is not configured
 * (dev/local friendly). When configured, validates the captcha token
 * from `req.body.captchaToken` against Cloudflare's siteverify endpoint.
 */
export const verifyCaptcha = async (req: Request, _res: Response, next: NextFunction) => {
  // Skip if captcha not configured (dev/local friendly)
  if (!config.TURNSTILE_SECRET_KEY) return next();

  const token = req.body.captchaToken;
  if (!token) {
    return next(new AppError('Token de verificación requerido', 400));
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: config.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: req.ip,
      }),
    });

    const data = await response.json() as { success: boolean; [key: string]: unknown };
    if (!data.success) {
      return next(new AppError('Token de verificación inválido', 400));
    }

    next();
  } catch {
    return next(new AppError('Error al verificar el token de seguridad', 500));
  }
};

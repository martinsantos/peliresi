import { Request, Response, NextFunction } from 'express';

/** Strip HTML tags and dangerous patterns from a single string value. */
function sanitizeString(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/javascript\s*:/gi, '')   // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')        // Remove event handlers (onerror=, onload=, etc.)
    .replace(/<>\//g, '');             // Remove stray angle brackets used in XSS
}

/** Recursively sanitize all string values in an object or array. */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * XSS sanitization middleware.
 *
 * Recursively strips HTML tags, event handlers, and javascript: protocol
 * from all string values in req.body. Operates in-place to preserve
 * the request structure for downstream validation.
 *
 * Does NOT sanitize req.params or req.query (typically route IDs/identifiers).
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
};

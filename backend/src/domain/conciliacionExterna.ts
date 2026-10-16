import { z } from 'zod';

/** Formatting only; no fuzzy matching, repair of check digits or invented CUIT. */
export function verifiedCuit(value: string): string | null {
  const text = value.trim();
  if (!/^(?:\d{11}|\d{2}-\d{8}-\d)$/.test(text)) return null;
  const digits = text.replace(/-/g, '');
  if (!/^(20|23|24|27|30|33|34)/.test(digits)) return null;
  const sum = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((total, weight, i) => total + weight * Number(digits[i]), 0);
  const check = (11 - sum % 11) % 11;
  return check < 10 && check === Number(digits[10]) ? digits : null;
}
export const reconciliationCommand = z.object({
  id: z.string().uuid(), revision: z.number().int().nonnegative(),
  rol: z.enum(['generador', 'transportista']), accion: z.enum(['VINCULAR', 'DESVINCULAR']),
  actorId: z.string().min(1).max(100).optional(), motivo: z.string().trim().min(1).max(500),
}).strict().refine(c => (c.accion === 'VINCULAR') === Boolean(c.actorId), 'El vínculo requiere una ficha; la desvinculación no');
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

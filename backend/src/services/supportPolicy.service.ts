import { createHash } from 'crypto';
import { z } from 'zod';

export const SUPPORT_STATES = ['ABIERTO', 'EN_CURSO', 'ESPERANDO_USUARIO', 'CERRADO'] as const;
export const SUPPORT_CATEGORIES = ['GENERAL', 'SESION', 'MANIFIESTOS', 'INSPECCIONES', 'GPS', 'QR', 'DOCUMENTOS', 'INTERFAZ'] as const;
export const SUPPORT_TYPES = ['PROBLEMA', 'CONSULTA', 'MEJORA'] as const;
export const SUPPORT_PRIORITIES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const;
export const supportCreateInput = z.object({
  asunto: z.string().trim().min(5).max(180),
  descripcion: z.string().trim().min(10).max(8000),
  categoria: z.enum(SUPPORT_CATEGORIES).default('GENERAL'),
  contexto: z.unknown().optional(),
}).strict();
export const supportMutationInput = z.object({
  accion: z.enum(['RESPONDER', 'NOTA', 'TOMAR', 'DERIVAR', 'ESPERAR', 'CERRAR', 'REABRIR', 'CLASIFICAR']),
  version: z.coerce.number().int().positive(),
  cuerpo: z.string().trim().max(8000).default(''),
  responsableId: z.string().trim().min(1).max(100).optional(),
  categoria: z.enum(SUPPORT_CATEGORIES).optional(),
  tipo: z.enum(SUPPORT_TYPES).optional(),
  prioridad: z.enum(SUPPORT_PRIORITIES).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.accion !== 'TOMAR' && input.cuerpo.length < 5) ctx.addIssue({ code: 'custom', message: 'Explicá el motivo o escribí un mensaje (mínimo 5 caracteres)', path: ['cuerpo'] });
  if (input.accion === 'DERIVAR' && !input.responsableId) ctx.addIssue({ code: 'custom', message: 'Elegí un responsable', path: ['responsableId'] });
  if (input.accion !== 'DERIVAR' && input.responsableId) ctx.addIssue({ code: 'custom', message: 'Esta acción no permite cambiar el responsable', path: ['responsableId'] });
  if (input.accion === 'CLASIFICAR' && (!input.categoria || !input.tipo || !input.prioridad)) ctx.addIssue({ code: 'custom', message: 'Elegí área, tipo y prioridad para clasificar', path: ['tipo'] });
  if (input.accion !== 'CLASIFICAR' && (input.categoria || input.tipo || input.prioridad)) ctx.addIssue({ code: 'custom', message: 'Usá Clasificar para cambiar el triaje', path: ['accion'] });
});

export function supportCanManage(user: { rol?: string; activo?: boolean; restricted?: boolean } | undefined, enabled: boolean): boolean {
  return Boolean(user && user.activo !== false && !user.restricted && (user.rol === 'ADMIN' || enabled));
}

export function supportContext(raw: unknown): { ruta: string | null; ancho?: number; alto?: number; online?: boolean } {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const path = typeof input.ruta === 'string' ? input.ruta.split(/[?#]/)[0] : '';
  const safe = /^\/(?!\/)[a-zA-Z0-9/_-]{0,300}$/.test(path) && !/\/(?:reset-password|verificar-email|reclamar)(?:\/|$)/.test(path);
  const result: ReturnType<typeof supportContext> = { ruta: safe ? path : null };
  for (const dimension of ['ancho', 'alto'] as const) {
    const value = input[dimension];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10000) result[dimension] = value;
  }
  if (typeof input.online === 'boolean') result.online = input.online;
  return result;
}

export function supportFingerprint(body: unknown, files: Array<{ nombre: string; sha256: string }>): string {
  return createHash('sha256').update(JSON.stringify({ body, files })).digest('hex');
}

export function supportNumber(number: number): string { return 'SOP-' + String(number).padStart(6, '0'); }

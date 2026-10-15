import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';

const text = z.string().trim().min(1).max(500);
export const wasteSchema = z.object({
  corriente: z.string().trim().regex(/^Y\d{1,3}$/, 'Indicar corriente Y'),
  cantidad: z.number().finite().positive().max(1e12),
  unidad: z.enum(['kg', 'l', 't', 'm3']),
}).strict();
const participant = z.object({
  nombre: text, identificacion: text, domicilio: text,
}).strict();
export const exceptionalCreateSchema = z.object({
  id: z.string().uuid(), generador: participant, transportista: participant,
  patente: z.string().trim().min(1).max(20), motivo: text,
  residuos: z.array(wasteSchema).min(1).max(50),
}).strict();
export const exceptionalEventSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative(),
  tipo: z.enum(['AVANCE', 'DIFERENCIA', 'SOLICITAR_REVISION', 'RESOLVER']),
  nota: z.string().trim().max(500).default(''),
  etapa: z.enum(['RETIRADO', 'RECIBIDO', 'TRATADO']).optional(),
  residuos: z.array(wasteSchema).min(1).max(50).optional(),
  objetivo: z.string().uuid().optional(),
  decision: z.enum(['APROBADA', 'OBSERVADA', 'RECHAZADA']).optional(),
}).strict().superRefine((command, ctx) => {
  if (command.tipo !== 'AVANCE' && !command.nota) ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Indicá el motivo de la diferencia o revisión' });
  const fields: Record<string, string[]> = {
    AVANCE: ['etapa'], DIFERENCIA: ['residuos'],
    SOLICITAR_REVISION: ['objetivo'], RESOLVER: ['objetivo', 'decision'],
  };
  for (const key of ['etapa', 'residuos', 'objetivo', 'decision'] as const) {
    const required = fields[command.tipo].includes(key);
    if (required !== (command[key] !== undefined)) ctx.addIssue({
      code: 'custom', path: [key], message: required ? 'Dato requerido para esta acción' : 'Dato no permitido para esta acción',
    });
  }
});
export type ExceptionalInput = z.infer<typeof exceptionalCreateSchema>;
export type ExceptionalCommand = z.infer<typeof exceptionalEventSchema>;
export type ExceptionalEvent = ExceptionalCommand & { autorId: string; impersonadoPorId?: string; fecha: string };
export type ExceptionalStage = 'REGISTRADO' | 'RETIRADO' | 'RECIBIDO' | 'TRATADO';
export function exceptionalPending(id: string, events: ExceptionalEvent[]) {
  return [id, ...events.filter(e => e.tipo === 'DIFERENCIA').map(e => e.id)].map(objetivo => {
    const resolutions = events.filter(e => e.tipo === 'RESOLVER' && e.objetivo === objetivo);
    const last = resolutions[resolutions.length - 1];
    return { objetivo, estado: last?.decision || 'PENDIENTE',
      solicitada: events.some(e => e.tipo === 'SOLICITAR_REVISION' && e.objetivo === objetivo) };
  });
}
export function advanceExceptional(id: string, stage: ExceptionalStage, events: ExceptionalEvent[],
  command: ExceptionalCommand, canReview: boolean): ExceptionalStage {
  if (command.tipo === 'AVANCE') {
    const next: Record<ExceptionalStage, string | undefined> = {
      REGISTRADO: 'RETIRADO', RETIRADO: 'RECIBIDO', RECIBIDO: 'TRATADO', TRATADO: undefined,
    };
    if (!command.etapa || next[stage] !== command.etapa) throw new AppError('Etapa desactualizada; recargá el registro', 409);
    return command.etapa; // Operational fact never implies approval.
  }
  if (command.tipo === 'DIFERENCIA') {
    if (!command.residuos) throw new AppError('Indicá la carga observada', 400);
    return stage; // Full observed snapshot, never added blindly to original quantities.
  }
  const pending = exceptionalPending(id, events).find(p => p.objetivo === command.objetivo);
  if (!pending) throw new AppError('La revisión debe corresponder al original o a una diferencia registrada', 400);
  if (command.tipo === 'RESOLVER') {
    if (!canReview) throw new AppError('Se requiere un revisor designado distinto del autor', 403);
    if (!pending.solicitada || !command.decision) throw new AppError('Solicitá revisión antes de resolver', 400);
  }
  return stage;
}

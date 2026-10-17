import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';

const text = z.string().trim().min(1).max(500);
export const wasteSchema = z.object({
  corriente: z.string().trim().regex(/^Y\d{1,3}$/, 'Indicar corriente Y'),
  cantidad: z.number().finite().positive().max(1e12),
  unidad: z.enum(['kg', 'l', 't', 'm3']),
}).strict();
const participant = z.object({
  nombre: z.string().trim().max(500).default(''),
  identificacion: z.string().trim().max(500).default(''),
  domicilio: z.string().trim().max(500).default(''),
  nombreFantasia: z.string().trim().max(500).optional(),
  telefono: z.string().trim().max(100).optional(),
  padronId: z.string().trim().min(1).max(100).optional(),
}).strict();
// Slots are optional without defaults: legacy-shaped bodies keep the same request fingerprint.
export const exceptionalCreateSchema = z.object({
  id: z.string().uuid(), generador: participant.optional(), transportista: participant.optional(), operador: participant.optional(),
  patente: z.string().trim().max(20).default(''), motivo: text,
  residuos: z.array(wasteSchema).min(1).max(50),
}).strict().refine(value => !value.generador?.padronId || !value.transportista?.padronId || (value.operador !== undefined && !value.operador.padronId), {
  message: 'Un eventual requiere al menos un participante sin alta',
});
export const exceptionalEventSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative(),
  tipo: z.enum(['AVANCE', 'DIFERENCIA', 'SOLICITAR_REVISION', 'RESOLVER', 'APROBAR_PARTE', 'RECHAZAR_PARTE']),
  parte: z.enum(['creador', 'generador', 'transportista', 'operador']).optional(),
  nota: z.string().trim().max(500).default(''),
  etapa: z.enum(['RETIRADO', 'RECIBIDO', 'TRATADO']).optional(),
  residuos: z.array(wasteSchema).min(1).max(50).optional(),
  objetivo: z.string().uuid().optional(),
  decision: z.enum(['APROBADA', 'OBSERVADA', 'RECHAZADA']).optional(),
}).strict().superRefine((command, ctx) => {
  if (command.tipo !== 'AVANCE' && command.tipo !== 'APROBAR_PARTE' && !command.nota) ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Indicá el motivo de la diferencia o revisión' });
  const fields: Record<string, string[]> = {
    AVANCE: ['etapa'], DIFERENCIA: ['residuos'],
    SOLICITAR_REVISION: ['objetivo'], RESOLVER: ['objetivo', 'decision'],
    APROBAR_PARTE: ['parte'], RECHAZAR_PARTE: ['parte'],
  };
  for (const key of ['etapa', 'residuos', 'objetivo', 'decision', 'parte'] as const) {
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
export type ExceptionalSlot = 'generador' | 'transportista' | 'operador';
export const EXCEPTIONAL_SLOTS: ExceptionalSlot[] = ['generador', 'transportista', 'operador'];
type PartyRole = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
export type ExceptionalCreator = { rol: 'ADMIN' } | { rol: PartyRole; parte: ExceptionalSlot; actorId: string };
export type ExceptionalApprover = { parte: 'creador' | ExceptionalSlot; rol: 'ADMIN' | PartyRole; usuarioId?: string; actorId?: string };
type Declared = z.infer<typeof participant> | { padronId: string };
export type ExceptionalUser = {
  id: string; rol: string; restricted?: boolean; impersonatedBy?: unknown;
  generador?: { id: string } | null; transportista?: { id: string } | null; operador?: { id: string } | null;
};
const slotOf: Record<string, ExceptionalSlot> = { GENERADOR: 'generador', TRANSPORTISTA: 'transportista', OPERADOR: 'operador' };

/** Spec v2 §1: the three parties with a linked record, or ADMIN in its own session. */
export function exceptionalCreator(user: ExceptionalUser): ExceptionalCreator {
  if (user.restricted) throw new AppError('Tu sesión no puede iniciar eventuales', 403);
  if (user.rol === 'ADMIN') {
    if (user.impersonatedBy) throw new AppError('Un eventual no se inicia desde una sesión suplantada de administración', 403);
    return { rol: 'ADMIN' };
  }
  const parte = slotOf[user.rol];
  const actorId = parte && user[parte]?.id;
  if (!parte || !actorId) throw new AppError('Inician eventuales el generador, transportista u operador con ficha, o un administrador', 403);
  return { rol: user.rol as PartyRole, parte, actorId };
}
/** The creator's own slot comes from the session; at least one slot stays without padrón. */
export function planExceptionalSlots(creator: ExceptionalCreator, input: ExceptionalInput): Record<ExceptionalSlot, Declared> {
  const slots = {} as Record<ExceptionalSlot, Declared>;
  for (const slot of EXCEPTIONAL_SLOTS) slots[slot] = input[slot] || { nombre: '', identificacion: '', domicilio: '' };
  if (creator.rol !== 'ADMIN') {
    const declared = input[creator.parte];
    if (declared?.padronId && declared.padronId !== creator.actorId) throw new AppError('Tu lugar en el eventual corresponde a tu propia ficha', 400);
    slots[creator.parte] = { padronId: creator.actorId };
  }
  if (EXCEPTIONAL_SLOTS.every(slot => slots[slot].padronId)) throw new AppError('Un eventual requiere al menos un participante sin alta. Usá el manifiesto ordinario.', 400);
  return slots;
}
/** Fixed at creation: the creator plus each padrón slot whose account is active, never the own slot twice. */
export function exceptionalApprovers(creator: ExceptionalCreator, creadoPorId: string, slots: Record<ExceptionalSlot, { padronId?: string }>,
  activeAccount: Partial<Record<ExceptionalSlot, boolean>>): ExceptionalApprover[] {
  const list: ExceptionalApprover[] = [creator.rol === 'ADMIN' ? { parte: 'creador', rol: 'ADMIN', usuarioId: creadoPorId }
    : { parte: 'creador', rol: creator.rol, usuarioId: creadoPorId, actorId: creator.actorId }];
  for (const slot of EXCEPTIONAL_SLOTS) {
    const actorId = slots[slot].padronId;
    if (!actorId || !activeAccount[slot] || (creator.rol !== 'ADMIN' && creator.parte === slot)) continue;
    list.push({ parte: slot, rol: slot.toUpperCase() as PartyRole, actorId });
  }
  return list;
}
/** Own session only: no impersonation, restricted token or approval on behalf of another company or role. */
export function exceptionalCanApprove(user: ExceptionalUser, approver: ExceptionalApprover): boolean {
  if (user.restricted || user.impersonatedBy || user.rol !== approver.rol) return false;
  if (approver.usuarioId && user.id !== approver.usuarioId) return false;
  if (approver.actorId && user[slotOf[approver.rol]]?.id !== approver.actorId) return false;
  return true;
}
export function exceptionalApproval(approvers: ExceptionalApprover[] | undefined, events: ExceptionalEvent[]) {
  if (!approvers) return { estado: 'NO_REQUIERE' as const, partes: [] };
  const partes = approvers.map(approver => {
    const decision = events.find(e => (e.tipo === 'APROBAR_PARTE' || e.tipo === 'RECHAZAR_PARTE') && e.parte === approver.parte);
    return { ...approver, estado: !decision ? 'PENDIENTE' as const : decision.tipo === 'APROBAR_PARTE' ? 'APROBADA' as const : 'RECHAZADA' as const,
      ...(decision ? { autorId: decision.autorId, fecha: decision.fecha } : {}) };
  });
  const estado = partes.some(p => p.estado === 'RECHAZADA') ? 'RECHAZADO' as const
    : partes.every(p => p.estado === 'APROBADA') ? 'APROBADO' as const : 'PENDIENTE' as const;
  return { estado, partes };
}
/** Facts: the creator and every registered party of this record. Impersonation stays audited as before. */
export function exceptionalCanRegister(user: ExceptionalUser, record: { creadoPorId: string; autorRol?: string | null; operadorId?: string | null; datos?: unknown }): boolean {
  if (user.restricted) return false;
  if (record.autorRol === 'ADMIN' && user.rol === 'ADMIN' && user.id === record.creadoPorId) return true;
  const data = (record.datos || {}) as Partial<Record<ExceptionalSlot, { padronId?: string }>>;
  const parte = slotOf[user.rol], own = parte && user[parte]?.id;
  if (!own) return false;
  return parte === 'operador' ? record.operadorId === own : data[parte]?.padronId === own;
}
export function advanceExceptional(id: string, stage: ExceptionalStage, events: ExceptionalEvent[],
  command: ExceptionalCommand, canReview: boolean,
  options: { aprobaciones?: ExceptionalApprover[]; puedeAprobar?: string[] } = {}): ExceptionalStage {
  const approval = exceptionalApproval(options.aprobaciones, events);
  if (command.tipo === 'APROBAR_PARTE' || command.tipo === 'RECHAZAR_PARTE') {
    if (approval.estado === 'NO_REQUIERE') throw new AppError('Este registro no requiere aprobación de partes', 400);
    const parte = approval.partes.find(p => p.parte === command.parte);
    if (!parte) throw new AppError('Esa parte no aprueba este eventual', 400);
    if (!(options.puedeAprobar || []).includes(parte.parte)) throw new AppError('Sólo esa parte, con su propia sesión, decide sobre su lugar', 403);
    if (parte.estado !== 'PENDIENTE') throw new AppError('Esa parte ya decidió sobre este eventual', 409);
    if (approval.estado === 'RECHAZADO') throw new AppError('El eventual fue rechazado por una parte; se conserva como antecedente', 409);
    return stage;
  }
  if (command.tipo !== 'RESOLVER' && approval.estado === 'RECHAZADO') throw new AppError('El eventual fue rechazado por una parte; se conserva como antecedente y no avanza', 409);
  if (command.tipo !== 'RESOLVER' && approval.estado === 'PENDIENTE') throw new AppError('Faltan aprobaciones de las partes para avanzar', 409);
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

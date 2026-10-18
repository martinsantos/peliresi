import { z } from 'zod';
import { wasteSchema } from './manifiestoExcepcional';

export const addendumCreateSchema = z.object({
  id: z.string().uuid(), motivo: z.string().trim().min(1).max(500),
  residuos: z.array(wasteSchema).min(1).max(50),
  rectificaId: z.string().uuid().optional(),
}).strict();
export const addendumReviewSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative(),
  nota: z.string().trim().min(1).max(500), decision: z.enum(['APROBADA', 'OBSERVADA', 'RECHAZADA']),
}).strict();
export type AddendumReview = z.infer<typeof addendumReviewSchema> & {
  autorId: string; impersonadoPorId?: string; fecha: string;
};
export function addendumStageAllowed(stage: string) {
  return ['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(stage);
}
export function canRecordAddendum(user: { rol: string; transportista?: { id: string } | null; operador?: { id: string } | null },
  manifest: { transportistaId?: string | null; operadorId: string }) {
  return (user.rol === 'TRANSPORTISTA' && !!user.transportista && user.transportista.id === manifest.transportistaId)
    || (user.rol === 'OPERADOR' && !!user.operador && user.operador.id === manifest.operadorId);
}

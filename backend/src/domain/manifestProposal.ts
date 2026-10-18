import { AppError } from '../middlewares/errorHandler';
import { isTrainingSession } from '../lib/trainingScope';

export const MANIFEST_PROPOSAL = 'PROPUESTA_PARTES_V1';
export const APPROVAL_EVENTS = { GENERADOR: 'FIRMA', TRANSPORTISTA: 'APROBACION_TRANSPORTISTA', OPERADOR: 'APROBACION_OPERADOR' } as const;
export type ProposalRole = keyof typeof APPROVAL_EVENTS;
type Identity = { id: string; rol: string; restricted?: boolean; generador?: { id: string } | null; transportista?: { id: string } | null; operador?: { id: string } | null };
export type Proposal = { version: 1; generadorId: string; transportistaId: string; operadorId: string; creadoPorId: string; autorRol: string };
export function canCreateManifestProposal(user: Identity) {
  return isTrainingSession() && !user.restricted && (user.rol === 'ADMIN' || (user.rol === 'GENERADOR' && !!user.generador?.id) || (user.rol === 'TRANSPORTISTA' && !!user.transportista?.id) || (user.rol === 'OPERADOR' && !!user.operador?.id));
}
export function proposalRole(user: Identity, proposal: Proposal): ProposalRole | null {
  if (user.restricted) return null;
  if (user.rol === 'GENERADOR' && user.generador?.id === proposal.generadorId) return 'GENERADOR';
  if (user.rol === 'TRANSPORTISTA' && user.transportista?.id === proposal.transportistaId) return 'TRANSPORTISTA';
  if (user.rol === 'OPERADOR' && user.operador?.id === proposal.operadorId) return 'OPERADOR';
  return null;
}
export function parseProposal(description: string): Proposal {
  let p: Proposal;
  try { p = JSON.parse(description); } catch { throw new AppError('Propuesta inválida; no se puede aprobar', 409); }
  if (!p || !['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR'].includes(p.autorRol) || p.version !== 1 || ![p.generadorId,p.transportistaId,p.operadorId,p.creadoPorId].every(v => typeof v === 'string' && v.length > 0)) throw new AppError('Propuesta inválida; no se puede aprobar', 409);
  return p;
}

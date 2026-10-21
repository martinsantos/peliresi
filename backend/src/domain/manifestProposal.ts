import { AppError } from '../middlewares/errorHandler';
import { isTrainingSession } from '../lib/trainingScope';

export const MANIFEST_PROPOSAL = 'PROPUESTA_PARTES_V1';
export const APPROVAL_EVENTS = { GENERADOR: 'FIRMA', TRANSPORTISTA: 'APROBACION_TRANSPORTISTA', OPERADOR: 'APROBACION_OPERADOR' } as const;
export type ProposalRole = keyof typeof APPROVAL_EVENTS;
type Identity = { id: string; rol: string; restricted?: boolean; impersonatedBy?: unknown; generador?: { id: string; activo?: boolean } | null; transportista?: { id: string; activo?: boolean } | null; operador?: { id: string; activo?: boolean } | null };
export type Proposal = { version: 1; generadorId: string; transportistaId: string; operadorId: string; creadoPorId: string; autorRol: string };
export const COORDINATION_EVENTS = ['INICIO_COORDINACION', 'INICIO_COORDINACION_CAP'];
export function manifestProposalsEnabled() {
  return isTrainingSession() || process.env.MANIFEST_PROPOSALS_ENABLED === 'true';
}
export function canCreateManifestProposal(user: Identity) {
  return manifestProposalsEnabled() && !user.restricted && !user.impersonatedBy && (user.rol === 'ADMIN' || (user.rol === 'GENERADOR' && !!user.generador?.id && user.generador.activo !== false) || (user.rol === 'TRANSPORTISTA' && !!user.transportista?.id && user.transportista.activo !== false) || (user.rol === 'OPERADOR' && !!user.operador?.id && user.operador.activo !== false));
}
export function proposalRole(user: Identity, proposal: Proposal): ProposalRole | null {
  if (user.restricted || user.impersonatedBy) return null;
  if (user.rol === 'GENERADOR' && user.generador?.id === proposal.generadorId && user.generador.activo !== false) return 'GENERADOR';
  if (user.rol === 'TRANSPORTISTA' && user.transportista?.id === proposal.transportistaId && user.transportista.activo !== false) return 'TRANSPORTISTA';
  if (user.rol === 'OPERADOR' && user.operador?.id === proposal.operadorId && user.operador.activo !== false) return 'OPERADOR';
  return null;
}
export function parseProposal(description: string): Proposal {
  let p: Proposal;
  try { p = JSON.parse(description); } catch { throw new AppError('Propuesta inválida; no se puede aprobar', 409); }
  if (!p || !['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR'].includes(p.autorRol) || p.version !== 1 || ![p.generadorId,p.transportistaId,p.operadorId,p.creadoPorId].every(v => typeof v === 'string' && v.length > 0)) throw new AppError('Propuesta inválida; no se puede aprobar', 409);
  return p;
}

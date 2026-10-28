import { AppError } from '../middlewares/errorHandler';
import { isTrainingSession } from '../lib/trainingScope';

export const MANIFEST_PROPOSAL = 'PROPUESTA_PARTES_V1';
export const APPROVAL_EVENTS = { GENERADOR: 'FIRMA', TRANSPORTISTA: 'APROBACION_TRANSPORTISTA', OPERADOR: 'APROBACION_OPERADOR' } as const;
export type ProposalRole = keyof typeof APPROVAL_EVENTS;
type Identity = { id: string; rol: string; restricted?: boolean; impersonatedBy?: unknown; generador?: { id: string; activo?: boolean } | null; transportista?: { id: string; activo?: boolean } | null; operador?: { id: string; activo?: boolean } | null };
export type Proposal = { version: 1 | 2; generadorId: string; transportistaId: string | null; operadorId: string; creadoPorId: string; autorRol: string; modalidad?: 'FIJO' | 'IN_SITU' };
/** Old snapshots omit modalidad and still require all three original parties. */
export function proposalRoles(proposal: Proposal): ProposalRole[] {
  return proposal.modalidad === 'IN_SITU' && proposal.version === 1 && !proposal.transportistaId
    ? ['GENERADOR', 'OPERADOR'] : ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
}
/** Earlier in-situ agreements did not identify a carrier and cannot acquire a
 * third signature without changing the immutable proposal. */
export function legacyInSituWithoutCarrier(proposal: Proposal): boolean {
  return proposal.version === 1 && proposal.modalidad === 'IN_SITU' && !proposal.transportistaId;
}
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
  if (!p || !['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR'].includes(p.autorRol) || ![1,2].includes(p.version) || ![p.generadorId,p.operadorId,p.creadoPorId].every(v => typeof v === 'string' && v.length > 0)) throw new AppError('Propuesta inválida; no se puede aprobar', 409);
  const validMode = p.modalidad === 'IN_SITU'
    ? (p.version === 1 ? p.transportistaId === null && p.autorRol !== 'TRANSPORTISTA' : typeof p.transportistaId === 'string' && p.transportistaId.length > 0)
    : (p.modalidad === undefined || p.modalidad === 'FIJO') && typeof p.transportistaId === 'string' && p.transportistaId.length > 0;
  if (!validMode) throw new AppError('La modalidad y las partes de la propuesta no coinciden', 409);
  return p;
}

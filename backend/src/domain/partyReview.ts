/** A linked counterpart can record a response, never impersonate unanimity. */
export type ReviewIdentity = {
  id: string; rol: string; restricted?: boolean; impersonatedBy?: unknown;
  generador?: { id: string } | null;
  transportista?: { id: string } | null;
  operador?: { id: string } | null;
};
export type ReviewParties = { generadorId?: string | null; transportistaId?: string | null; operadorId?: string | null };
export function canReviewAsCounterpart(user: ReviewIdentity, author: { creadoPorId: string; impersonadoPorId?: unknown }, parties: ReviewParties): boolean {
  if (user.restricted || user.impersonatedBy || user.id === author.creadoPorId || user.id === author.impersonadoPorId) return false;
  return (user.rol === 'GENERADOR' && !!user.generador?.id && user.generador.id === parties.generadorId)
    || (user.rol === 'TRANSPORTISTA' && !!user.transportista?.id && user.transportista.id === parties.transportistaId)
    || (user.rol === 'OPERADOR' && !!user.operador?.id && user.operador.id === parties.operadorId);
}

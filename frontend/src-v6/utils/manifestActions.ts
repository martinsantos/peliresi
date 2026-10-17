// Mirrors DELETE /api/manifiestos/:id: hasRole('GENERADOR', 'ADMIN') and only BORRADOR/CANCELADO.
// The server still decides; this only avoids offering a delete it will always reject.
const DELETE_ROLES = new Set(['GENERADOR', 'ADMIN']);
const DELETE_STATES = new Set(['BORRADOR', 'CANCELADO']);

export function canOfferManifestDelete(rol: string | undefined, estado: string): boolean {
  return DELETE_ROLES.has(rol || '') && DELETE_STATES.has(estado);
}

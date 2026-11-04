// Mirrors DELETE /api/manifiestos/:id: hasRole('GENERADOR', 'ADMIN') and only BORRADOR/CANCELADO.
// The server still decides; this only avoids offering a delete it will always reject.
const MANIFEST_WRITE_ROLES = new Set(['GENERADOR', 'ADMIN']);
const DELETE_STATES = new Set(['BORRADOR', 'CANCELADO']);

// These are presentation guards for the existing create/update permissions.
// Operational proposals require their own build flag; the server checks the actor.
export function canOfferManifestCreate(rol: string | undefined, training = false): boolean {
  return MANIFEST_WRITE_ROLES.has(rol || '') || ((training || import.meta.env.VITE_MANIFEST_PROPOSALS_ENABLED === 'true') && (rol === 'TRANSPORTISTA' || rol === 'OPERADOR'));
}

export function canOfferManifestEdit(rol: string | undefined, estado: string): boolean {
  return MANIFEST_WRITE_ROLES.has(rol || '') && estado === 'BORRADOR';
}

export function canOfferManifestDelete(rol: string | undefined, estado: string): boolean {
  return MANIFEST_WRITE_ROLES.has(rol || '') && DELETE_STATES.has(estado);
}

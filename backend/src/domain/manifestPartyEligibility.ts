/** Public guidance for selecting parties. This never changes an actor or account. */
export type ManifestPartyField = 'generador' | 'transportista' | 'operador';
type Actor = { razonSocial?: string; activo?: boolean; usuario?: { activo: boolean } | null };
export function manifestPartyEligibility(actor: Actor | null | undefined, field: ManifestPartyField) {
  const role = { generador: 'Generador', transportista: 'Transporte', operador: 'Operador' }[field];
  const subject = actor?.razonSocial ? `${role} «${actor.razonSocial}»` : role;
  const motivo = !actor ? 'ACTOR_NO_ENCONTRADO' : actor.activo === false ? 'ACTOR_INACTIVO'
    : !actor.usuario ? 'SIN_CUENTA' : !actor.usuario.activo ? 'CUENTA_INACTIVA' : null;
  const guidance = {
    ACTOR_NO_ENCONTRADO: 'no se encuentra en el padrón actual. Actualizá los estados y elegí un actor registrado.',
    ACTOR_INACTIVO: 'el actor está inactivo. Administración debe revisar su habilitación o debés elegir otro actor activo.',
    SIN_CUENTA: 'no tiene una cuenta de acceso vinculada. Administración debe vincular una cuenta activa para que pueda aprobar.',
    CUENTA_INACTIVA: 'su cuenta de acceso está inactiva. Administración debe revisar y reactivar la cuenta para que pueda aprobar.',
  };
  return { habilitada: motivo === null, motivo, mensaje: motivo ? `${subject}: ${guidance[motivo]}` : null };
}

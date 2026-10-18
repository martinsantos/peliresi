export const ACTOR_ACTIVITIES = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const;
export type ActorActivity = typeof ACTOR_ACTIVITIES[number];
export function isActorActivity(value: unknown): value is ActorActivity {
  return typeof value === 'string' && (ACTOR_ACTIVITIES as readonly string[]).includes(value);
}
type Account = { rol: string; generador?: { id: string } | null; transportista?: { id: string } | null; operador?: { id: string } | null };
type Approval = { tipoActor: string; generadorId?: string | null; transportistaId?: string | null; operadorId?: string | null };
/** Associations alone never grant another activity: require its approved registration. */
export function approvedActivities(account: Account, approvals: Approval[]): ActorActivity[] {
  return ACTOR_ACTIVITIES.filter(role => {
    const key = role.toLowerCase() as 'generador' | 'transportista' | 'operador';
    const actor = account[key];
    return !!actor && (account.rol === role || approvals.some(a => a.tipoActor === role && a[(key + 'Id') as keyof Approval] === actor.id));
  });
}

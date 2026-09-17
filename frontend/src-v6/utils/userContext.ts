type ActorRelation = { id?: string; razonSocial?: string } | null | undefined;

interface UserActorContext {
  rol: string;
  generador?: ActorRelation;
  transportista?: ActorRelation;
  operador?: ActorRelation;
}

export function actorForEffectiveRole(user: UserActorContext): ActorRelation {
  if (user.rol === 'GENERADOR') return user.generador;
  if (user.rol === 'TRANSPORTISTA') return user.transportista;
  if (user.rol === 'OPERADOR') return user.operador;
  return user.generador || user.transportista || user.operador;
}

export function actorIdForEffectiveRole(user: UserActorContext): string | undefined {
  return actorForEffectiveRole(user)?.id;
}

function principalSegment(userId: string | number): string {
  return encodeURIComponent(String(userId));
}

export function userStorageKey(userId: string | number, key: string): string {
  return `sitrep_user_${principalSegment(userId)}_${key}`;
}

export const activeTripStorageKey = (userId: string | number) => userStorageKey(userId, 'active_trip_id');
export const tripSnapshotStorageKey = (userId: string | number, manifestId: string) => userStorageKey(userId, `trip_${manifestId}_snapshot`);
export const tripStatusStorageKey = (userId: string | number, manifestId: string) => userStorageKey(userId, `trip_${manifestId}_status`);
export const gpsPendingStorageKey = (userId: string | number, manifestId: string) => userStorageKey(userId, `trip_${manifestId}_gps_pending`);
export const recentSearchesStorageKey = (userId: string | number) => userStorageKey(userId, 'recent_searches');
export const pendingQrStorageKey = (userId: string | number) => userStorageKey(userId, 'pending_qr');

export function clearUserScopedStorage(userId: string | number): void {
  const prefix = `sitrep_user_${principalSegment(userId)}_`;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

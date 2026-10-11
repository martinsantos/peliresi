/** Narrows the UI only, never grants access. A protected response must still
 * validate the session before rendering any user's information. */
export function restrictedSessionHint(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).restricted === true;
  } catch { return false; }
}

/** A routing hint ONLY. The server must verify this token on the owned draft. */
export function registrationDraftHint(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return claims.restricted === true && typeof claims.registrationDraft === 'string'
      && /^[a-zA-Z0-9_-]{1,100}$/.test(claims.registrationDraft) ? claims.registrationDraft : null;
  } catch { return null; }
}

/** Client account-boundary guard, never authentication. Only a successful
 * owned-draft response authorizes displaying recovered form data. */
export function registrationSessionOwner(token: string | null): string | null {
  try {
    const parts = token?.split('.');
    if (!parts || parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof claims.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(claims.id) ? claims.id : null;
  } catch { return null; }
}

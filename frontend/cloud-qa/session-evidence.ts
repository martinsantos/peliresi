/** Read-only startup diagnostics for the synthetic Android origin. The init
 * script never writes credentials, changes storage, delays login or authorizes
 * a session. It retains presence/identity/timestamps, NEVER token strings. */
export function beginSessionEvidence(): void {
  if (location.origin !== 'http://127.0.0.1:4177') return;
  type Identity = { present: boolean; validClaims: boolean; id: string | null; issuedAt: number | null };
  type Evidence = { at: string; stage: string; [key: string]: unknown };
  const journal: Evidence[] = [];
  (window as Window & { __sitrepQaSessionEvidence?: Evidence[] }).__sitrepQaSessionEvidence = journal;
  const identity = (value: unknown): Identity => {
    const result: Identity = { present: typeof value === 'string' && value.length > 0, validClaims: false, id: null, issuedAt: null };
    if (!result.present) return result;
    try {
      const parts = (value as string).split('.');
      if (parts.length !== 3 || !parts.every(Boolean)) return result;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      if (typeof claims.id !== 'string' || claims.id.length === 0 || claims.id.length > 128
        || !Number.isFinite(claims.iat) || claims.iat < 0) return result;
      result.validClaims = true; result.id = claims.id; result.issuedAt = claims.iat;
    } catch { /* Diagnostic only; malformed tokens must not be copied. */ }
    return result;
  };
  const local = () => {
    try { return { access: identity(localStorage.getItem('sitrep_access_token')),
      refreshPresent: !!localStorage.getItem('sitrep_refresh_token') }; }
    catch { return { unavailable: true }; }
  };
  const record = (stage: string, values: Record<string, unknown>) => {
    const event = { stage, at: new Date().toISOString(), path: location.pathname, ...values };
    journal.push(event);
    // The host retains metadata across a real redirect to login; a new document
    // otherwise discards the startup reason we are trying to diagnose. Never
    // await this observer or change application timing to favor recovery.
    const observer = (window as Window & { sitrepQaRecordSessionEvidence?: (value: Evidence) => Promise<void> }).sitrepQaRecordSessionEvidence;
    if (observer) void observer(event).catch(() => {});
  };
  record('before-application-modules', { local: local(), path: location.pathname });
  let db: IDBDatabase | undefined;
  let tx: IDBTransaction | undefined;
  let settled = false;
  const finish = (state: string, values: Record<string, unknown> = {}) => {
    if (settled) return;
    settled = true; clearTimeout(timer); db?.close();
    record('durable-read', { state, ...values, localAtRead: local() });
  };
  const timer = setTimeout(() => {
    try { tx?.abort(); } catch { /* Already completed. */ }
    finish('diagnostic-timeout');
  }, 2000);
  try {
    const request = indexedDB.open('sitrep-session-v1', 1);
    // Opening a missing database must not manufacture a QA checkpoint. Abort
    // its upgrade instead of creating any database, schema or credential.
    request.onupgradeneeded = () => { request.transaction?.abort(); finish('database-absent'); };
    request.onerror = () => finish('database-unavailable');
    request.onsuccess = () => {
      db = request.result;
      if (settled) { db.close(); return; }
      if (!db.objectStoreNames.contains('session')) { finish('store-absent'); return; }
      try {
        tx = db.transaction('session', 'readonly');
        tx.onabort = tx.onerror = () => finish('transaction-unavailable');
        const read = tx.objectStore('session').get('current');
        let value: unknown;
        read.onsuccess = () => { value = read.result; };
        tx.oncomplete = () => {
          if (value === null || value === undefined) { finish(value === null ? 'logout-tombstone' : 'legacy-absence'); return; }
          if (typeof value !== 'object' || !('accessToken' in value) || !('refreshToken' in value)) { finish('malformed-pair'); return; }
          const access = identity(value.accessToken);
          const refreshPresent = typeof value.refreshToken === 'string' && value.refreshToken.length > 0;
          finish('credential-pair', { access, refreshPresent,
            matchesLocalAccess: value.accessToken === localStorage.getItem('sitrep_access_token'),
            matchesLocalRefresh: value.refreshToken === localStorage.getItem('sitrep_refresh_token') });
        };
      } catch { finish('transaction-unavailable'); }
    };
  } catch { finish('database-unavailable'); }
}

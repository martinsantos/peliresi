/** Fail closed: turning off the kill switch alone must never release old mail. */
export function mailPolicy(env: NodeJS.ProcessEnv, now = new Date()): { enabled: boolean; notBefore: Date; reason: string } {
  const raw = env.EMAIL_DELIVERY_NOT_BEFORE || '';
  const cutoff = new Date(raw);
  const valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) && Number.isFinite(cutoff.getTime());
  const reason = env.DISABLE_EMAILS !== 'false' ? 'EMAIL_DISABLED'
    : !valid ? 'ACTIVATION_CUTOFF_REQUIRED'
    : cutoff > now ? 'ACTIVATION_NOT_STARTED' : '';
  // Retry window deliberately short. Expired security links/old operational messages are not replayed.
  return { enabled: !reason, reason, notBefore: new Date(Math.max(valid ? cutoff.getTime() : now.getTime(), now.getTime() - 30 * 60_000)) };
}

export function mendozaDayStart(now = new Date()): Date {
  const local = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3));
}

/** External rule recipients need individual operations approval, not just a rule entry. */
export function externalAlertRecipientAllowed(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const recipient = email.trim().toLowerCase();
  if (env.EMAIL_EXTERNAL_ALERTS_ENABLED !== 'true' || !/^[^\s@,<>*]+@[^\s@,<>*]+\.[^\s@,<>*]+$/.test(recipient)) return false;
  return (env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST || '').split(',').some(item => item.trim().toLowerCase() === recipient);
}

/** Only failures known to occur before SMTP acceptance are automatically retried. */
export function retryableSmtpFailure(error: unknown): boolean {
  const value = error as { code?: string; responseCode?: number } | null;
  return !!value && (value.code === 'ECONNECTION' || value.code === 'EDNS'
    || (typeof value.responseCode === 'number' && value.responseCode >= 400 && value.responseCode < 500));
}

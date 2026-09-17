/**
 * Normalize the account portion of the authentication rate-limit key.
 */
export function normalizeAuthRateLimitEmail(email: unknown): string {
  return typeof email === 'string'
    ? email.trim().toLowerCase() || 'anonymous'
    : 'anonymous';
}

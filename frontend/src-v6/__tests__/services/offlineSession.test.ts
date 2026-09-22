import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../../contexts/AuthContext';
import { clearOfflineSession, isOfflineNetworkError, MAX_OFFLINE_SESSION_MS, OFFLINE_SESSION_KEY, readOfflineSession, saveOfflineSession } from '../../services/offlineSession';

const now = Date.UTC(2026, 8, 22, 12);
const user: User = { id: 'inspector-1', nombre: 'Inspector', email: 'inspector@test.invalid', rol: 'AUDITOR', sector: '', avatar: 'I', telefono: '', ubicacion: '', permisos: [], esInspector: true };
const tokenFor = (id = user.id, expiresAt = now + 24 * 60 * 60 * 1000, restricted = false) =>
  `header.${btoa(JSON.stringify({ id, exp: expiresAt / 1000, restricted }))}.signature`;

describe('bounded offline session', () => {
  beforeEach(() => localStorage.clear());

  it('restores only the saved profile and permissions for its exact token', () => {
    const token = tokenFor();
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(token, now + 1)?.user).toEqual(user);
    expect(readOfflineSession(token, now + 1)?.expiresAt).toBe(now + MAX_OFFLINE_SESSION_MS);
  });

  it('rejects another user or a replacement token even with the same user id', () => {
    const token = tokenFor();
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(tokenFor('another-user'), now)).toBeNull();
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(`${token}different`, now)).toBeNull();
  });

  it('cannot create a snapshot from a token belonging to a different user', () => {
    saveOfflineSession(user, tokenFor('another-user'), now);
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('expires at token expiry even when the offline window is longer', () => {
    const token = tokenFor(user.id, now + 60_000);
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(token, now + 59_999)).not.toBeNull();
    expect(readOfflineSession(token, now + 60_000)).toBeNull();
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });

  it('does not renew its eight-hour window on offline reads', () => {
    const token = tokenFor();
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(token, now + MAX_OFFLINE_SESSION_MS - 1)).not.toBeNull();
    expect(readOfflineSession(token, now + MAX_OFFLINE_SESSION_MS)).toBeNull();
  });

  it.each(['not-a-jwt', 'header.e30.signature', tokenFor(user.id, now - 1), tokenFor(user.id, now + 60_000, true)])('rejects invalid, expired, or restricted token %s', (token) => {
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(token, now)).toBeNull();
  });

  it('fails closed with corrupt data, no snapshot, or a clock earlier than validation', () => {
    const token = tokenFor();
    expect(readOfflineSession(token, now)).toBeNull();
    localStorage.setItem(OFFLINE_SESSION_KEY, '{');
    expect(readOfflineSession(token, now)).toBeNull();
    saveOfflineSession(user, token, now);
    expect(readOfflineSession(token, now - 1)).toBeNull();
  });

  it('clears the saved profile on explicit invalidation', () => {
    saveOfflineSession(user, tokenFor(), now);
    clearOfflineSession();
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();
  });
});

describe('network error classification', () => {
  it.each(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])('allows a transport failure without an HTTP response: %s', (code) => {
    expect(isOfflineNetworkError({ isAxiosError: true, code })).toBe(true);
  });

  it.each([401, 403, 404, 429, 500, 503])('never treats HTTP %s as offline, even when navigator reports offline', (status) => {
    expect(isOfflineNetworkError({ isAxiosError: true, code: 'ERR_NETWORK', response: { status } })).toBe(false);
  });

  it('does not hide programming errors or canceled requests', () => {
    expect(isOfflineNetworkError(new Error('unexpected'))).toBe(false);
    expect(isOfflineNetworkError({ isAxiosError: true, code: 'ERR_CANCELED' })).toBe(false);
  });
});

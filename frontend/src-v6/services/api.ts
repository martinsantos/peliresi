/**
 * SITREP v6 - API Client
 * Axios client con interceptores para auth y refresh token
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, RefreshTokenResponse } from '../types/api';
import { toast } from '../components/ui/Toast';
import { readSessionCheckpoint, writeSessionCheckpoint, type SessionCheckpoint } from './sessionCheckpoint';

const TOKEN_KEY = 'sitrep_access_token';
const REFRESH_TOKEN_KEY = 'sitrep_refresh_token';
const RENEWALS_KEY = 'sitrep_token_renewals';
const MAX_RENEWALS = 4;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ========================================
// TOKEN HELPERS
// ========================================

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

type Renewal = [string, string];
const readRenewals = (): Renewal[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RENEWALS_KEY) || '[]');
    if (!Array.isArray(value) || value.length > MAX_RENEWALS) return [];
    return value.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(token => typeof token === 'string' && token.length > 0)) ? value : [];
  } catch { return []; }
};

// Only a successful refresh writes this proof. A token change alone proves nothing.
const isKnownRenewal = (from: string, to: string | null) => {
  if (!to || from === to) return false;
  let cursor = from;
  for (const [previous, next] of readRenewals()) {
    if (previous === cursor) cursor = next;
  }
  return cursor === to;
};

const writeTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(TOKEN_KEY, accessToken);
};

let sessionGeneration = 0;
let checkpointQueue: Promise<void> = Promise.resolve();
let currentCheckpoint: Promise<void> = Promise.resolve();
const checkpoint = (value: SessionCheckpoint | null, generation = sessionGeneration, expected?: SessionCheckpoint) => {
  const saving = checkpointQueue.then(async () => {
    if (generation !== sessionGeneration) throw new Error('Session changed before committing');
    if (expected) await writeSessionCheckpoint(value, expected);
    else await writeSessionCheckpoint(value);
    if (generation !== sessionGeneration) throw new Error('Session changed while committing');
  });
  // Keep the queue usable after a failed write. Awaited callers still receive
  // the failure; synchronous invalidation paths must not leak rejections.
  checkpointQueue = saving.catch(() => {});
  currentCheckpoint = saving;
  return saving;
};

export const setTokens = (accessToken: string, refreshToken: string) => {
  ++sessionGeneration;
  localStorage.removeItem(RENEWALS_KEY);
  endRefreshSession();
  writeTokens(accessToken, refreshToken);
  checkpoint({ accessToken, refreshToken });
};

export const setTokensDurably = async (accessToken: string, refreshToken: string) => {
  const generation = ++sessionGeneration;
  localStorage.removeItem(RENEWALS_KEY);
  endRefreshSession();
  // Do not expose the new account's credentials while the UI still represents
  // the previous account or storage has not acknowledged the transition.
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  await checkpoint({ accessToken, refreshToken }, generation);
  if (generation !== sessionGeneration) throw new Error('Session changed before activation');
  writeTokens(accessToken, refreshToken);
};

export const clearTokens = () => {
  ++sessionGeneration;
  localStorage.removeItem(RENEWALS_KEY);
  endRefreshSession();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  checkpoint(null);
};

export const clearTokensDurably = () => {
  clearTokens();
  return currentCheckpoint;
};
export const confirmSessionCheckpoint = () => currentCheckpoint;

let restoration: Promise<void> | undefined;
const issuedAt = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every(Boolean)) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof claims.id === 'string' && claims.id.length > 0
      && Number.isFinite(claims.iat) && claims.iat >= 0 ? claims.iat : null;
  } catch { return null; }
};
export const restoreSessionCheckpoint = (): Promise<void> => {
  if (restoration) return restoration;
  const generation = sessionGeneration;
  restoration = (async () => {
    try {
      const saved = await readSessionCheckpoint();
      if (generation !== sessionGeneration) return;
      if (saved && getAccessToken() !== saved.accessToken) {
        const localIssuedAt = issuedAt(getAccessToken() || '');
        const savedIssuedAt = issuedAt(saved.accessToken);
        // A legacy tab can still write or clear localStorage without updating
        // IndexedDB. Only an unambiguously OLDER local token is a rollback we
        // may recover. Newer, same-second, absent or malformed credentials fail
        // closed, not silently back to the previous account. Decoding claims
        // never authorizes anything; the restored JWT still needs getMe.
        if (localIssuedAt === null || savedIssuedAt === null || localIssuedAt >= savedIssuedAt) {
          await checkpoint(null, generation);
          throw new Error('Session recovery conflict; sign in again');
        }
      }
      localStorage.removeItem(RENEWALS_KEY);
      endRefreshSession();
      if (saved) writeTokens(saved.accessToken, saved.refreshToken);
      else if (saved === null) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        // Migrate an existing installation only once, never mistake a logout
        // tombstone for a missing checkpoint.
        const accessToken = getAccessToken();
        const refreshToken = getRefreshToken();
        await checkpoint(accessToken && refreshToken ? { accessToken, refreshToken } : null, generation);
        if (!accessToken || !refreshToken) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      }
    } catch (error) {
      if (generation !== sessionGeneration) return;
      if (generation === sessionGeneration) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(RENEWALS_KEY);
        endRefreshSession();
      }
      throw error;
    }
  })();
  return restoration;
};

// ========================================
// REQUEST INTERCEPTOR
// ========================================

// Bind the credential before a later login can overtake an async interceptor.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // La instancia usa JSON por defecto, pero un FormData debe conservar sus bytes.
  // Al quitar este header, el navegador agrega multipart/form-data con su boundary.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, undefined, { synchronous: true });

// ========================================
// RESPONSE INTERCEPTOR - Auto refresh
// ========================================

type RefreshAttempt = {
  accessToken: string;
  refreshToken: string | null;
  queue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }>;
};
let activeRefresh: RefreshAttempt | null = null;

const processQueue = (attempt: RefreshAttempt, error: unknown, token: string | null = null) => {
  attempt.queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  attempt.queue = [];
};

function endRefreshSession() {
  if (activeRefresh) processQueue(activeRefresh, new Error('Session changed'));
  activeRefresh = null;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || '';

    // Never intercept auth endpoints — let errors propagate naturally
    const isAuthEndpoint = requestUrl.includes('/auth/');
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // A request issued by a previous session must never refresh and replay
    // its URL using the user who logged in while that request was in flight.
    if (error.response?.status === 401 && originalRequest?.headers.Authorization !== `Bearer ${getAccessToken()}`) {
      const authorization = originalRequest?.headers.Authorization;
      if (!originalRequest?._retry && typeof authorization === 'string' && authorization.startsWith('Bearer ') && isKnownRenewal(authorization.slice(7), getAccessToken())) {
        originalRequest._retry = true;
        return api(originalRequest);
      }
      return Promise.reject(error);
    }

    // In demo mode (no tokens), just let 401s propagate so React Query
    // can fallback to mock data gracefully
    const hasToken = !!getAccessToken();

    if (error.response?.status === 401 && !originalRequest._retry && hasToken) {
      originalRequest._retry = true;
      if (activeRefresh && activeRefresh.accessToken === getAccessToken() && activeRefresh.refreshToken === getRefreshToken()) {
        return new Promise((resolve, reject) => {
          activeRefresh!.queue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      endRefreshSession();
      const refreshToken = getRefreshToken();
      const attempt: RefreshAttempt = { accessToken: getAccessToken()!, refreshToken, queue: [] };
      activeRefresh = attempt;

      try {
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<{ success: true; data: RefreshTokenResponse }>(
          '/api/auth/refresh-token',
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = data.data;
        if (activeRefresh !== attempt || getRefreshToken() !== refreshToken) {
          // Another tab may have completed this same renewal while ours waited.
          if (isKnownRenewal(attempt.accessToken, getAccessToken())) return api(originalRequest);
          throw new Error('Session changed while refreshing');
        }
        await checkpoint({ accessToken, refreshToken: newRefreshToken }, sessionGeneration,
          { accessToken: attempt.accessToken, refreshToken });
        if (activeRefresh !== attempt || getRefreshToken() !== refreshToken) {
          if (isKnownRenewal(attempt.accessToken, getAccessToken())) return api(originalRequest);
          throw new Error('Session changed while committing refresh');
        }
        const history = readRenewals();
        const chain = history.at(-1)?.[1] === attempt.accessToken ? history : [];
        localStorage.setItem(RENEWALS_KEY, JSON.stringify([...chain, [attempt.accessToken, accessToken]].slice(-MAX_RENEWALS)));
        writeTokens(accessToken, newRefreshToken);
        processQueue(attempt, null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // A competing tab can rotate the refresh token before this request fails.
        if (isKnownRenewal(attempt.accessToken, getAccessToken())) {
          processQueue(attempt, null, getAccessToken());
          return api(originalRequest);
        }
        processQueue(attempt, refreshError, null);
        // A late response from the previous session cannot erase a new login.
        if (activeRefresh === attempt && getRefreshToken() === refreshToken
          && !(refreshError instanceof Error && refreshError.name === 'SessionCheckpointConflict')) clearTokens();
        // Don't hard-redirect — let React Router handle it
        // The ProtectedRoute will redirect to /login when currentUser is null
        return Promise.reject(refreshError);
      } finally {
        if (activeRefresh === attempt) activeRefresh = null;
      }
    }

    // Rate limit — show user-friendly message
    if (error.response?.status === 429) {
      toast.warning('Demasiadas solicitudes', 'Espere unos segundos antes de intentar nuevamente.');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// A1: Cross-tab token sync — when another tab refreshes the token, pick it up
// This prevents race conditions when multiple tabs try to refresh simultaneously
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== TOKEN_KEY && e.key !== null) return;
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.oldValue === e.newValue && e.key !== null) return;
    ++sessionGeneration;
    if (!activeRefresh) return;
    const attempt = activeRefresh;
    const token = getAccessToken();
    // Storage events may arrive after a later write; inspect the current proof.
    if (token === attempt.accessToken && getRefreshToken() === attempt.refreshToken) return;
    activeRefresh = null;
    if (isKnownRenewal(attempt.accessToken, token)) processQueue(attempt, null, token);
    else processQueue(attempt, new Error('Session changed in another tab'));
  });
}

export default api;

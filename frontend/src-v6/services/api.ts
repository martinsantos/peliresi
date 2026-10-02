/**
 * SITREP v6 - API Client
 * Axios client con interceptores para auth y refresh token
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, RefreshTokenResponse } from '../types/api';
import { toast } from '../components/ui/Toast';

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

export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.removeItem(RENEWALS_KEY);
  endRefreshSession();
  writeTokens(accessToken, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(RENEWALS_KEY);
  endRefreshSession();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
        if (activeRefresh === attempt && getRefreshToken() === refreshToken) clearTokens();
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
    if ((e.key !== TOKEN_KEY && e.key !== null) || !activeRefresh) return;
    if (e.storageArea && e.storageArea !== localStorage) return;
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

/**
 * SITREP v6 - API Client
 * Axios client con interceptores para auth y refresh token
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, RefreshTokenResponse } from '../types/api';

const TOKEN_KEY = 'sitrep_access_token';
const REFRESH_TOKEN_KEY = 'sitrep_refresh_token';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ========================================
// TOKEN HELPERS
// ========================================

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// ========================================
// REQUEST INTERCEPTOR
// ========================================

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========================================
// RESPONSE INTERCEPTOR - Auto refresh
// ========================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  failedQueue = [];
};

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

    // Without an authenticated session, propagate 401 responses so the
    // route guard can present the login flow without attempting a refresh.
    const hasToken = !!getAccessToken();

    if (error.response?.status === 401 && !originalRequest._retry && hasToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<{ success: true; data: RefreshTokenResponse }>(
          `${API_BASE_URL}/auth/refresh-token`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = data.data;
        setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        // Don't hard-redirect — let React Router handle it
        // The ProtectedRoute will redirect to /login when currentUser is null
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Rate limit — show user-friendly message
    if (error.response?.status === 429) {
      const { toast } = await import('../components/ui/Toast');
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
    if (e.key === TOKEN_KEY && e.newValue) {
      // Another tab updated the token — unblock queued requests
      if (isRefreshing) {
        isRefreshing = false;
        processQueue(null, e.newValue);
      }
    }
    if (e.key === TOKEN_KEY && !e.newValue) {
      // Token was cleared in another tab (logout) — reject queued requests
      if (isRefreshing) {
        isRefreshing = false;
        processQueue(new Error('Session ended in another tab'), null);
      }
    }
  });
}

export default api;

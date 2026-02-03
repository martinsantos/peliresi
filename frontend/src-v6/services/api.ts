/**
 * SITREP v6 - API Client
 * Axios client con interceptores para auth y refresh token
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, RefreshTokenResponse } from '../types/api';

const TOKEN_KEY = 'sitrep_access_token';
const REFRESH_TOKEN_KEY = 'sitrep_refresh_token';

export const api = axios.create({
  baseURL: '/api',
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

    // In demo mode (no tokens), don't redirect on 401 — just let the error propagate
    // so React Query can fallback to mock data gracefully
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
          '/api/auth/refresh-token',
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
        // Only redirect to login if we had real tokens that expired
        // Don't redirect in demo mode
        window.location.href = '/v6/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

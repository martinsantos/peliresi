/**
 * SITREP v6 - Auth Service
 */

import api, { setTokens, clearTokens } from './api';
import type { LoginRequest, LoginResponse, ChangePasswordRequest } from '../types/api';
import type { Usuario } from '../types/models';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<{ success: true; data: { user: any; tokens: { accessToken: string; refreshToken: string } } }>('/auth/login', credentials);
    const { tokens, user } = data.data;
    setTokens(tokens.accessToken, tokens.refreshToken);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user };
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  async getMe(): Promise<Usuario> {
    const { data } = await api.get<{ success: true; data: { user: Usuario } }>('/auth/profile');
    return data.data.user;
  },

  async changePassword(req: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', req);
  },

  async register(userData: any): Promise<{ message: string }> {
    const { data } = await api.post<{ success: true; message: string }>('/auth/register', userData);
    return { message: data.message };
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const { data } = await api.get<{ success: true; message: string }>(`/auth/verify-email?token=${token}`);
    return { message: data.message };
  },

  async forgotPassword(payload: { email?: string; cuit?: string }): Promise<void> {
    await api.post('/auth/forgot-password', payload);
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
    localStorage.setItem('sitrep_post_reset', '1');
  },
};

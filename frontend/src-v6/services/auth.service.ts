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

  async register(userData: LoginRequest & { nombre: string; rol: string }): Promise<Usuario> {
    const { data } = await api.post<{ success: true; data: Usuario }>('/auth/register', userData);
    return data.data;
  },
};

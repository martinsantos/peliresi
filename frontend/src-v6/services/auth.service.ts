/**
 * SITREP v6 - Auth Service
 */

import axios from 'axios';
import api, { setTokensDurably, clearTokensDurably, getAccessToken } from './api';
import type { LoginRequest, LoginResponse, ChangePasswordRequest } from '../types/api';
import type { Usuario } from '../types/models';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<{ success: true; data: { user: Usuario; tokens: { accessToken: string; refreshToken: string }; restricted?: boolean; solicitudId?: string | null } }>('/auth/login', credentials);
    const { tokens, user, restricted, solicitudId } = data.data;
    await setTokensDurably(tokens.accessToken, tokens.refreshToken);
    const profile = import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' && user.activo && !restricted
      ? await this.getMe() : user;
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: profile, restricted, solicitudId };
  },

  async logout(): Promise<void> {
    const endingToken = getAccessToken();
    const durableLogout = clearTokensDurably();
    // Logout must work locally even without a network. Use the captured ending
    // credential, never an interceptor that could pick up a subsequent login.
    const confirmation = endingToken ? axios.post('/auth/logout', undefined, {
      baseURL: api.defaults.baseURL,
      timeout: api.defaults.timeout,
      headers: { Authorization: `Bearer ${endingToken}` },
    }) : Promise.resolve();
    await Promise.all([durableLogout, confirmation]);
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

  async verifyEmail(token: string): Promise<{ message: string; verifiedUserId?: string; nextPath?: string }> {
    // Public one-time link: do not attach/refresh/clear an unrelated active session.
    const { data } = await axios.get<{ success: true; message: string; verifiedUserId?: string; nextPath?: string }>('/auth/verify-email', {
      baseURL: api.defaults.baseURL, timeout: api.defaults.timeout, params: { token },
    });
    return { message: data.message, verifiedUserId: data.verifiedUserId, nextPath: data.nextPath };
  },

  async forgotPassword(payload: { email?: string; cuit?: string }): Promise<void> {
    await api.post('/auth/forgot-password', payload);
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
    localStorage.setItem('sitrep_post_reset', '1');
  },

  async claimAccount(data: { cuit: string; razonSocial: string }): Promise<{ message: string }> {
    const { data: resp } = await api.post<{ success: true; message: string }>('/auth/claim-account', data);
    return { message: resp.message };
  },
};

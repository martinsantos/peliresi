import api from './api';
import type { LoginResponse, Usuario, ApiResponse } from '../types';

export const authService = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
            email,
            password,
        });

        const { user, tokens } = response.data.data;

        // Guardar tokens y usuario en localStorage
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        return response.data.data;
    },

    async register(data: {
        email: string;
        password: string;
        rol: string;
        nombre: string;
        apellido?: string;
        empresa?: string;
        telefono?: string;
    }): Promise<LoginResponse> {
        const response = await api.post<ApiResponse<LoginResponse>>('/auth/register', data);
        return response.data.data;
    },

    async getProfile(): Promise<Usuario> {
        const response = await api.get<ApiResponse<{ user: Usuario }>>('/auth/profile');
        return response.data.data.user;
    },

    async logout(): Promise<void> {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignorar errores de API en logout (modo demo)
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('token'); // Token de demo
            localStorage.removeItem('user');
        }
    },

    getStoredUser(): Usuario | null {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    isAuthenticated(): boolean {
        // Soportar tanto token de demo como accessToken de backend real
        return !!localStorage.getItem('accessToken') || !!localStorage.getItem('token');
    },
};

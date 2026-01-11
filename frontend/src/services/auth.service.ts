import api from './api';
import type { LoginResponse, Usuario, ApiResponse } from '../types';

// Notify Service Worker about token changes
const notifyServiceWorker = (type: 'SET_TOKEN' | 'CLEAR_TOKEN', token?: string) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type,
            token
        });
    }
};

// Setup listener for GET_TOKEN requests from Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'GET_TOKEN' && event.ports?.[0]) {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            event.ports[0].postMessage({ token });
        }
    });
}

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

        // Notify Service Worker about the new token
        notifyServiceWorker('SET_TOKEN', tokens.accessToken);

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

            // Notify Service Worker to clear cached token
            notifyServiceWorker('CLEAR_TOKEN');
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

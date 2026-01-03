import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const BASE_URL = import.meta.env.BASE_URL;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            // Usar BASE_URL para redirigir correctamente en subdirectorio
            window.location.href = `${BASE_URL}login`.replace('//', '/');
        }
        return Promise.reject(error);
    }
);

export default api;


/**
 * Types for Configuracion components
 */

export type TabType = 'usuarios' | 'residuos' | 'parametros' | 'tareas';
export type ThemeType = 'dark' | 'light' | 'system';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface DeleteConfirmation {
    type: 'residuo' | 'usuario';
    id: string;
    nombre: string;
}

export interface ResiduoFormData {
    codigo: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    caracteristicas: string;
    peligrosidad: string;
}

export interface UsuarioFormData {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    rol: string;
    activo: boolean;
}

export interface ParametrosConfig {
    vencimientoManifiestos: number;
    alertaDesvioGPS: number;
    tiempoMaxTransito: number;
    emailNotificaciones: string;
    toleranciaPeso: number;
    tiempoSesion: number;
}

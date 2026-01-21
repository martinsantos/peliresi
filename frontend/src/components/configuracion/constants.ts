/**
 * Constants for Configuracion
 */

import type { ResiduoFormData, UsuarioFormData, ParametrosConfig } from './types';

export const DEFAULT_RESIDUO_FORM: ResiduoFormData = {
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: 'A',
    caracteristicas: '',
    peligrosidad: 'Alta'
};

export const DEFAULT_USUARIO_FORM: UsuarioFormData = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    rol: 'GENERADOR',
    activo: true
};

export const DEFAULT_PARAMETROS: ParametrosConfig = {
    vencimientoManifiestos: 30,
    alertaDesvioGPS: 5,
    tiempoMaxTransito: 48,
    emailNotificaciones: 'alertas@dgfa.mendoza.gov.ar',
    toleranciaPeso: 5,
    tiempoSesion: 60
};

export const ROL_BADGE_CLASSES: Record<string, string> = {
    ADMIN: 'badge-admin',
    GENERADOR: 'badge-generador',
    TRANSPORTISTA: 'badge-transportista',
    OPERADOR: 'badge-operador'
};

export const PELIGROSIDAD_BADGE_CLASSES: Record<string, string> = {
    Alta: 'badge-danger',
    Media: 'badge-warning',
    Baja: 'badge-success'
};
